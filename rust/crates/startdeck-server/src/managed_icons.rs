use std::collections::BTreeSet;
use std::path::PathBuf;

use axum::Json;
use axum::body::Body;
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::Response;
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::Utc;
use reqwest::Url;
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::Row;
use uuid::Uuid;

use crate::{
    ApiError, AppState, decode_data_url, extension_for_content_type, icon_content_type_from_path,
    is_blocked_host, normalize_icon_content_type, optional_username_from_headers, require_username,
    validate_remote_url,
};

const MAX_ICON_BYTES: usize = 5 * 1024 * 1024;
const CANONICAL_ICON_PREFIX: &str = "/api/icons/";
const LEGACY_CANONICAL_ICON_PREFIX: &str = "/api/assets/icons/";
const SEED_ICON_PREFIX: &str = "/assets/seed-icons/nav/";
const ICON_ASSET_PREFIX: &str = "icn_";
const META_ICON_PREFIX: &str = "mta_";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum IconVisibility<'a> {
    Private(&'a str),
    Template,
}

#[derive(Clone, Copy, Debug)]
pub(crate) enum IconNormalizationMode {
    PreserveEmpty,
    FillMissingFromUrl,
}

#[derive(Debug, Clone)]
pub(crate) struct ManagedIconCandidate {
    pub id: String,
    pub url: String,
    pub source: String,
    pub label: String,
    pub content_type: String,
    pub background_color: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub reused: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct ManagedIconAsset {
    pub(crate) id: String,
    pub(crate) visibility: String,
    pub(crate) owner_username: Option<String>,
    pub(crate) sha256: String,
    pub(crate) content_type: String,
    pub(crate) lifecycle: String,
}

#[derive(Debug, Clone)]
struct ManagedIconBlob {
    id: String,
    content_type: String,
    byte_size: i64,
    storage_path: String,
}

#[derive(Debug)]
pub(crate) struct MaterializedIcon {
    pub(crate) asset: ManagedIconAsset,
    pub(crate) reused: bool,
}

#[derive(Debug)]
struct IconBytes {
    content_type: String,
    bytes: Vec<u8>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ResolveSiteQuery {
    url: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct CreateIconAssetRequest {
    source: IconSourceRequest,
}

#[derive(Debug, Deserialize)]
struct IconSourceRequest {
    #[serde(rename = "type")]
    kind: String,
    value: String,
}

pub(crate) fn canonical_icon_url(id: &str) -> String {
    format!("{CANONICAL_ICON_PREFIX}{id}")
}

pub(crate) fn meta_icon_id(site_url: &str) -> Result<String, ApiError> {
    let normalized = normalize_site_url(site_url)?;
    Ok(format!(
        "{META_ICON_PREFIX}{}",
        URL_SAFE_NO_PAD.encode(normalized.as_bytes())
    ))
}

pub(crate) fn is_canonical_icon_url(value: &str) -> bool {
    extract_asset_id(value).is_some()
}

pub(crate) fn is_seed_icon_url(value: &str) -> bool {
    let trimmed = value.trim();
    let Some(name) = trimmed.strip_prefix(SEED_ICON_PREFIX) else {
        return false;
    };
    if name.is_empty() || name.contains('/') || !safe_file_name(name) {
        return false;
    }
    matches!(
        name.rsplit('.')
            .next()
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("svg" | "png" | "webp" | "ico")
    ) && safe_relative_resource_path(trimmed)
}

pub(crate) fn is_meta_icon_url(value: &str) -> bool {
    extract_meta_icon_id(value).is_some()
}

pub(crate) fn normalize_icon_url(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Some(String::new());
    }
    if let Some(id) = extract_asset_id(trimmed) {
        return Some(canonical_icon_url(id));
    }
    if extract_meta_icon_id(trimmed).is_some() {
        return Some(trimmed.to_string());
    }
    if is_seed_icon_url(trimmed) {
        return Some(trimmed.to_string());
    }
    None
}

pub(crate) fn seed_icon_resource_path(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if is_seed_icon_url(trimmed) {
        Some(trimmed.trim_start_matches('/').to_string())
    } else {
        None
    }
}

pub(crate) async fn validate_meta_icon_ref(value: &str) -> Result<(), ApiError> {
    let Some(id) = extract_meta_icon_id(value) else {
        return Err(ApiError::bad_request("invalid_meta_icon_id"));
    };
    let site_url = decode_meta_icon_id(id)?;
    let parsed = validate_remote_url(&site_url).await?;
    if is_blocked_host(parsed.host_str().unwrap_or_default()).await? {
        return Err(ApiError::forbidden("blocked_host"));
    }
    Ok(())
}

pub(crate) fn extract_asset_id(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    let id = trimmed
        .strip_prefix(CANONICAL_ICON_PREFIX)
        .or_else(|| trimmed.strip_prefix(LEGACY_CANONICAL_ICON_PREFIX))?;
    if is_valid_asset_id(id) {
        Some(id)
    } else {
        None
    }
}

fn extract_meta_icon_id(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    let id = trimmed.strip_prefix(CANONICAL_ICON_PREFIX)?;
    if is_valid_meta_icon_id(id) {
        Some(id)
    } else {
        None
    }
}

fn is_valid_asset_id(id: &str) -> bool {
    id.starts_with(ICON_ASSET_PREFIX)
        && id.len() > ICON_ASSET_PREFIX.len()
        && id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
}

fn is_valid_meta_icon_id(id: &str) -> bool {
    id.starts_with(META_ICON_PREFIX)
        && id.len() > META_ICON_PREFIX.len()
        && id[META_ICON_PREFIX.len()..]
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
}

pub(crate) async fn resolve_site(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ResolveSiteQuery>,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    let normalized_url = normalize_site_url(&query.url)?;
    let metadata = fetch_site_metadata(&state, &normalized_url).await?;
    let title = string_field(&metadata, "title").unwrap_or_default();
    let description = string_field(&metadata, "description").unwrap_or_default();
    let background_color = string_field(&metadata, "backgroundColor").unwrap_or_default();
    let label = if title.is_empty() {
        host_label(&normalized_url)
    } else {
        title.clone()
    };

    let mut candidates = Vec::new();
    if string_field(&metadata, "icon").is_some() {
        let id = meta_icon_id(&normalized_url)?;
        candidates.push(ManagedIconCandidate {
            id: id.clone(),
            url: canonical_icon_url(&id),
            source: "metaserver".to_string(),
            label,
            content_type: String::new(),
            background_color: background_color.clone(),
            width: None,
            height: None,
            reused: true,
        });
    }

    let selected = candidates.first().cloned();
    if selected.is_none() && title.is_empty() && description.is_empty() {
        return Err(ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "no_icon_candidate",
        ));
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "inputUrl": query.url,
            "normalizedUrl": normalized_url,
            "url": normalized_url,
            "title": title,
            "description": description,
            "backgroundColor": background_color,
            "selectedIcon": selected.as_ref().map(candidate_to_value),
            "iconCandidates": candidates.iter().map(candidate_to_value).collect::<Vec<_>>(),
        }
    })))
}

pub(crate) async fn create_icon_asset(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateIconAssetRequest>,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let source = body.source.kind.trim();
    let value = body.source.value.trim();
    if value.is_empty() {
        return Err(ApiError::bad_request("invalid_source"));
    }
    let materialized = match source {
        "dataUrl" => {
            materialize_data_url(&state, IconVisibility::Private(&username), value).await?
        }
        "remoteUrl" => {
            materialize_remote_url(&state, IconVisibility::Private(&username), value, "upload")
                .await?
        }
        "legacyRef" => {
            materialize_legacy_ref(&state, IconVisibility::Private(&username), value, "legacy")
                .await?
        }
        "assetId" => {
            clone_asset_to_visibility(&state, IconVisibility::Private(&username), value, "asset")
                .await?
        }
        _ => return Err(ApiError::bad_request("invalid_source")),
    };
    Ok(Json(json!({
        "success": true,
        "data": asset_to_value(&materialized.asset, materialized.reused),
    })))
}

pub(crate) async fn get_icon_asset(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<String>,
) -> Result<Response, ApiError> {
    stream_icon(&state, &headers, &id, false).await
}

pub(crate) async fn head_icon_asset(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<String>,
) -> Result<Response, ApiError> {
    stream_icon(&state, &headers, &id, true).await
}

pub(crate) async fn materialize_icon_value(
    state: &AppState,
    visibility: IconVisibility<'_>,
    raw_icon: &str,
    fallback_site_url: Option<&str>,
    mode: IconNormalizationMode,
    source_hint: &str,
) -> Result<Option<MaterializedIcon>, ApiError> {
    let raw = raw_icon.trim();
    if raw.is_empty() {
        if matches!(mode, IconNormalizationMode::FillMissingFromUrl)
            && let Some(site_url) = fallback_site_url
            && let Ok(normalized) = normalize_site_url(site_url)
        {
            return materialize_legacy_ref(
                state,
                visibility,
                &metaserver_site_icon_ref(&normalized),
                "metaserver",
            )
            .await
            .map(Some)
            .or_else(|error| match error.status() {
                StatusCode::NOT_FOUND
                | StatusCode::BAD_GATEWAY
                | StatusCode::FORBIDDEN
                | StatusCode::UNPROCESSABLE_ENTITY => Ok(None),
                _ => Err(error),
            });
        }
        return Ok(None);
    }
    if raw.starts_with("data:") {
        return materialize_data_url(state, visibility, raw).await.map(Some);
    }
    if is_canonical_icon_url(raw) {
        return clone_asset_to_visibility(state, visibility, raw, source_hint)
            .await
            .map(Some);
    }
    if raw.starts_with("http://") || raw.starts_with("https://") {
        return materialize_remote_url(state, visibility, raw, source_hint)
            .await
            .map(Some);
    }
    materialize_legacy_ref(state, visibility, raw, source_hint)
        .await
        .map(Some)
}

pub(crate) async fn mark_orphan_assets(
    state: &AppState,
    ids: &[String],
    lifecycle: &str,
) -> Result<(), ApiError> {
    if ids.is_empty() {
        return Ok(());
    }
    for id in ids {
        sqlx::query("UPDATE managed_icon_assets SET lifecycle = ?, updated_at = ? WHERE id = ?")
            .bind(lifecycle)
            .bind(Utc::now().timestamp_millis())
            .bind(id)
            .execute(&state.pool)
            .await?;
    }
    Ok(())
}

pub(crate) async fn cleanup_failed_assets(state: &AppState) -> Result<(), ApiError> {
    sqlx::query(
        "UPDATE managed_icon_assets SET lifecycle = 'deleted', updated_at = ? WHERE lifecycle IN ('orphan', 'staged_failed')",
    )
    .bind(Utc::now().timestamp_millis())
    .execute(&state.pool)
    .await?;
    Ok(())
}

pub(crate) async fn cleanup_unreferenced_private_icons(
    state: &AppState,
    username: &str,
) -> Result<(), ApiError> {
    let asset_rows = sqlx::query(
        r#"SELECT id
           FROM managed_icon_assets
           WHERE visibility = 'private'
             AND owner_username = ?
             AND lifecycle = 'active'"#,
    )
    .bind(username)
    .fetch_all(&state.pool)
    .await?;
    if asset_rows.is_empty() {
        return Ok(());
    }

    let mut referenced = BTreeSet::new();
    let nav_rows = sqlx::query(
        r#"SELECT icon, metadata_json
           FROM nav_items
           WHERE username = ?"#,
    )
    .bind(username)
    .fetch_all(&state.pool)
    .await?;
    for row in nav_rows {
        collect_icon_asset_id_from_string(&row.get::<String, _>("icon"), &mut referenced);
        collect_icon_asset_ids_from_json_text(
            &row.get::<String, _>("metadata_json"),
            &mut referenced,
        );
    }

    let version_rows = sqlx::query(
        r#"SELECT snapshot_json
           FROM config_versions
           WHERE username = ?"#,
    )
    .bind(username)
    .fetch_all(&state.pool)
    .await?;
    for row in version_rows {
        collect_icon_asset_ids_from_json_text(
            &row.get::<String, _>("snapshot_json"),
            &mut referenced,
        );
    }

    let now = Utc::now().timestamp_millis();
    for row in asset_rows {
        let id = row.get::<String, _>("id");
        if referenced.contains(&id) {
            continue;
        }
        sqlx::query(
            r#"UPDATE managed_icon_assets
               SET lifecycle = 'deleted', updated_at = ?
               WHERE id = ?
                 AND visibility = 'private'
                 AND owner_username = ?"#,
        )
        .bind(now)
        .bind(id)
        .bind(username)
        .execute(&state.pool)
        .await?;
    }

    remove_inactive_blob_files(state).await?;
    Ok(())
}

async fn stream_icon(
    state: &AppState,
    headers: &HeaderMap,
    id: &str,
    head_only: bool,
) -> Result<Response, ApiError> {
    if is_valid_asset_id(id) {
        return stream_icon_asset(state, headers, id, head_only).await;
    }
    if is_valid_meta_icon_id(id) {
        return stream_meta_icon(state, headers, id, head_only).await;
    }
    Err(ApiError::bad_request("invalid_icon_id"))
}

async fn stream_icon_asset(
    state: &AppState,
    headers: &HeaderMap,
    id: &str,
    head_only: bool,
) -> Result<Response, ApiError> {
    if !is_valid_asset_id(id) {
        return Err(ApiError::bad_request("invalid_asset_id"));
    }
    if !hotlink_allowed(headers) {
        return Err(ApiError::forbidden("hotlink_denied"));
    }
    let (asset, blob) = load_asset_and_blob(state, id).await?;
    if asset.lifecycle != "active" {
        return Err(ApiError::new(StatusCode::GONE, "asset_deleted"));
    }
    match asset.visibility.as_str() {
        "template" => {}
        "private" => {
            let Some(username) = optional_username_from_headers(headers, state)? else {
                return Err(ApiError::unauthorized("invalid_token"));
            };
            if asset.owner_username.as_deref() != Some(username.as_str()) {
                return Err(ApiError::forbidden("permission_denied"));
            }
        }
        _ => return Err(ApiError::forbidden("permission_denied")),
    }

    let path = blob_path(state, &blob.storage_path);
    let bytes = if head_only {
        Vec::new()
    } else {
        tokio::fs::read(&path)
            .await
            .map_err(|_| ApiError::new(StatusCode::GONE, "blob_missing"))?
    };
    if head_only && !path.is_file() {
        return Err(ApiError::new(StatusCode::GONE, "blob_missing"));
    }
    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&blob.content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    let cache_control = if asset.visibility == "template" {
        "public, max-age=86400"
    } else {
        "private, max-age=86400"
    };
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(cache_control),
    );
    if let Ok(value) = HeaderValue::from_str(&blob.byte_size.to_string()) {
        response.headers_mut().insert(header::CONTENT_LENGTH, value);
    }
    Ok(response)
}

async fn stream_meta_icon(
    state: &AppState,
    headers: &HeaderMap,
    id: &str,
    head_only: bool,
) -> Result<Response, ApiError> {
    if !hotlink_allowed(headers) {
        return Err(ApiError::forbidden("hotlink_denied"));
    }
    let site_url = decode_meta_icon_id(id)?;
    let parsed = validate_remote_url(&site_url).await?;
    if is_blocked_host(parsed.host_str().unwrap_or_default()).await? {
        return Err(ApiError::forbidden("blocked_host"));
    }
    let icon_url = Url::parse(state.meta_server_base.as_str())
        .and_then(|base| base.join(&metaserver_site_icon_ref(parsed.as_str())))
        .map_err(|_| ApiError::bad_gateway("metaserver_unavailable"))?;
    let icon = fetch_icon_bytes(state, icon_url).await?;
    let byte_size = icon.bytes.len();
    let mut response = Response::new(if head_only {
        Body::empty()
    } else {
        Body::from(icon.bytes)
    });
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&icon.content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=86400, stale-while-revalidate=604800"),
    );
    if let Ok(value) = HeaderValue::from_str(&byte_size.to_string()) {
        response.headers_mut().insert(header::CONTENT_LENGTH, value);
    }
    Ok(response)
}

async fn fetch_site_metadata(state: &AppState, url: &str) -> Result<Value, ApiError> {
    let response = state
        .http
        .get(format!("{}/api/site/metadata", state.meta_server_base))
        .query(&[("url", url)])
        .send()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    if !response.status().is_success() {
        return Err(ApiError::bad_gateway("metaserver_unavailable"));
    }
    let payload: Value = response
        .json()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    if payload.get("code").and_then(Value::as_i64) != Some(200) {
        return Err(ApiError::bad_gateway("resolve_failed"));
    }
    Ok(payload.get("data").cloned().unwrap_or_else(|| json!({})))
}

async fn materialize_data_url(
    state: &AppState,
    visibility: IconVisibility<'_>,
    raw: &str,
) -> Result<MaterializedIcon, ApiError> {
    let (content_type, bytes) = decode_data_url(raw)?;
    let icon = validate_icon_bytes(content_type, bytes)?;
    create_asset_from_bytes(state, visibility, icon, "upload", "dataUrl").await
}

async fn materialize_remote_url(
    state: &AppState,
    visibility: IconVisibility<'_>,
    raw: &str,
    source_hint: &str,
) -> Result<MaterializedIcon, ApiError> {
    let parsed = validate_remote_url(raw).await?;
    if is_blocked_host(parsed.host_str().unwrap_or_default()).await? {
        return Err(ApiError::forbidden("blocked_host"));
    }
    let icon = fetch_icon_bytes(state, parsed).await?;
    create_asset_from_bytes(state, visibility, icon, source_hint, raw).await
}

async fn materialize_legacy_ref(
    state: &AppState,
    visibility: IconVisibility<'_>,
    raw: &str,
    source_hint: &str,
) -> Result<MaterializedIcon, ApiError> {
    let icon = resolve_legacy_ref_bytes(state, raw).await?;
    create_asset_from_bytes(state, visibility, icon, source_hint, raw).await
}

async fn clone_asset_to_visibility(
    state: &AppState,
    visibility: IconVisibility<'_>,
    raw: &str,
    source_hint: &str,
) -> Result<MaterializedIcon, ApiError> {
    let id = extract_asset_id(raw)
        .or_else(|| {
            raw.strip_prefix(ICON_ASSET_PREFIX)
                .filter(|value| is_valid_asset_id(value))
        })
        .unwrap_or(raw.trim());
    if !is_valid_asset_id(id) {
        return Err(ApiError::bad_request("invalid_asset_id"));
    }
    let (asset, blob) = load_asset_and_blob(state, id).await?;
    if asset.lifecycle != "active" {
        return Err(ApiError::new(StatusCode::GONE, "asset_deleted"));
    }
    match visibility {
        IconVisibility::Private(owner) => {
            if asset.visibility == "private" && asset.owner_username.as_deref() == Some(owner) {
                return Ok(MaterializedIcon {
                    asset,
                    reused: true,
                });
            }
        }
        IconVisibility::Template => {
            if asset.visibility == "template" {
                return Ok(MaterializedIcon {
                    asset,
                    reused: true,
                });
            }
            if asset.visibility == "private" && asset.owner_username.as_deref() != Some("admin") {
                return Err(ApiError::forbidden("permission_denied"));
            }
        }
    }
    create_asset_record_for_blob(state, visibility, &asset.sha256, &blob, source_hint, id).await
}

async fn resolve_legacy_ref_bytes(state: &AppState, raw: &str) -> Result<IconBytes, ApiError> {
    let trimmed = raw.trim();
    if trimmed.starts_with("/icon-cache/") || trimmed.starts_with("icon-cache/") {
        let name = trimmed
            .trim_start_matches('/')
            .strip_prefix("icon-cache/")
            .unwrap_or_default();
        if !safe_file_name(name) {
            return Err(ApiError::bad_request("invalid_legacy_ref"));
        }
        let path = state.config.icon_cache_dir.join(name);
        let bytes = tokio::fs::read(&path)
            .await
            .map_err(|_| ApiError::not_found("asset_not_found"))?;
        let content_type = icon_content_type_from_path(name)
            .unwrap_or_else(|| "application/octet-stream".to_string());
        return validate_icon_bytes(content_type, bytes);
    }

    let path = if trimmed.starts_with("/api/site/icon")
        || trimmed.starts_with("/icons/")
        || trimmed.starts_with("/cache/")
    {
        trimmed.to_string()
    } else if trimmed.starts_with("icons/") || trimmed.starts_with("cache/") {
        format!("/{trimmed}")
    } else {
        return Err(ApiError::bad_request("invalid_legacy_ref"));
    };
    let url = Url::parse(state.meta_server_base.as_str())
        .and_then(|base| base.join(&path))
        .map_err(|_| ApiError::bad_request("invalid_legacy_ref"))?;
    fetch_icon_bytes(state, url).await
}

async fn fetch_icon_bytes(state: &AppState, url: Url) -> Result<IconBytes, ApiError> {
    let response = state
        .http
        .get(url.clone())
        .send()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    if response.status() == StatusCode::NOT_FOUND {
        return Err(ApiError::not_found("asset_not_found"));
    }
    if !response.status().is_success() {
        return Err(ApiError::bad_gateway("fetch_failed"));
    }
    if response
        .content_length()
        .map(|length| length > MAX_ICON_BYTES as u64)
        .unwrap_or(false)
    {
        return Err(ApiError::new(
            StatusCode::PAYLOAD_TOO_LARGE,
            "icon_too_large",
        ));
    }
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(normalize_icon_content_type)
        .or_else(|| icon_content_type_from_path(url.path()))
        .unwrap_or_else(|| "application/octet-stream".to_string());
    let bytes = response
        .bytes()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?
        .to_vec();
    validate_icon_bytes(content_type, bytes)
}

fn validate_icon_bytes(content_type: String, bytes: Vec<u8>) -> Result<IconBytes, ApiError> {
    if bytes.len() > MAX_ICON_BYTES {
        return Err(ApiError::new(
            StatusCode::PAYLOAD_TOO_LARGE,
            "icon_too_large",
        ));
    }
    let sniffed = sniff_icon_content_type(&bytes)
        .or_else(|| Some(normalize_icon_content_type(&content_type)))
        .unwrap_or_else(|| "application/octet-stream".to_string());
    if extension_for_content_type(&sniffed).is_none() {
        return Err(ApiError::new(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "unsupported_icon_type",
        ));
    }
    if sniffed == "image/svg+xml" && svg_has_active_content(&bytes) {
        return Err(ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "unsafe_svg",
        ));
    }
    Ok(IconBytes {
        content_type: sniffed,
        bytes,
    })
}

async fn create_asset_from_bytes(
    state: &AppState,
    visibility: IconVisibility<'_>,
    icon: IconBytes,
    source_kind: &str,
    source_ref: &str,
) -> Result<MaterializedIcon, ApiError> {
    let hash = format!("{:x}", Sha256::digest(&icon.bytes));
    let ext = extension_for_content_type(&icon.content_type).unwrap_or(".bin");
    let blob_id = format!("blob_{hash}");
    let storage_path = format!("managed-icons/{hash}{ext}");
    let abs_path = blob_path(state, &storage_path);
    if let Some(parent) = abs_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    if !abs_path.exists() {
        tokio::fs::write(&abs_path, &icon.bytes).await?;
    }
    let now = Utc::now().timestamp_millis();
    sqlx::query(
        r#"INSERT INTO managed_icon_blobs(id, sha256, content_type, byte_size, storage_path, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(sha256) DO UPDATE SET
             content_type=excluded.content_type,
             byte_size=excluded.byte_size,
             storage_path=excluded.storage_path"#,
    )
    .bind(&blob_id)
    .bind(&hash)
    .bind(&icon.content_type)
    .bind(icon.bytes.len() as i64)
    .bind(&storage_path)
    .bind(now)
    .execute(&state.pool)
    .await?;
    let blob = ManagedIconBlob {
        id: blob_id,
        content_type: icon.content_type,
        byte_size: icon.bytes.len() as i64,
        storage_path,
    };
    create_asset_record_for_blob(state, visibility, &hash, &blob, source_kind, source_ref).await
}

async fn create_asset_record_for_blob(
    state: &AppState,
    visibility: IconVisibility<'_>,
    sha256: &str,
    blob: &ManagedIconBlob,
    source_kind: &str,
    source_ref: &str,
) -> Result<MaterializedIcon, ApiError> {
    let (visibility_text, owner) = match visibility {
        IconVisibility::Private(owner) => ("private", Some(owner.to_string())),
        IconVisibility::Template => ("template", None),
    };
    if let Some(row) = sqlx::query(
        r#"SELECT id, visibility, owner_username, blob_id, sha256, content_type, lifecycle
           FROM managed_icon_assets
           WHERE visibility = ?
             AND COALESCE(owner_username, '') = COALESCE(?, '')
             AND sha256 = ?
             AND lifecycle = 'active'
           ORDER BY created_at ASC
           LIMIT 1"#,
    )
    .bind(visibility_text)
    .bind(owner.as_deref())
    .bind(sha256)
    .fetch_optional(&state.pool)
    .await?
    {
        return Ok(MaterializedIcon {
            asset: row_to_asset(row),
            reused: true,
        });
    }
    let id = new_asset_id();
    let now = Utc::now().timestamp_millis();
    sqlx::query(
        r#"INSERT INTO managed_icon_assets(
             id, visibility, owner_username, blob_id, source_kind, source_ref,
             sha256, content_type, lifecycle, created_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)"#,
    )
    .bind(&id)
    .bind(visibility_text)
    .bind(owner.as_deref())
    .bind(&blob.id)
    .bind(source_kind)
    .bind(source_ref)
    .bind(sha256)
    .bind(&blob.content_type)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await?;
    Ok(MaterializedIcon {
        asset: ManagedIconAsset {
            id,
            visibility: visibility_text.to_string(),
            owner_username: owner,
            sha256: sha256.to_string(),
            content_type: blob.content_type.clone(),
            lifecycle: "active".to_string(),
        },
        reused: false,
    })
}

async fn load_asset_and_blob(
    state: &AppState,
    id: &str,
) -> Result<(ManagedIconAsset, ManagedIconBlob), ApiError> {
    let Some(row) = sqlx::query(
        r#"SELECT
             a.id AS asset_id, a.visibility, a.owner_username, a.blob_id,
             a.sha256, a.content_type AS asset_content_type, a.lifecycle,
             b.id AS blob_id, b.content_type AS blob_content_type,
             b.byte_size, b.storage_path
           FROM managed_icon_assets a
           JOIN managed_icon_blobs b ON b.id = a.blob_id
           WHERE a.id = ?"#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    else {
        return Err(ApiError::not_found("asset_not_found"));
    };
    Ok((
        ManagedIconAsset {
            id: row.get("asset_id"),
            visibility: row.get("visibility"),
            owner_username: row.get("owner_username"),
            sha256: row.get("sha256"),
            content_type: row.get("asset_content_type"),
            lifecycle: row.get("lifecycle"),
        },
        ManagedIconBlob {
            id: row.get("blob_id"),
            content_type: row.get("blob_content_type"),
            byte_size: row.get("byte_size"),
            storage_path: row.get("storage_path"),
        },
    ))
}

fn row_to_asset(row: sqlx::sqlite::SqliteRow) -> ManagedIconAsset {
    ManagedIconAsset {
        id: row.get("id"),
        visibility: row.get("visibility"),
        owner_username: row.get("owner_username"),
        sha256: row.get("sha256"),
        content_type: row.get("content_type"),
        lifecycle: row.get("lifecycle"),
    }
}

fn asset_to_value(asset: &ManagedIconAsset, reused: bool) -> Value {
    json!({
        "assetId": asset.id,
        "id": asset.id,
        "url": canonical_icon_url(&asset.id),
        "visibility": asset.visibility,
        "owner": asset.owner_username,
        "contentType": asset.content_type,
        "sha256": asset.sha256,
        "reused": reused,
    })
}

fn candidate_to_value(candidate: &ManagedIconCandidate) -> Value {
    json!({
        "assetId": candidate.id,
        "id": candidate.id,
        "url": candidate.url,
        "source": candidate.source,
        "label": candidate.label,
        "contentType": candidate.content_type,
        "backgroundColor": candidate.background_color,
        "width": candidate.width,
        "height": candidate.height,
        "reused": candidate.reused,
    })
}

fn normalize_site_url(raw: &str) -> Result<String, ApiError> {
    let raw = raw.trim();
    if raw.is_empty() {
        return Err(ApiError::bad_request("missing_url"));
    }
    let with_scheme = if raw.starts_with("http://") || raw.starts_with("https://") {
        raw.to_string()
    } else {
        format!("https://{raw}")
    };
    let parsed = Url::parse(&with_scheme).map_err(|_| ApiError::bad_request("invalid_url"))?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err(ApiError::bad_request("invalid_url"));
    }
    let mut normalized = parsed;
    normalized.set_fragment(None);
    Ok(normalized.to_string())
}

fn metaserver_site_icon_ref(site_url: &str) -> String {
    let parsed =
        Url::parse_with_params("http://startdeck.local/api/site/icon", [("url", site_url)])
            .expect("static metaserver icon route");
    format!("/api/site/icon?{}", parsed.query().unwrap_or_default())
}

fn decode_meta_icon_id(id: &str) -> Result<String, ApiError> {
    if !is_valid_meta_icon_id(id) {
        return Err(ApiError::bad_request("invalid_meta_icon_id"));
    }
    let encoded = &id[META_ICON_PREFIX.len()..];
    let bytes = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|_| ApiError::bad_request("invalid_meta_icon_id"))?;
    let decoded =
        String::from_utf8(bytes).map_err(|_| ApiError::bad_request("invalid_meta_icon_id"))?;
    normalize_site_url(&decoded)
}

fn host_label(site_url: &str) -> String {
    Url::parse(site_url)
        .ok()
        .and_then(|url| url.host_str().map(ToOwned::to_owned))
        .unwrap_or_else(|| "site".to_string())
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn sniff_icon_content_type(bytes: &[u8]) -> Option<String> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some("image/png".to_string());
    }
    if bytes.starts_with(b"\xff\xd8\xff") {
        return Some("image/jpeg".to_string());
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("image/gif".to_string());
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some("image/webp".to_string());
    }
    if bytes.starts_with(b"\x00\x00\x01\x00") {
        return Some("image/x-icon".to_string());
    }
    if let Ok(text) = std::str::from_utf8(bytes) {
        let trimmed = text.trim_start_matches('\u{feff}').trim_start();
        if trimmed.starts_with("<svg") || trimmed.starts_with("<?xml") {
            return Some("image/svg+xml".to_string());
        }
    }
    None
}

fn svg_has_active_content(bytes: &[u8]) -> bool {
    let Ok(text) = std::str::from_utf8(bytes) else {
        return true;
    };
    let lower = text.to_ascii_lowercase();
    lower.contains("<script")
        || lower.contains("<foreignobject")
        || lower.contains("javascript:")
        || lower.contains(" onload=")
        || lower.contains(" onclick=")
        || lower.contains(" onerror=")
        || lower.contains(" onmouseover=")
        || lower.contains(" href=\"http")
        || lower.contains(" href='http")
        || lower.contains("xlink:href=\"http")
        || lower.contains("xlink:href='http")
}

fn collect_icon_asset_id_from_string(value: &str, out: &mut BTreeSet<String>) {
    if let Some(id) = extract_asset_id(value) {
        out.insert(id.to_string());
    }
}

fn collect_icon_asset_ids_from_json_text(value: &str, out: &mut BTreeSet<String>) {
    let Ok(json) = serde_json::from_str::<Value>(value) else {
        return;
    };
    collect_icon_asset_ids_from_value(&json, out);
}

fn collect_icon_asset_ids_from_value(value: &Value, out: &mut BTreeSet<String>) {
    match value {
        Value::String(text) => collect_icon_asset_id_from_string(text, out),
        Value::Array(values) => {
            for value in values {
                collect_icon_asset_ids_from_value(value, out);
            }
        }
        Value::Object(map) => {
            for value in map.values() {
                collect_icon_asset_ids_from_value(value, out);
            }
        }
        _ => {}
    }
}

fn safe_file_name(name: &str) -> bool {
    !name.is_empty()
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains(':')
        && !name.contains("..")
}

fn safe_relative_resource_path(path: &str) -> bool {
    let path = path.trim();
    path.starts_with('/')
        && !path.contains('\\')
        && !path.contains(':')
        && !path.split('/').any(|part| part == "..")
}

fn blob_path(state: &AppState, storage_path: &str) -> PathBuf {
    state.config.data_dir.join(storage_path)
}

async fn remove_inactive_blob_files(state: &AppState) -> Result<(), ApiError> {
    let rows = sqlx::query(
        r#"SELECT storage_path
           FROM managed_icon_blobs b
           WHERE NOT EXISTS (
             SELECT 1
             FROM managed_icon_assets a
             WHERE a.blob_id = b.id
               AND a.lifecycle = 'active'
           )"#,
    )
    .fetch_all(&state.pool)
    .await?;
    for row in rows {
        let storage_path = row.get::<String, _>("storage_path");
        if !safe_relative_storage_path(&storage_path) {
            continue;
        }
        let path = blob_path(state, &storage_path);
        if path.is_file() {
            match tokio::fs::remove_file(&path).await {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(error.into()),
            }
        }
    }
    Ok(())
}

fn safe_relative_storage_path(path: &str) -> bool {
    let path = path.trim();
    !path.is_empty()
        && !path.starts_with('/')
        && !path.contains('\\')
        && !path.contains(':')
        && !path.split('/').any(|part| part.is_empty() || part == "..")
}

fn new_asset_id() -> String {
    format!("{ICON_ASSET_PREFIX}{}", Uuid::new_v4().simple())
}

fn hotlink_allowed(headers: &HeaderMap) -> bool {
    let host = headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(':').next())
        .unwrap_or("")
        .to_ascii_lowercase();
    if host.is_empty() {
        return true;
    }
    for name in [header::ORIGIN, header::REFERER] {
        let Some(value) = headers.get(name).and_then(|value| value.to_str().ok()) else {
            continue;
        };
        let Ok(parsed) = Url::parse(value) else {
            return false;
        };
        let source_host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
        if source_host != host {
            return false;
        }
    }
    true
}
