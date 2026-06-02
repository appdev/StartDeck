use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use axum::Json;
use axum::extract::{Path as AxumPath, State};
use axum::http::HeaderMap;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use chrono::Utc;
use reqwest::{Client, RequestBuilder};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::Row;

use crate::{ApiError, AppState, require_username};

const TAPD_KEY_VERSION: i64 = 1;
const TAPD_BASE_URL_ENV: &str = "STARTDECK_TAPD_BASE_URL";
const DEFAULT_TAPD_BASE_URL: &str = "https://api.tapd.cn";
const ACTIONABLE_STATUS_FILTER: &str = "new|assigned|in_progress|reopened";
const DEFAULT_FIELDS: &[&str] = &[
    "id",
    "title",
    "severity",
    "priority_label",
    "status",
    "current_owner",
    "modified",
    "workspace_id",
    "label",
];

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TapdCredentialType {
    Basic,
    Bearer,
}

impl TapdCredentialType {
    fn as_str(self) -> &'static str {
        match self {
            Self::Basic => "basic",
            Self::Bearer => "bearer",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TapdCredentialMaterial {
    credential_type: TapdCredentialType,
    api_user: Option<String>,
    api_password: Option<String>,
    access_token: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveCredentialRequest {
    credential_type: TapdCredentialType,
    api_user: Option<String>,
    api_password: Option<String>,
    access_token: Option<String>,
    server_storage_acknowledged: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CredentialStatusResponse {
    has_server_credential: bool,
    widget_id: String,
    credential_type: Option<&'static str>,
    account_hint: Option<String>,
    updated_at: Option<i64>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum TapdVisibilityScope {
    #[default]
    #[serde(rename = "owned-by-current-user")]
    Owned,
    #[serde(rename = "created-by-current-user")]
    Created,
    #[serde(rename = "participated-by-current-user")]
    Participated,
    #[serde(rename = "cc-to-current-user")]
    Cc,
}

impl TapdVisibilityScope {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Owned => "owned-by-current-user",
            Self::Created => "created-by-current-user",
            Self::Participated => "participated-by-current-user",
            Self::Cc => "cc-to-current-user",
        }
    }

    fn current_user_param(&self) -> &'static str {
        match self {
            Self::Owned => "current_owner",
            Self::Created => "reporter",
            Self::Participated => "participator",
            Self::Cc => "cc",
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TapdDefectFilters {
    severity: Option<String>,
    priority_label: Option<String>,
    iteration_id: Option<String>,
    current_owner: Option<String>,
    reporter: Option<String>,
    participator: Option<String>,
    cc: Option<String>,
    label: Option<String>,
    module: Option<String>,
    version_report: Option<String>,
    source: Option<String>,
    bugtype: Option<String>,
    custom_fields: Option<HashMap<String, Value>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TapdDefectsQueryRequest {
    widget_id: String,
    workspace_id: String,
    page: Option<u32>,
    limit: Option<u32>,
    order: Option<String>,
    fields: Option<Vec<String>>,
    current_user: Option<String>,
    filters: Option<TapdDefectFilters>,
    blocked_bug_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TapdWorkspaceRequest {
    widget_id: String,
    workspace_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TapdWorkspaceResponse {
    status: &'static str,
    workspace_id: String,
    project_name: Option<String>,
    fallback_name: String,
    error_code: Option<&'static str>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TapdDefectListItem {
    id: String,
    severity: String,
    priority_label: Option<String>,
    title: String,
    status: String,
    current_owner: Option<String>,
    modified: Option<String>,
    url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TapdDefectsQueryResponse {
    status: &'static str,
    workspace_id: String,
    project_name: Option<String>,
    total: u32,
    visible_total: u32,
    blocked_total: u32,
    verification_total: u32,
    critical: u32,
    assigned_to_current_user: u32,
    visible_scope: String,
    page: u32,
    limit: u32,
    last_synced_at: String,
    items: Vec<TapdDefectListItem>,
    error_code: Option<&'static str>,
}

#[derive(Debug)]
struct StoredCredential {
    credential_type: TapdCredentialType,
    encrypted_material: String,
    nonce: String,
    updated_at: i64,
}

#[derive(Debug)]
struct TapdUpstreamError {
    code: &'static str,
}

pub(crate) async fn query_defects(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<TapdDefectsQueryRequest>,
) -> Result<Json<TapdDefectsQueryResponse>, ApiError> {
    let username = require_username(&headers, &state)?;
    let widget_id = sanitize_component_id(&body.widget_id, "invalid_widget_id")?;
    let workspace_id = sanitize_workspace_id(&body.workspace_id)?;
    let stored = load_stored_credential(&state, &username, &widget_id).await?;
    let stored = stored.ok_or_else(|| ApiError::bad_request("server_credential_missing"))?;
    let material = decrypt_material(&state, &stored).await?;
    let current_user = match resolve_current_user(
        &state.http,
        &material,
        body.current_user.as_deref(),
        &tapd_base_url(),
    )
    .await
    {
        Ok(current_user) => current_user,
        Err(error) => {
            let query = build_normalized_query(body, workspace_id, None);
            return Ok(Json(error_response(query, error.code)));
        }
    };
    let query = normalize_query_request(body, workspace_id.clone(), current_user)?;

    match fetch_defects_with_base(&state.http, &material, &query, &tapd_base_url()).await {
        Ok(mut response) => {
            response.project_name = fetch_workspace_name_with_base(
                &state.http,
                &material,
                &workspace_id,
                &tapd_base_url(),
            )
            .await
            .ok();
            Ok(Json(response))
        }
        Err(error) => Ok(Json(error_response(query, error.code))),
    }
}

pub(crate) async fn resolve_workspace(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<TapdWorkspaceRequest>,
) -> Result<Json<TapdWorkspaceResponse>, ApiError> {
    let username = require_username(&headers, &state)?;
    let widget_id = sanitize_component_id(&body.widget_id, "invalid_widget_id")?;
    let workspace_id = sanitize_workspace_id(&body.workspace_id)?;
    let stored = load_stored_credential(&state, &username, &widget_id).await?;
    let stored = stored.ok_or_else(|| ApiError::bad_request("server_credential_missing"))?;
    let material = decrypt_material(&state, &stored).await?;

    let fallback_name = format!("TAPD 缺陷 · {workspace_id}");
    match fetch_workspace_name_with_base(&state.http, &material, &workspace_id, &tapd_base_url())
        .await
    {
        Ok(project_name) => Ok(Json(TapdWorkspaceResponse {
            status: "connected",
            workspace_id,
            project_name: Some(project_name),
            fallback_name,
            error_code: None,
        })),
        Err(error) => Ok(Json(TapdWorkspaceResponse {
            status: "error",
            workspace_id,
            project_name: None,
            fallback_name,
            error_code: Some(error.code),
        })),
    }
}

pub(crate) async fn get_credential(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(widget_id): AxumPath<String>,
) -> Result<Json<CredentialStatusResponse>, ApiError> {
    let username = require_username(&headers, &state)?;
    let widget_id = sanitize_component_id(&widget_id, "invalid_widget_id")?;
    let Some(stored) = load_stored_credential(&state, &username, &widget_id).await? else {
        return Ok(Json(CredentialStatusResponse {
            has_server_credential: false,
            widget_id,
            credential_type: None,
            account_hint: None,
            updated_at: None,
        }));
    };
    let material = decrypt_material(&state, &stored).await.ok();
    Ok(Json(CredentialStatusResponse {
        has_server_credential: true,
        widget_id,
        credential_type: Some(stored.credential_type.as_str()),
        account_hint: material.and_then(|value| credential_account_hint(&value)),
        updated_at: Some(stored.updated_at),
    }))
}

pub(crate) async fn save_credential(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(widget_id): AxumPath<String>,
    Json(body): Json<SaveCredentialRequest>,
) -> Result<Json<CredentialStatusResponse>, ApiError> {
    let username = require_username(&headers, &state)?;
    let widget_id = sanitize_component_id(&widget_id, "invalid_widget_id")?;
    if !body.server_storage_acknowledged {
        return Err(ApiError::bad_request(
            "server_storage_acknowledgement_required",
        ));
    }
    let material = normalize_credential_material(body)?;
    let credential_type = material.credential_type;
    let material_json = serde_json::to_string(&material)
        .map_err(|_| ApiError::internal("credential_encode_failed"))?;
    let (encrypted_material, nonce) = encrypt_text(&state, &material_json).await?;
    let now = Utc::now().timestamp_millis();
    sqlx::query(
        r#"INSERT INTO tapd_credentials(
            username, widget_id, credential_type, encrypted_material,
            nonce, key_version, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(username, widget_id) DO UPDATE SET
            credential_type=excluded.credential_type,
            encrypted_material=excluded.encrypted_material,
            nonce=excluded.nonce,
            key_version=excluded.key_version,
            updated_at=excluded.updated_at"#,
    )
    .bind(&username)
    .bind(&widget_id)
    .bind(credential_type.as_str())
    .bind(encrypted_material)
    .bind(nonce)
    .bind(TAPD_KEY_VERSION)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await?;

    get_credential(State(state), headers, AxumPath(widget_id)).await
}

pub(crate) async fn delete_credential(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(widget_id): AxumPath<String>,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let widget_id = sanitize_component_id(&widget_id, "invalid_widget_id")?;
    sqlx::query("DELETE FROM tapd_credentials WHERE username = ? AND widget_id = ?")
        .bind(username)
        .bind(widget_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(serde_json::json!({"success": true})))
}

#[derive(Clone, Debug)]
struct NormalizedQuery {
    workspace_id: String,
    page: u32,
    limit: u32,
    order: String,
    fields: Vec<String>,
    visibility_scope: TapdVisibilityScope,
    current_user: Option<String>,
    filters: TapdDefectFilters,
    blocked_bug_ids: HashSet<String>,
}

fn normalize_query_request(
    body: TapdDefectsQueryRequest,
    workspace_id: String,
    current_user: Option<String>,
) -> Result<NormalizedQuery, ApiError> {
    let query = build_normalized_query(body, workspace_id, current_user);
    if query.current_user.is_none() {
        return Err(ApiError::bad_request("current_user_required"));
    }
    Ok(query)
}

fn build_normalized_query(
    body: TapdDefectsQueryRequest,
    workspace_id: String,
    current_user: Option<String>,
) -> NormalizedQuery {
    let visibility_scope = TapdVisibilityScope::Owned;
    let fields = body
        .fields
        .unwrap_or_else(|| {
            DEFAULT_FIELDS
                .iter()
                .map(|value| value.to_string())
                .collect()
        })
        .into_iter()
        .filter_map(|value| normalize_field_name(&value))
        .take(40)
        .collect::<Vec<_>>();
    let fields = if fields.is_empty() {
        DEFAULT_FIELDS
            .iter()
            .map(|value| value.to_string())
            .collect()
    } else {
        fields
    };
    let limit = body.limit.unwrap_or(100).clamp(1, 200);
    let page = body.page.unwrap_or(1).max(1);
    let order =
        normalize_order(body.order.as_deref()).unwrap_or_else(|| "modified desc".to_string());
    let blocked_bug_ids = body
        .blocked_bug_ids
        .unwrap_or_default()
        .into_iter()
        .filter_map(|value| normalize_bug_id(&value))
        .collect();
    NormalizedQuery {
        workspace_id,
        page,
        limit,
        order,
        fields,
        visibility_scope,
        current_user,
        filters: body.filters.unwrap_or_default(),
        blocked_bug_ids,
    }
}

async fn fetch_defects_with_base(
    client: &Client,
    material: &TapdCredentialMaterial,
    query: &NormalizedQuery,
    base_url: &str,
) -> Result<TapdDefectsQueryResponse, TapdUpstreamError> {
    let mut params = query_params(query);
    params.push(("limit".to_string(), query.limit.to_string()));
    params.push(("page".to_string(), query.page.to_string()));
    params.push(("order".to_string(), query.order.clone()));
    params.push(("fields".to_string(), query.fields.join(",")));

    let bugs_url = format!("{}/bugs", base_url.trim_end_matches('/'));
    let bugs_payload =
        send_tapd_json(authenticate(client.get(bugs_url), material).query(&params)).await?;

    let count_url = format!("{}/bugs/count", base_url.trim_end_matches('/'));
    let count_payload =
        send_tapd_json(authenticate(client.get(count_url), material).query(&query_params(query)))
            .await?;

    let total = parse_count(&count_payload)?;
    let all_items = parse_bugs(&bugs_payload, &query.workspace_id)?;
    let visible_items = all_items
        .into_iter()
        .filter(|item| is_actionable_status(&item.status))
        .filter(|item| !query.blocked_bug_ids.contains(&item.id))
        .collect::<Vec<_>>();
    let verification_total = visible_items
        .iter()
        .filter(|item| is_verification_pending(item))
        .count() as u32;
    let critical = visible_items
        .iter()
        .filter(|item| is_critical(item))
        .count() as u32;
    let assigned_to_current_user = query
        .current_user
        .as_deref()
        .map(|current_user| {
            visible_items
                .iter()
                .filter(|item| {
                    item.current_owner
                        .as_deref()
                        .map(|owner| owner.split(';').any(|part| part.trim() == current_user))
                        .unwrap_or(false)
                })
                .count() as u32
        })
        .unwrap_or(0);

    let visible_total = total.saturating_sub(query.blocked_bug_ids.len() as u32);

    Ok(TapdDefectsQueryResponse {
        status: "connected",
        workspace_id: query.workspace_id.clone(),
        project_name: None,
        total,
        visible_total,
        blocked_total: query.blocked_bug_ids.len() as u32,
        verification_total,
        critical,
        assigned_to_current_user,
        visible_scope: query.visibility_scope.as_str().to_string(),
        page: query.page,
        limit: query.limit,
        last_synced_at: Utc::now().to_rfc3339(),
        items: visible_items,
        error_code: None,
    })
}

async fn fetch_workspace_name_with_base(
    client: &Client,
    material: &TapdCredentialMaterial,
    workspace_id: &str,
    base_url: &str,
) -> Result<String, TapdUpstreamError> {
    let url = format!(
        "{}/workspaces/get_workspace_info",
        base_url.trim_end_matches('/')
    );
    let payload = send_tapd_json(
        authenticate(client.get(url), material).query(&[("workspace_id", workspace_id)]),
    )
    .await?;
    payload
        .pointer("/data/Workspace/name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .ok_or(TapdUpstreamError {
            code: "source_shape_changed",
        })
}

async fn send_tapd_json(request: RequestBuilder) -> Result<Value, TapdUpstreamError> {
    let response = request.send().await.map_err(|_| TapdUpstreamError {
        code: "upstream_unreachable",
    })?;
    let status = response.status();
    match status.as_u16() {
        401 => {
            return Err(TapdUpstreamError {
                code: "reauth_required",
            });
        }
        403 => {
            return Err(TapdUpstreamError {
                code: "upstream_forbidden",
            });
        }
        429 => {
            return Err(TapdUpstreamError {
                code: "upstream_rate_limited",
            });
        }
        _ => {}
    }
    let payload = response
        .json::<Value>()
        .await
        .map_err(|_| TapdUpstreamError {
            code: "source_shape_changed",
        })?;
    if !status.is_success() {
        return Err(classify_tapd_payload_error(&payload));
    }
    let ok = payload
        .get("status")
        .and_then(|value| value.as_i64().or_else(|| value.as_str()?.parse().ok()))
        .unwrap_or(0)
        == 1;
    if !ok {
        return Err(classify_tapd_payload_error(&payload));
    }
    Ok(payload)
}

fn classify_tapd_payload_error(payload: &Value) -> TapdUpstreamError {
    let info = payload
        .get("info")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    if info.contains("token")
        && (info.contains("invalid") || info.contains("expired") || info.contains("unauthorized"))
    {
        return TapdUpstreamError {
            code: "reauth_required",
        };
    }
    TapdUpstreamError {
        code: "upstream_error",
    }
}

fn authenticate(request: RequestBuilder, material: &TapdCredentialMaterial) -> RequestBuilder {
    match material.credential_type {
        TapdCredentialType::Basic => request.basic_auth(
            material.api_user.as_deref().unwrap_or_default(),
            material.api_password.as_deref(),
        ),
        TapdCredentialType::Bearer => {
            request.bearer_auth(material.access_token.as_deref().unwrap_or_default())
        }
    }
}

fn query_params(query: &NormalizedQuery) -> Vec<(String, String)> {
    let mut params = vec![("workspace_id".to_string(), query.workspace_id.clone())];
    let mut filters = vec![
        ("status", Some(ACTIONABLE_STATUS_FILTER)),
        ("severity", query.filters.severity.as_deref()),
        ("priority_label", query.filters.priority_label.as_deref()),
        ("iteration_id", query.filters.iteration_id.as_deref()),
        ("current_owner", query.filters.current_owner.as_deref()),
        ("reporter", query.filters.reporter.as_deref()),
        ("participator", query.filters.participator.as_deref()),
        ("cc", query.filters.cc.as_deref()),
        ("label", query.filters.label.as_deref()),
        ("module", query.filters.module.as_deref()),
        ("version_report", query.filters.version_report.as_deref()),
        ("source", query.filters.source.as_deref()),
        ("bugtype", query.filters.bugtype.as_deref()),
    ];
    if let Some(current_user) = query.current_user.as_deref() {
        let param = query.visibility_scope.current_user_param();
        if !filters
            .iter()
            .any(|(name, value)| *name == param && value.is_some())
        {
            filters.push((param, Some(current_user)));
        }
    }
    for (name, value) in filters {
        if let Some(value) = normalize_param_text(value) {
            params.push((name.to_string(), value));
        }
    }
    if let Some(custom_fields) = &query.filters.custom_fields {
        for (name, value) in custom_fields {
            if !is_allowed_custom_field_name(name) {
                continue;
            }
            if let Some(value) = value_to_param(value) {
                params.push((name.clone(), value));
            }
        }
    }
    params
}

fn parse_bugs(
    payload: &Value,
    workspace_id: &str,
) -> Result<Vec<TapdDefectListItem>, TapdUpstreamError> {
    let rows = payload
        .get("data")
        .and_then(Value::as_array)
        .ok_or(TapdUpstreamError {
            code: "source_shape_changed",
        })?;
    Ok(rows
        .iter()
        .filter_map(|row| row.get("Bug").or_else(|| row.as_object().map(|_| row)))
        .filter_map(|bug| normalize_bug(bug, workspace_id))
        .collect())
}

fn parse_count(payload: &Value) -> Result<u32, TapdUpstreamError> {
    payload
        .pointer("/data/count")
        .and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_str()?.trim().parse::<u64>().ok())
        })
        .and_then(|value| u32::try_from(value).ok())
        .ok_or(TapdUpstreamError {
            code: "source_shape_changed",
        })
}

fn normalize_bug(value: &Value, workspace_id: &str) -> Option<TapdDefectListItem> {
    let id = text_field(value, "id").and_then(|id| normalize_bug_id(&id))?;
    let title = text_field(value, "title").unwrap_or_else(|| format!("缺陷 {id}"));
    let severity = text_field(value, "severity").unwrap_or_else(|| "--".to_string());
    let priority_label =
        text_field(value, "priority_label").or_else(|| text_field(value, "priority"));
    let status = text_field(value, "status")
        .or_else(|| text_field(value, "v_status"))
        .unwrap_or_else(|| "--".to_string());
    let current_owner = text_field(value, "current_owner");
    let modified = text_field(value, "modified").or_else(|| text_field(value, "lastmodify"));
    Some(TapdDefectListItem {
        id: id.clone(),
        severity,
        priority_label,
        title,
        status,
        current_owner,
        modified,
        url: format!(
            "https://www.tapd.cn/{}/bugtrace/bugs/view/{}",
            workspace_id, id
        ),
    })
}

fn text_field(value: &Value, name: &str) -> Option<String> {
    value
        .get(name)
        .and_then(|item| {
            item.as_str()
                .map(ToOwned::to_owned)
                .or_else(|| item.as_i64().map(|number| number.to_string()))
                .or_else(|| item.as_u64().map(|number| number.to_string()))
        })
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn is_verification_pending(item: &TapdDefectListItem) -> bool {
    if is_closed_status(&item.status) {
        return false;
    }
    let value = item.status.trim().to_ascii_lowercase();
    value == "resolved"
        || value == "wait_verify"
        || value.contains("待验证")
        || value.contains("待验")
        || value.contains("已解决")
}

fn is_closed_status(status: &str) -> bool {
    let value = status.trim().to_ascii_lowercase();
    matches!(
        value.as_str(),
        "closed" | "done" | "rejected" | "verified" | "已关闭" | "已拒绝" | "无需处理"
    )
}

fn is_actionable_status(status: &str) -> bool {
    let value = status.trim().to_ascii_lowercase();
    matches!(
        value.as_str(),
        "new"
            | "open"
            | "opened"
            | "assigned"
            | "accepted"
            | "in_progress"
            | "reopened"
            | "新"
            | "已打开"
            | "打开"
            | "已分配"
            | "接受"
            | "已接受"
            | "接受/处理"
            | "接受/处理中"
            | "重新打开"
    )
}

fn is_critical(item: &TapdDefectListItem) -> bool {
    let severity = item.severity.trim().to_ascii_lowercase();
    let priority = item
        .priority_label
        .as_deref()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    matches!(
        severity.as_str(),
        "p0" | "p1" | "critical" | "fatal" | "serious"
    ) || matches!(priority.as_str(), "p0" | "p1" | "high" | "紧急" | "高")
}

fn error_response(query: NormalizedQuery, code: &'static str) -> TapdDefectsQueryResponse {
    TapdDefectsQueryResponse {
        status: "error",
        workspace_id: query.workspace_id,
        project_name: None,
        total: 0,
        visible_total: 0,
        blocked_total: query.blocked_bug_ids.len() as u32,
        verification_total: 0,
        critical: 0,
        assigned_to_current_user: 0,
        visible_scope: query.visibility_scope.as_str().to_string(),
        page: query.page,
        limit: query.limit,
        last_synced_at: Utc::now().to_rfc3339(),
        items: Vec::new(),
        error_code: Some(code),
    }
}

async fn load_stored_credential(
    state: &AppState,
    username: &str,
    widget_id: &str,
) -> Result<Option<StoredCredential>, ApiError> {
    let row = sqlx::query(
        r#"SELECT credential_type, encrypted_material, nonce, updated_at
           FROM tapd_credentials
           WHERE username = ? AND widget_id = ?"#,
    )
    .bind(username)
    .bind(widget_id)
    .fetch_optional(&state.pool)
    .await?;

    row.map(|row| {
        let credential_type = match row.get::<String, _>("credential_type").as_str() {
            "basic" => Ok(TapdCredentialType::Basic),
            "bearer" => Ok(TapdCredentialType::Bearer),
            _ => Err(ApiError::internal("invalid_stored_credential_type")),
        }?;
        Ok(StoredCredential {
            credential_type,
            encrypted_material: row.get("encrypted_material"),
            nonce: row.get("nonce"),
            updated_at: row.get("updated_at"),
        })
    })
    .transpose()
}

async fn decrypt_material(
    state: &AppState,
    stored: &StoredCredential,
) -> Result<TapdCredentialMaterial, ApiError> {
    let plain = decrypt_text(state, &stored.encrypted_material, &stored.nonce).await?;
    let material = serde_json::from_str::<TapdCredentialMaterial>(&plain)
        .map_err(|_| ApiError::internal("credential_decode_failed"))?;
    if material.credential_type != stored.credential_type {
        return Err(ApiError::internal("credential_type_mismatch"));
    }
    Ok(material)
}

fn normalize_credential_material(
    body: SaveCredentialRequest,
) -> Result<TapdCredentialMaterial, ApiError> {
    match body.credential_type {
        TapdCredentialType::Basic => Ok(TapdCredentialMaterial {
            credential_type: TapdCredentialType::Basic,
            api_user: Some(normalize_secret(
                body.api_user.unwrap_or_default(),
                "api_user_required",
            )?),
            api_password: Some(normalize_secret(
                body.api_password.unwrap_or_default(),
                "api_password_required",
            )?),
            access_token: None,
        }),
        TapdCredentialType::Bearer => Ok(TapdCredentialMaterial {
            credential_type: TapdCredentialType::Bearer,
            api_user: None,
            api_password: None,
            access_token: Some(normalize_secret(
                body.access_token.unwrap_or_default(),
                "access_token_required",
            )?),
        }),
    }
}

fn credential_account_hint(material: &TapdCredentialMaterial) -> Option<String> {
    match material.credential_type {
        TapdCredentialType::Basic => material.api_user.clone(),
        TapdCredentialType::Bearer => material.access_token.as_deref().and_then(mask_secret),
    }
}

async fn resolve_current_user(
    client: &Client,
    material: &TapdCredentialMaterial,
    raw: Option<&str>,
    base_url: &str,
) -> Result<Option<String>, TapdUpstreamError> {
    if let Some(value) = normalize_param_text(raw) {
        return Ok(Some(value));
    }
    let current_user = match material.credential_type {
        TapdCredentialType::Basic => Ok(material
            .api_user
            .as_deref()
            .and_then(|value| normalize_param_text(Some(value)))),
        TapdCredentialType::Bearer => fetch_current_user_nick(client, material, base_url)
            .await
            .map(Some),
    }?;
    Ok(current_user)
}

async fn fetch_current_user_nick(
    client: &Client,
    material: &TapdCredentialMaterial,
    base_url: &str,
) -> Result<String, TapdUpstreamError> {
    let url = format!("{}/users/info", base_url.trim_end_matches('/'));
    let payload = send_tapd_json(authenticate(client.get(url), material)).await?;
    payload
        .pointer("/data/nick")
        .or_else(|| payload.pointer("/data/id"))
        .and_then(Value::as_str)
        .and_then(|value| normalize_param_text(Some(value)))
        .ok_or(TapdUpstreamError {
            code: "source_shape_changed",
        })
}

async fn encrypt_text(state: &AppState, text: &str) -> Result<(String, String), ApiError> {
    let key = load_or_create_key(state).await?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| ApiError::internal("credential_key_invalid"))?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let encrypted = cipher
        .encrypt(&nonce, text.as_bytes())
        .map_err(|_| ApiError::internal("credential_encrypt_failed"))?;
    let nonce_bytes: &[u8] = nonce.as_ref();
    Ok((STANDARD.encode(encrypted), STANDARD.encode(nonce_bytes)))
}

async fn decrypt_text(state: &AppState, encrypted: &str, nonce: &str) -> Result<String, ApiError> {
    let key = load_or_create_key(state).await?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| ApiError::internal("credential_key_invalid"))?;
    let encrypted = STANDARD
        .decode(encrypted)
        .map_err(|_| ApiError::internal("credential_decrypt_failed"))?;
    let nonce = STANDARD
        .decode(nonce)
        .map_err(|_| ApiError::internal("credential_decrypt_failed"))?;
    let nonce: [u8; 12] = nonce
        .try_into()
        .map_err(|_| ApiError::internal("credential_decrypt_failed"))?;
    let nonce = Nonce::from(nonce);
    let plain = cipher
        .decrypt(&nonce, encrypted.as_ref())
        .map_err(|_| ApiError::internal("credential_decrypt_failed"))?;
    String::from_utf8(plain).map_err(|_| ApiError::internal("credential_decrypt_failed"))
}

async fn load_or_create_key(state: &AppState) -> Result<[u8; 32], ApiError> {
    let path = credential_key_path(state);
    match tokio::fs::read(&path).await {
        Ok(bytes) => decode_key_bytes(&bytes),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            let key = Aes256Gcm::generate_key(&mut OsRng);
            let parent = path
                .parent()
                .ok_or_else(|| ApiError::internal("credential_key_path_invalid"))?;
            tokio::fs::create_dir_all(parent).await?;
            let key_bytes: &[u8] = key.as_ref();
            let encoded = STANDARD.encode(key_bytes);
            tokio::fs::write(&path, &encoded).await?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;

                tokio::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).await?;
            }
            decode_key_bytes(encoded.as_bytes())
        }
        Err(err) => Err(ApiError::internal(err.to_string())),
    }
}

fn decode_key_bytes(bytes: &[u8]) -> Result<[u8; 32], ApiError> {
    let decoded = STANDARD
        .decode(String::from_utf8_lossy(bytes).trim())
        .map_err(|_| ApiError::internal("credential_key_invalid"))?;
    let mut out = [0_u8; 32];
    if decoded.len() != out.len() {
        return Err(ApiError::internal("credential_key_invalid"));
    }
    out.copy_from_slice(&decoded);
    Ok(out)
}

fn credential_key_path(state: &AppState) -> PathBuf {
    state
        .config
        .data_dir
        .join("secrets")
        .join("tapd-credential.key")
}

fn tapd_base_url() -> String {
    std::env::var(TAPD_BASE_URL_ENV)
        .unwrap_or_else(|_| DEFAULT_TAPD_BASE_URL.to_string())
        .trim_end_matches('/')
        .to_string()
}

fn sanitize_component_id(raw: &str, error: &'static str) -> Result<String, ApiError> {
    let value = raw.trim();
    if value.is_empty()
        || value.len() > 128
        || !value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        return Err(ApiError::bad_request(error));
    }
    Ok(value.to_string())
}

fn sanitize_workspace_id(raw: &str) -> Result<String, ApiError> {
    let value = raw.trim();
    if value.is_empty() || value.len() > 32 || !value.chars().all(|ch| ch.is_ascii_digit()) {
        return Err(ApiError::bad_request("invalid_workspace_id"));
    }
    Ok(value.to_string())
}

fn normalize_secret(raw: String, error: &'static str) -> Result<String, ApiError> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(ApiError::bad_request(error));
    }
    if value.len() > 16 * 1024 {
        return Err(ApiError::bad_request("credential_too_large"));
    }
    Ok(value.to_string())
}

fn normalize_param_text(raw: Option<&str>) -> Option<String> {
    raw.map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .filter(|value| value.len() <= 512)
}

fn normalize_field_name(raw: &str) -> Option<String> {
    let value = raw.trim();
    if value.is_empty()
        || value.len() > 64
        || !value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
    {
        return None;
    }
    Some(value.to_string())
}

fn normalize_bug_id(raw: &str) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() || value.len() > 32 || !value.chars().all(|ch| ch.is_ascii_digit()) {
        return None;
    }
    Some(value.to_string())
}

fn normalize_order(raw: Option<&str>) -> Option<String> {
    let value = raw?.trim();
    if value.is_empty()
        || value.len() > 128
        || !value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | ' ' | ',' | '.' | '-'))
    {
        return None;
    }
    Some(value.to_string())
}

fn is_allowed_custom_field_name(name: &str) -> bool {
    (name.starts_with("custom_field_") || name.starts_with("custom_plan_field_"))
        && normalize_field_name(name).is_some()
}

fn value_to_param(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => normalize_param_text(Some(value)),
        Value::Number(number) => Some(number.to_string()),
        Value::Bool(value) => Some(if *value { "1" } else { "0" }.to_string()),
        _ => None,
    }
}

fn mask_secret(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    let chars = trimmed.chars().collect::<Vec<_>>();
    if chars.len() <= 4 {
        return Some("****".to_string());
    }
    let suffix = chars[chars.len().saturating_sub(4)..]
        .iter()
        .collect::<String>();
    Some(format!("****{suffix}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use axum::routing::get;
    use serde_json::json;

    #[test]
    fn parses_tapd_bugs_and_counts_verification_status() {
        let payload = json!({
            "status": 1,
            "data": [
                {"Bug": {
                    "id": "101",
                    "title": "支付回调失败",
                    "severity": "p0",
                    "priority_label": "P0",
                    "status": "待验证",
                    "current_owner": "tapd_user",
                    "modified": "2026-05-27 10:00:00"
                }},
                {"Bug": {
                    "id": "102",
                    "title": "已关闭问题",
                    "severity": "p2",
                    "status": "closed",
                    "current_owner": "tapd_user"
                }}
            ]
        });

        let items = parse_bugs(&payload, "20358627").unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(
            items[0].url,
            "https://www.tapd.cn/20358627/bugtrace/bugs/view/101"
        );
        assert!(is_verification_pending(&items[0]));
        assert!(!is_verification_pending(&items[1]));
        assert!(is_critical(&items[0]));
    }

    #[test]
    fn builds_query_params_without_follow_field() {
        let query = NormalizedQuery {
            workspace_id: "20358627".to_string(),
            page: 1,
            limit: 100,
            order: "modified desc".to_string(),
            fields: DEFAULT_FIELDS
                .iter()
                .map(|value| value.to_string())
                .collect(),
            visibility_scope: TapdVisibilityScope::Owned,
            current_user: Some("tapd_user".to_string()),
            filters: TapdDefectFilters {
                label: Some("重点关注".to_string()),
                custom_fields: Some(HashMap::from([(
                    "custom_field_one".to_string(),
                    Value::String("是".to_string()),
                )])),
                ..Default::default()
            },
            blocked_bug_ids: HashSet::new(),
        };

        let params = query_params(&query);
        assert!(params.contains(&("current_owner".to_string(), "tapd_user".to_string())));
        assert!(params.contains(&("status".to_string(), ACTIONABLE_STATUS_FILTER.to_string())));
        assert!(params.contains(&("label".to_string(), "重点关注".to_string())));
        assert!(params.contains(&("custom_field_one".to_string(), "是".to_string())));
        assert!(!params.iter().any(|(name, _)| name == "follow"));
        assert!(
            !params
                .iter()
                .any(|(name, value)| { name == "status" && value == "resolved" })
        );
    }

    #[test]
    fn rejects_personal_query_without_current_user() {
        let err = normalize_query_request(
            TapdDefectsQueryRequest {
                widget_id: "tapd-widget".to_string(),
                workspace_id: "20358627".to_string(),
                page: Some(1),
                limit: Some(100),
                order: None,
                fields: None,
                current_user: None,
                filters: None,
                blocked_bug_ids: None,
            },
            "20358627".to_string(),
            None,
        )
        .unwrap_err();

        assert_eq!(err.status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn fetches_workspace_name_with_basic_auth() {
        let base_url = spawn_tapd_mock().await;
        let name = fetch_workspace_name_with_base(
            &Client::new(),
            &TapdCredentialMaterial {
                credential_type: TapdCredentialType::Basic,
                api_user: Some("api_user".to_string()),
                api_password: Some("api_password".to_string()),
                access_token: None,
            },
            "20358627",
            &base_url,
        )
        .await
        .unwrap();

        assert_eq!(name, "支付平台");
    }

    #[tokio::test]
    async fn maps_tapd_upstream_failures_without_raw_payloads() {
        let base_url = spawn_tapd_mock().await;
        let error = fetch_workspace_name_with_base(
            &Client::new(),
            &TapdCredentialMaterial {
                credential_type: TapdCredentialType::Bearer,
                api_user: None,
                api_password: None,
                access_token: Some("forbidden-token".to_string()),
            },
            "20358627",
            &base_url,
        )
        .await
        .unwrap_err();

        assert_eq!(error.code, "upstream_forbidden");
    }

    #[tokio::test]
    async fn resolves_current_user_from_bearer_token() {
        let base_url = spawn_tapd_mock().await;
        let current_user = resolve_current_user(
            &Client::new(),
            &TapdCredentialMaterial {
                credential_type: TapdCredentialType::Bearer,
                api_user: None,
                api_password: None,
                access_token: Some("access-token".to_string()),
            },
            None,
            &base_url,
        )
        .await;

        assert_eq!(current_user.unwrap().as_deref(), Some("tapd_user"));
    }

    #[tokio::test]
    async fn preserves_bearer_current_user_upstream_errors() {
        let base_url = spawn_tapd_mock().await;
        let error = resolve_current_user(
            &Client::new(),
            &TapdCredentialMaterial {
                credential_type: TapdCredentialType::Bearer,
                api_user: None,
                api_password: None,
                access_token: Some("rate-limited-token".to_string()),
            },
            None,
            &base_url,
        )
        .await
        .unwrap_err();

        assert_eq!(error.code, "upstream_rate_limited");
    }

    #[tokio::test]
    async fn maps_invalid_bearer_current_user_token_to_reauth_required() {
        let base_url = spawn_tapd_mock().await;
        let error = resolve_current_user(
            &Client::new(),
            &TapdCredentialMaterial {
                credential_type: TapdCredentialType::Bearer,
                api_user: None,
                api_password: None,
                access_token: Some("invalid-token".to_string()),
            },
            None,
            &base_url,
        )
        .await
        .unwrap_err();

        assert_eq!(error.code, "reauth_required");
    }

    #[tokio::test]
    async fn keeps_visible_total_based_on_count_after_blocking() {
        let base_url = spawn_tapd_mock().await;
        let response = fetch_defects_with_base(
            &Client::new(),
            &TapdCredentialMaterial {
                credential_type: TapdCredentialType::Bearer,
                api_user: None,
                api_password: None,
                access_token: Some("access-token".to_string()),
            },
            &NormalizedQuery {
                workspace_id: "20358627".to_string(),
                page: 1,
                limit: 100,
                order: "modified desc".to_string(),
                fields: DEFAULT_FIELDS
                    .iter()
                    .map(|value| value.to_string())
                    .collect(),
                visibility_scope: TapdVisibilityScope::Owned,
                current_user: Some("tapd_user".to_string()),
                filters: TapdDefectFilters::default(),
                blocked_bug_ids: HashSet::from(["101".to_string()]),
            },
            &base_url,
        )
        .await
        .unwrap();

        assert_eq!(response.total, 2);
        assert_eq!(response.visible_total, 1);
        assert_eq!(response.items.len(), 1);
        assert_eq!(response.items[0].status, "reopened");
    }

    async fn spawn_tapd_mock() -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let app = axum::Router::new()
            .route("/workspaces/get_workspace_info", get(mock_workspace))
            .route("/users/info", get(mock_user_info))
            .route("/bugs", get(mock_bugs))
            .route("/bugs/count", get(mock_count));
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        format!("http://{addr}")
    }

    async fn mock_workspace(headers: HeaderMap) -> (StatusCode, Json<Value>) {
        let auth = headers
            .get("authorization")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        if auth == "Bearer forbidden-token" {
            return (StatusCode::FORBIDDEN, Json(json!({"status": 0})));
        }
        (
            StatusCode::OK,
            Json(json!({
                "status": 1,
                "data": {
                    "Workspace": {
                        "id": "20358627",
                        "name": "支付平台",
                        "pretty_name": "payment"
                    }
                },
                "info": "success"
            })),
        )
    }

    async fn mock_bugs() -> Json<Value> {
        Json(json!({
            "status": 1,
            "data": [
                {"Bug": {
                    "id": "101",
                    "title": "支付回调失败",
                    "severity": "p0",
                    "priority_label": "P0",
                    "status": "in_progress",
                    "current_owner": "tapd_user",
                    "modified": "2026-05-27 10:00:00"
                }},
                {"Bug": {
                    "id": "102",
                    "title": "已解决不应展示",
                    "severity": "p2",
                    "status": "resolved",
                    "current_owner": "tapd_user",
                    "modified": "2026-05-27 11:00:00"
                }},
                {"Bug": {
                    "id": "103",
                    "title": "重新打开需要处理",
                    "severity": "p1",
                    "status": "reopened",
                    "current_owner": "tapd_user",
                    "modified": "2026-05-27 12:00:00"
                }}
            ]
        }))
    }

    async fn mock_user_info(headers: HeaderMap) -> (StatusCode, Json<Value>) {
        let auth = headers
            .get("authorization")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        if auth == "Bearer rate-limited-token" {
            return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"status": 0})));
        }
        if auth == "Bearer invalid-token" {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({
                    "status": 422,
                    "data": "",
                    "info": "The access token provided is invalid",
                })),
            );
        }
        (
            StatusCode::OK,
            Json(json!({
                "status": 1,
                "data": {
                    "id": "6081",
                    "nick": "tapd_user",
                    "name": "TAPD 用户"
                },
                "info": "success"
            })),
        )
    }

    async fn mock_count() -> Json<Value> {
        Json(json!({"status": 1, "data": {"count": 2}}))
    }
}
