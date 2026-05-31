use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, get_service, post};
use axum::{Json, Router};
use chrono::Utc;
use reqwest::{Client, Url};
use scraper::{Html, Selector};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use startdeck_core::models::IconRecord;
use startdeck_core::{RuntimeConfig, icon_record, upsert_icon_record};
use tokio::fs;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
pub struct MetaState {
    config: Arc<RuntimeConfig>,
    pool: SqlitePool,
    http: Client,
    public_meta_base_url: Arc<String>,
    microlink_api_url: Arc<String>,
}

impl MetaState {
    pub fn new(config: RuntimeConfig, pool: SqlitePool) -> Self {
        Self {
            config: Arc::new(config),
            pool,
            http: Client::builder()
                .timeout(meta_server_timeout())
                .user_agent("StartDeck-MetaServer-Rust/1.0")
                .build()
                .expect("reqwest client"),
            public_meta_base_url: Arc::new(
                std::env::var("PUBLIC_META_BASE_URL").unwrap_or_default(),
            ),
            microlink_api_url: Arc::new(
                std::env::var("META_SERVER_MICROLINK_API_URL")
                    .unwrap_or_else(|_| "https://api.microlink.io".to_string())
                    .trim_end_matches('/')
                    .to_string(),
            ),
        }
    }

    pub fn with_microlink_api_url(mut self, url: impl Into<String>) -> Self {
        self.microlink_api_url = Arc::new(url.into().trim_end_matches('/').to_string());
        self
    }

    pub fn with_public_meta_base_url(mut self, url: impl Into<String>) -> Self {
        self.public_meta_base_url = Arc::new(url.into().trim_end_matches('/').to_string());
        self
    }
}

fn meta_server_timeout() -> Duration {
    meta_server_timeout_from_value(std::env::var("META_SERVER_TIMEOUT_MS").ok())
}

fn meta_server_timeout_from_value(value: Option<String>) -> Duration {
    let millis = value
        .as_deref()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_META_SERVER_TIMEOUT_MS);
    Duration::from_millis(millis)
}

pub fn meta_addr_from_env() -> String {
    if let Ok(addr) = std::env::var("META_SERVER_ADDR")
        && !addr.trim().is_empty()
    {
        return addr;
    }
    let host = std::env::var("META_SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("META_SERVER_PORT").unwrap_or_else(|_| "9002".to_string());
    format!("{host}:{port}")
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct NormalizedSiteTarget {
    url: Url,
    host: String,
}

const FETCH_STATUS_OK: &str = "ok";
const FETCH_STATUS_NO_ICON: &str = "no_icon";
const FETCH_STATUS_BLOCKED: &str = "blocked";
const FETCH_STATUS_ERROR: &str = "error";
const NO_ICON_TTL_MS: i64 = 24 * 60 * 60 * 1000;
const ERROR_INITIAL_RETRY_MS: i64 = 3 * 1000;
const ERROR_MAX_RETRY_MS: i64 = 60 * 60 * 1000;
const DEFAULT_META_SERVER_TIMEOUT_MS: u64 = 20_000;

#[derive(Clone, Debug)]
struct FetchFailure {
    status: &'static str,
    kind: String,
    message: String,
}

impl FetchFailure {
    fn no_icon(kind: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            status: FETCH_STATUS_NO_ICON,
            kind: kind.into(),
            message: message.into(),
        }
    }

    fn blocked(kind: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            status: FETCH_STATUS_BLOCKED,
            kind: kind.into(),
            message: message.into(),
        }
    }

    fn temporary(kind: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            status: FETCH_STATUS_ERROR,
            kind: kind.into(),
            message: message.into(),
        }
    }

    fn priority(&self) -> u8 {
        match self.status {
            FETCH_STATUS_BLOCKED => 3,
            FETCH_STATUS_ERROR => 2,
            FETCH_STATUS_NO_ICON => 1,
            _ => 0,
        }
    }
}

pub fn app(state: MetaState) -> Router {
    let icon_dir = state.config.meta_server_data_dir.join("icons");
    let meta_resource_dir = state.config.meta_server_resource_dir.join("icons");
    let cache_dir = state.config.meta_server_data_dir.join("cache");
    Router::new()
        .route("/healthz", get(healthz))
        .route("/api/icon", get(lookup_icon))
        .route("/api/site/metadata", get(site_metadata))
        .route("/api/site/icon", get(site_icon))
        .route("/api/icon/refresh", post(refresh_icon))
        .route("/api/icon/cache", delete(delete_icon_cache))
        .nest_service(
            "/icons",
            get_service(ServeDir::new(icon_dir).fallback(ServeDir::new(meta_resource_dir))),
        )
        .nest_service("/cache", get_service(ServeDir::new(cache_dir)))
        .fallback(not_found)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state)
}

async fn healthz() -> Json<Value> {
    Json(json!({"code": 200, "msg": "ok"}))
}

async fn lookup_icon(
    State(state): State<MetaState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    let target = normalize_query_target(
        &query,
        &["host", "url"],
        "host_or_url_required",
        "invalid_host",
    )?;
    let record = get_or_fetch_record(&state, &target).await?;
    Ok(Json(
        json!({"code": 200, "data": icon_response_data(&state, &record), "msg": "ok"}),
    ))
}

async fn site_metadata(
    State(state): State<MetaState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    let target = normalize_query_target(&query, &["url"], "url_required", "invalid_url")?;
    let record = get_or_fetch_record(&state, &target).await?;
    let icon_url = public_site_icon_url(&state, &record);
    Ok(Json(json!({
        "code": 200,
        "data": {
            "url": record.url,
            "finalUrl": record.final_url,
            "title": empty_to_null(&record.title),
            "name": empty_to_null(&record.title),
            "icon": icon_url.clone(),
            "iconUrl": icon_url,
            "description": empty_to_null(&record.description),
            "backgroundColor": empty_to_null(&record.background_color),
            "fetchedAt": record.fetched_at.to_rfc3339(),
            "fetchStatus": &record.fetch_status,
            "failureKind": empty_to_null(&record.failure_kind),
            "retryAfter": retry_after_json(record.retry_after)
        },
        "msg": "ok"
    })))
}

async fn site_icon(
    State(state): State<MetaState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Response, IconError> {
    let target = normalize_query_target(&query, &["url", "host"], "url_required", "invalid_url")?;
    let record = get_or_fetch_record(&state, &target).await?;
    let icon = record
        .icon
        .clone()
        .ok_or_else(|| icon_record_missing_error(&record))?;
    if let Some(local) = resolve_local_icon(&state, &icon) {
        let bytes = fs::read(&local)
            .await
            .map_err(|_| IconError::not_found("icon_not_found"))?;
        return Ok(bytes_response(
            bytes,
            mime_guess::from_path(local)
                .first_or_octet_stream()
                .as_ref(),
        ));
    }
    let remote_icon_url =
        parse_http_url(&icon).ok_or_else(|| IconError::not_found("icon_not_found"))?;
    let response = state
        .http
        .get(remote_icon_url)
        .send()
        .await
        .map_err(|err| IconError::bad_gateway(err.to_string()))?;
    if !response.status().is_success() {
        return Err(IconError::bad_gateway("remote_icon_fetch_failed"));
    }
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| IconError::bad_gateway(err.to_string()))?;
    Ok(bytes_response(bytes.to_vec(), &content_type))
}

async fn refresh_icon(
    State(state): State<MetaState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    let target = normalize_query_target(
        &query,
        &["host", "url"],
        "host_or_url_required",
        "invalid_host",
    )?;
    let record = fetch_remote_record(&state, &target, None).await?;
    upsert_icon_record(&state.pool, &record).await?;
    Ok(Json(
        json!({"code": 200, "data": icon_response_data(&state, &record), "msg": "ok"}),
    ))
}

async fn delete_icon_cache(
    State(state): State<MetaState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    sqlx::query("DELETE FROM icon_records WHERE host = ? AND source != 'seed'")
        .bind(
            normalize_query_target(
                &query,
                &["host", "url"],
                "host_or_url_required",
                "invalid_host",
            )?
            .host,
        )
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({"code": 200, "msg": "ok"})))
}

async fn not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(json!({"code": 404, "msg": "not found"})),
    )
        .into_response()
}

async fn get_or_fetch_record(
    state: &MetaState,
    target: &NormalizedSiteTarget,
) -> Result<IconRecord, IconError> {
    if let Some(record) = icon_record(&state.pool, &target.host).await? {
        if should_refresh_record(state, &record) {
            let refreshed = fetch_remote_record(state, target, Some(&record)).await?;
            upsert_icon_record(&state.pool, &refreshed).await?;
            return Ok(refreshed);
        }
        return Ok(record);
    }
    let record = fetch_remote_record(state, target, None).await?;
    upsert_icon_record(&state.pool, &record).await?;
    Ok(record)
}

async fn fetch_remote_record(
    state: &MetaState,
    target: &NormalizedSiteTarget,
    previous: Option<&IconRecord>,
) -> Result<IconRecord, IconError> {
    match fetch_microlink_record(state, &target.url, &target.host).await {
        Ok(record) => return Ok(record),
        Err(err) => tracing::debug!(
            host = %target.host,
            status = %err.status,
            error = %err.message,
            "microlink metadata lookup failed; falling back to direct HTML discovery"
        ),
    }
    match fetch_html_record(state, target, previous).await {
        Ok(record) => Ok(record),
        Err(failure) => Ok(failure_record(
            target,
            "remote",
            target.host.clone(),
            target.url.to_string(),
            String::new(),
            previous,
            failure,
        )),
    }
}

async fn fetch_microlink_record(
    state: &MetaState,
    url: &Url,
    host: &str,
) -> Result<IconRecord, FetchFailure> {
    if state.microlink_api_url.trim().is_empty() {
        return Err(FetchFailure::temporary(
            "microlink_disabled",
            "microlink_disabled",
        ));
    }
    let response = state
        .http
        .get(state.microlink_api_url.as_str())
        .query(&[("url", url.as_str())])
        .send()
        .await
        .map_err(|err| FetchFailure::temporary("microlink_fetch_failed", err.to_string()))?;
    if !response.status().is_success() {
        return Err(FetchFailure::temporary(
            "microlink_fetch_failed",
            "microlink_fetch_failed",
        ));
    }
    let payload = response
        .json::<Value>()
        .await
        .map_err(|err| FetchFailure::temporary("microlink_payload_invalid", err.to_string()))?;
    let data = microlink_data_payload(&payload)
        .ok_or_else(|| FetchFailure::temporary("microlink_payload_invalid", "invalid payload"))?;
    if microlink_failed(&payload) {
        return Err(FetchFailure::temporary(
            "microlink_status_failed",
            "microlink_status_failed",
        ));
    }
    let logo_url = nested_string(data, &["logo", "url"])
        .filter(|candidate| parse_http_url(candidate).is_some())
        .ok_or_else(|| FetchFailure::no_icon("microlink_logo_not_found", "logo not found"))?;
    let icon_candidates = vec![logo_url];
    let local_icon = cache_first_available_icon(state, host, &icon_candidates).await?;
    Ok(ok_record(
        host,
        string_value(data, "title").unwrap_or_else(|| host.to_string()),
        url.to_string(),
        string_value(data, "url").unwrap_or_else(|| url.to_string()),
        string_value(data, "description").unwrap_or_default(),
        "microlink",
        Some(local_icon),
    ))
}

async fn fetch_html_record(
    state: &MetaState,
    target: &NormalizedSiteTarget,
    previous: Option<&IconRecord>,
) -> Result<IconRecord, FetchFailure> {
    let response = state
        .http
        .get(target.url.clone())
        .send()
        .await
        .map_err(|err| FetchFailure::temporary("site_fetch_failed", err.to_string()))?;
    let status = response.status();
    let headers = response.headers().clone();
    let final_url = response.url().to_string();
    let html = response
        .text()
        .await
        .map_err(|err| FetchFailure::temporary("site_body_read_failed", err.to_string()))?;
    if is_blocked_response(status, &headers, &html) {
        return Err(FetchFailure::blocked(
            "site_blocked",
            "site blocked by anti-bot challenge",
        ));
    }
    if !status.is_success() {
        return Err(classify_http_response("site", status, &headers, &html));
    }
    let (title, description, icon) = {
        let page = Html::parse_document(&html);
        (
            select_text(&page, "title").unwrap_or_else(|| target.host.to_string()),
            select_meta(&page, "description")
                .or_else(|| select_meta(&page, "og:description"))
                .unwrap_or_default(),
            select_icon_candidates(&page, &final_url),
        )
    };
    if icon.is_empty() {
        return Ok(failure_record(
            target,
            "remote",
            title,
            final_url,
            description,
            previous,
            FetchFailure::no_icon("icon_candidates_empty", "no icon candidates found"),
        ));
    }
    let local_icon = match cache_first_available_icon(state, &target.host, &icon).await {
        Ok(icon) => icon,
        Err(failure) => {
            return Ok(failure_record(
                target,
                "remote",
                title,
                final_url,
                description,
                previous,
                failure,
            ));
        }
    };
    Ok(ok_record(
        &target.host,
        title,
        target.url.to_string(),
        final_url,
        description,
        "remote",
        Some(local_icon),
    ))
}

async fn cache_remote_icon(
    state: &MetaState,
    host: &str,
    icon: &str,
) -> Result<String, FetchFailure> {
    let icon_url = parse_http_url(icon)
        .ok_or_else(|| FetchFailure::no_icon("icon_not_found", "invalid icon url"))?;
    let response = state
        .http
        .get(icon_url)
        .send()
        .await
        .map_err(|err| FetchFailure::temporary("remote_icon_fetch_failed", err.to_string()))?;
    let status = response.status();
    let headers = response.headers().clone();
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| FetchFailure::temporary("remote_icon_body_read_failed", err.to_string()))?;
    if !status.is_success() {
        let body = String::from_utf8_lossy(&bytes);
        return Err(classify_http_response(
            "remote_icon",
            status,
            &headers,
            &body,
        ));
    }
    if is_text_html_content_type(&content_type) {
        let body = String::from_utf8_lossy(&bytes);
        if is_blocked_response(status, &headers, &body) {
            return Err(FetchFailure::blocked(
                "remote_icon_blocked",
                "icon blocked by anti-bot challenge",
            ));
        }
        return Err(FetchFailure::no_icon(
            "remote_icon_not_image",
            "icon candidate returned html",
        ));
    }
    if !is_supported_icon_content_type(&content_type) {
        return Err(FetchFailure::no_icon(
            "unsupported_icon_type",
            "icon candidate returned unsupported content type",
        ));
    }
    let ext = extension_for_content_type(&content_type).unwrap_or_else(|| {
        Path::new(icon)
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| format!(".{value}"))
            .unwrap_or_else(|| ".ico".to_string())
    });
    let mut hasher = Sha256::new();
    hasher.update(host.as_bytes());
    hasher.update(&bytes);
    let filename = format!("{:x}{ext}", hasher.finalize());
    let cache_dir = state.config.meta_server_data_dir.join("cache");
    fs::create_dir_all(&cache_dir)
        .await
        .map_err(|err| FetchFailure::temporary("cache_write_failed", err.to_string()))?;
    fs::write(cache_dir.join(&filename), bytes)
        .await
        .map_err(|err| FetchFailure::temporary("cache_write_failed", err.to_string()))?;
    Ok(format!("cache/{filename}"))
}

async fn cache_first_available_icon(
    state: &MetaState,
    host: &str,
    candidates: &[String],
) -> Result<String, FetchFailure> {
    let mut failure = None::<FetchFailure>;
    for icon in candidates {
        match cache_remote_icon(state, host, icon).await {
            Ok(cached_icon) => return Ok(cached_icon),
            Err(err) => {
                tracing::debug!(
                    host = %host,
                    icon = %icon,
                    status = %err.status,
                    error = %err.message,
                    "failed to cache remote icon candidate"
                );
                failure = Some(select_stronger_failure(failure, err));
            }
        }
    }
    Err(failure.unwrap_or_else(|| FetchFailure::no_icon("icon_not_found", "icon not found")))
}

fn ok_record(
    host: &str,
    title: String,
    url: String,
    final_url: String,
    description: String,
    source: &str,
    icon: Option<String>,
) -> IconRecord {
    IconRecord {
        host: host.to_string(),
        title,
        url,
        final_url,
        description,
        background_color: String::new(),
        icon,
        source: source.to_string(),
        fetch_status: FETCH_STATUS_OK.to_string(),
        failure_kind: String::new(),
        failure_count: 0,
        retry_after: 0,
        last_error: String::new(),
        fetched_at: Utc::now(),
    }
}

fn failure_record(
    target: &NormalizedSiteTarget,
    source: &str,
    title: String,
    final_url: String,
    description: String,
    previous: Option<&IconRecord>,
    failure: FetchFailure,
) -> IconRecord {
    let previous_count = previous
        .filter(|record| record.fetch_status == failure.status)
        .map(|record| record.failure_count)
        .unwrap_or(0);
    let failure_count = if failure.status == FETCH_STATUS_ERROR {
        previous_count + 1
    } else {
        0
    };
    IconRecord {
        host: target.host.clone(),
        title,
        url: target.url.to_string(),
        final_url,
        description,
        background_color: String::new(),
        icon: None,
        source: source.to_string(),
        fetch_status: failure.status.to_string(),
        failure_kind: failure.kind,
        failure_count,
        retry_after: retry_after_for_failure(failure.status, failure_count),
        last_error: failure.message,
        fetched_at: Utc::now(),
    }
}

fn retry_after_for_failure(status: &str, failure_count: i64) -> i64 {
    match status {
        FETCH_STATUS_NO_ICON => Utc::now().timestamp_millis() + NO_ICON_TTL_MS,
        FETCH_STATUS_ERROR => {
            let exponent = failure_count.saturating_sub(1).min(30) as u32;
            let ttl = ERROR_INITIAL_RETRY_MS
                .saturating_mul(2_i64.saturating_pow(exponent))
                .min(ERROR_MAX_RETRY_MS);
            Utc::now().timestamp_millis() + ttl
        }
        _ => 0,
    }
}

fn should_refresh_record(state: &MetaState, record: &IconRecord) -> bool {
    if record
        .icon
        .as_deref()
        .map(|icon| local_icon_reference_missing(state, icon))
        .unwrap_or(false)
    {
        return true;
    }
    match record.fetch_status.as_str() {
        FETCH_STATUS_OK => record.icon.is_none() && record.source != "seed",
        FETCH_STATUS_BLOCKED => false,
        FETCH_STATUS_NO_ICON | FETCH_STATUS_ERROR => {
            record.retry_after <= 0 || Utc::now().timestamp_millis() >= record.retry_after
        }
        _ => true,
    }
}

fn local_icon_reference_missing(state: &MetaState, icon: &str) -> bool {
    let trimmed = normalize_local_icon_reference(icon);
    is_local_icon_reference(&trimmed)
        && parse_http_url(&trimmed).is_none()
        && resolve_local_icon(state, icon).is_none()
}

fn icon_record_missing_error(record: &IconRecord) -> IconError {
    if record.fetch_status == FETCH_STATUS_ERROR {
        IconError::bad_gateway(if record.last_error.trim().is_empty() {
            "icon_fetch_failed"
        } else {
            record.last_error.as_str()
        })
    } else {
        IconError::not_found("icon_not_found")
    }
}

fn select_stronger_failure(current: Option<FetchFailure>, candidate: FetchFailure) -> FetchFailure {
    match current {
        Some(existing) if existing.priority() >= candidate.priority() => existing,
        _ => candidate,
    }
}

fn icon_response_data(state: &MetaState, record: &IconRecord) -> Value {
    let icon_url = public_site_icon_url(state, record);
    json!({
        "url": null_if_empty(&record.url),
        "finalUrl": null_if_empty(&record.final_url),
        "title": null_if_empty(&record.title),
        "name": null_if_empty(&record.title),
        "icon": icon_url.clone(),
        "iconUrl": icon_url,
        "description": null_if_empty(&record.description),
        "backgroundColor": null_if_empty(&record.background_color),
        "fetchedAt": record.fetched_at.to_rfc3339(),
        "fetchStatus": &record.fetch_status,
        "failureKind": null_if_empty(&record.failure_kind),
        "retryAfter": retry_after_json(record.retry_after)
    })
}

fn microlink_data_payload(payload: &Value) -> Option<&Value> {
    payload
        .get("data")
        .filter(|value| value.is_object())
        .or_else(|| payload.is_object().then_some(payload))
}

fn microlink_failed(payload: &Value) -> bool {
    if let Some(status) = payload.get("status").and_then(Value::as_str)
        && !status.eq_ignore_ascii_case("success")
    {
        return true;
    }
    payload
        .get("statusCode")
        .and_then(Value::as_i64)
        .map(|status| status >= 400)
        .unwrap_or(false)
}

fn classify_http_response(
    prefix: &str,
    status: StatusCode,
    headers: &reqwest::header::HeaderMap,
    body: &str,
) -> FetchFailure {
    if is_blocked_response(status, headers, body) {
        return FetchFailure::blocked(
            format!("{prefix}_blocked"),
            format!("{prefix} blocked by anti-bot challenge"),
        );
    }
    classify_http_status(prefix, status)
}

fn classify_http_status(prefix: &str, status: StatusCode) -> FetchFailure {
    let kind = format!("{prefix}_http_{}", status.as_u16());
    if matches!(status.as_u16(), 401 | 403 | 407 | 409 | 423 | 451) {
        return FetchFailure::blocked(kind, format!("{prefix}_blocked"));
    }
    if status.as_u16() == 404 || status.as_u16() == 410 {
        return FetchFailure::no_icon(kind, format!("{prefix}_not_found"));
    }
    if status.is_server_error() || matches!(status.as_u16(), 408 | 429) {
        return FetchFailure::temporary(kind, format!("{prefix}_temporary_failure"));
    }
    FetchFailure::no_icon(kind, format!("{prefix}_not_available"))
}

fn is_blocked_response(
    status: StatusCode,
    headers: &reqwest::header::HeaderMap,
    body: &str,
) -> bool {
    let cf_header = headers.contains_key("cf-ray")
        || headers.contains_key("cf-mitigated")
        || headers
            .get(header::SERVER)
            .and_then(|value| value.to_str().ok())
            .map(|value| value.to_ascii_lowercase().contains("cloudflare"))
            .unwrap_or(false);
    let body = body.to_ascii_lowercase();
    let challenge_body = body.contains("just a moment")
        || body.contains("/cdn-cgi/challenge-platform")
        || body.contains("cf-chl")
        || body.contains("turnstile")
        || body.contains("captcha");
    (cf_header && matches!(status.as_u16(), 403 | 429 | 503)) || challenge_body
}

fn is_text_html_content_type(content_type: &str) -> bool {
    content_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .eq_ignore_ascii_case("text/html")
}

fn is_supported_icon_content_type(content_type: &str) -> bool {
    let essence = content_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    essence.is_empty()
        || essence == "application/octet-stream"
        || essence == "binary/octet-stream"
        || essence.starts_with("image/")
}

fn retry_after_json(value: i64) -> Value {
    if value <= 0 {
        return Value::Null;
    }
    chrono::DateTime::<Utc>::from_timestamp_millis(value)
        .map(|date| Value::String(date.to_rfc3339()))
        .unwrap_or(Value::Null)
}

fn string_value(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn nested_string(value: &Value, path: &[&str]) -> Option<String> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn normalize_query_target(
    query: &HashMap<String, String>,
    keys: &[&str],
    missing_error: &str,
    invalid_error: &str,
) -> Result<NormalizedSiteTarget, IconError> {
    let raw = keys
        .iter()
        .find_map(|key| query.get(*key))
        .ok_or_else(|| IconError::bad_request(missing_error))?;
    normalize_site_target(raw).ok_or_else(|| IconError::bad_request(invalid_error))
}

fn normalize_site_target(raw: &str) -> Option<NormalizedSiteTarget> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }

    let mut url = parse_http_url(raw).or_else(|| {
        if let Ok(parsed) = Url::parse(raw) {
            let scheme = parsed.scheme().to_ascii_lowercase();
            if raw.contains("://")
                || matches!(
                    scheme.as_str(),
                    "about" | "data" | "file" | "javascript" | "mailto"
                )
            {
                return None;
            }
        }
        let candidate = if raw.starts_with("//") {
            format!("https:{raw}")
        } else {
            format!("https://{raw}")
        };
        parse_http_url(&candidate)
    })?;
    url.set_fragment(None);
    let host = url.host_str()?.to_ascii_lowercase();
    Some(NormalizedSiteTarget { url, host })
}

fn parse_http_url(raw: &str) -> Option<Url> {
    let url = Url::parse(raw.trim()).ok()?;
    if matches!(url.scheme(), "http" | "https") && url.host_str().is_some() {
        Some(url)
    } else {
        None
    }
}

fn select_text(page: &Html, selector: &str) -> Option<String> {
    let selector = Selector::parse(selector).ok()?;
    page.select(&selector)
        .next()
        .map(|node| node.text().collect::<String>().trim().to_string())
        .filter(|value| !value.is_empty())
}

fn select_meta(page: &Html, name: &str) -> Option<String> {
    for selector in [
        format!("meta[name=\"{name}\"]"),
        format!("meta[property=\"{name}\"]"),
    ] {
        let selector = Selector::parse(&selector).ok()?;
        if let Some(value) = page
            .select(&selector)
            .next()
            .and_then(|node| node.value().attr("content"))
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return Some(value.to_string());
        }
    }
    None
}

fn select_icon_candidates(page: &Html, final_url: &str) -> Vec<String> {
    let mut candidates = Vec::new();
    let Some(base) = parse_http_url(final_url) else {
        return candidates;
    };
    let Ok(selector) = Selector::parse("link[rel]") else {
        return candidates;
    };
    for node in page.select(&selector) {
        let rel = node
            .value()
            .attr("rel")
            .unwrap_or_default()
            .to_ascii_lowercase();
        if !rel.contains("icon") {
            continue;
        }
        let Some(href) = node
            .value()
            .attr("href")
            .map(str::trim)
            .filter(|href| !href.is_empty())
        else {
            continue;
        };
        if let Ok(url) = base.join(href)
            && parse_http_url(url.as_str()).is_some()
        {
            push_unique_icon_candidate(&mut candidates, url.to_string());
        }
    }
    if let Ok(url) = base.join("/favicon.ico")
        && parse_http_url(url.as_str()).is_some()
    {
        push_unique_icon_candidate(&mut candidates, url.to_string());
    }
    candidates
}

fn push_unique_icon_candidate(candidates: &mut Vec<String>, candidate: String) {
    if !candidates.iter().any(|icon| icon == &candidate) {
        candidates.push(candidate);
    }
}

fn public_site_icon_url(state: &MetaState, record: &IconRecord) -> Option<String> {
    record.icon.as_deref()?;
    let site_url = normalize_site_target(&record.url)
        .or_else(|| normalize_site_target(&record.host))?
        .url
        .to_string();
    let parsed =
        Url::parse_with_params("http://startdeck.local/api/site/icon", [("url", site_url)]).ok()?;
    let icon = format!("/api/site/icon?{}", parsed.query()?);
    if state.public_meta_base_url.is_empty() {
        Some(icon)
    } else {
        Some(format!(
            "{}{}",
            state.public_meta_base_url.trim_end_matches('/'),
            icon
        ))
    }
}

fn resolve_local_icon(state: &MetaState, icon: &str) -> Option<PathBuf> {
    let trimmed = normalize_local_icon_reference(icon);
    if !is_local_icon_reference(&trimmed) {
        return None;
    }
    let candidates = if let Some(name) = trimmed.strip_prefix("icons/") {
        vec![
            state.config.meta_server_data_dir.join("icons").join(name),
            state
                .config
                .meta_server_resource_dir
                .join("icons")
                .join(name),
        ]
    } else if let Some(name) = trimmed.strip_prefix("cache/") {
        vec![state.config.meta_server_data_dir.join("cache").join(name)]
    } else if !trimmed.contains("://") {
        vec![
            state
                .config
                .meta_server_data_dir
                .join("icons")
                .join(&trimmed),
            state
                .config
                .meta_server_resource_dir
                .join("icons")
                .join(trimmed),
        ]
    } else {
        return None;
    };
    candidates.into_iter().find(|path| path.exists())
}

fn is_local_icon_reference(icon: &str) -> bool {
    let trimmed = icon.trim();
    if trimmed.is_empty()
        || trimmed.contains("://")
        || trimmed.contains(':')
        || trimmed.contains('\\')
    {
        return false;
    }
    let path = Path::new(trimmed);
    !path.is_absolute()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

fn normalize_local_icon_reference(icon: &str) -> String {
    let trimmed = icon.trim().trim_start_matches('/');
    if let Some(name) = trimmed.strip_prefix("data/icons/") {
        format!("icons/{name}")
    } else if let Some(name) = trimmed.strip_prefix("data/cache/") {
        format!("cache/{name}")
    } else {
        trimmed.to_string()
    }
}

fn bytes_response(bytes: Vec<u8>, content_type: &str) -> Response {
    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    response
}

fn extension_for_content_type(content_type: &str) -> Option<String> {
    match content_type.split(';').next().unwrap_or_default().trim() {
        "image/png" => Some(".png".to_string()),
        "image/jpeg" => Some(".jpg".to_string()),
        "image/gif" => Some(".gif".to_string()),
        "image/webp" => Some(".webp".to_string()),
        "image/svg+xml" => Some(".svg".to_string()),
        "image/x-icon" | "image/vnd.microsoft.icon" => Some(".ico".to_string()),
        _ => None,
    }
}

fn null_if_empty(value: &str) -> Value {
    if value.trim().is_empty() {
        Value::Null
    } else {
        Value::String(value.to_string())
    }
}

fn empty_to_null(value: &str) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

#[derive(Debug)]
pub struct IconError {
    status: StatusCode,
    message: String,
}

impl IconError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }

    fn bad_gateway(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            message: message.into(),
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: message.into(),
        }
    }
}

impl IntoResponse for IconError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({"code": self.status.as_u16(), "msg": self.message})),
        )
            .into_response()
    }
}

impl From<sqlx::Error> for IconError {
    fn from(value: sqlx::Error) -> Self {
        IconError::internal(value.to_string())
    }
}

impl From<anyhow::Error> for IconError {
    fn from(value: anyhow::Error) -> Self {
        IconError::internal(value.to_string())
    }
}

impl From<std::io::Error> for IconError {
    fn from(value: std::io::Error) -> Self {
        IconError::internal(value.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meta_server_timeout_uses_millisecond_configuration() {
        assert_eq!(
            meta_server_timeout_from_value(Some("5000".to_string())),
            Duration::from_millis(5_000)
        );
        assert_eq!(
            meta_server_timeout_from_value(Some("0".to_string())),
            Duration::from_millis(DEFAULT_META_SERVER_TIMEOUT_MS)
        );
        assert_eq!(
            meta_server_timeout_from_value(Some("invalid".to_string())),
            Duration::from_millis(DEFAULT_META_SERVER_TIMEOUT_MS)
        );
    }

    #[test]
    fn icon_candidates_skip_dynamic_placeholder_and_keep_fallback() {
        let page = Html::parse_document(
            r#"<html><head>
                <link rel="shortcut icon" type="image/png" href="about:blank">
            </head></html>"#,
        );

        assert_eq!(
            select_icon_candidates(&page, "https://example.com/tools/editor"),
            vec!["https://example.com/favicon.ico".to_string()]
        );
    }

    #[test]
    fn icon_candidates_keep_only_fetchable_http_urls() {
        let page = Html::parse_document(
            r#"<html><head>
                <link rel="icon" href="data:image/png;base64,AAAA">
                <link rel="icon" href="/assets/favicon.svg">
                <link rel="apple-touch-icon" href="https://cdn.example.com/touch.png">
                <link rel="icon" href="/assets/favicon.svg">
                <link rel="mask-icon" href="javascript:void(0)">
            </head></html>"#,
        );

        assert_eq!(
            select_icon_candidates(&page, "https://example.com/app/"),
            vec![
                "https://example.com/assets/favicon.svg".to_string(),
                "https://cdn.example.com/touch.png".to_string(),
                "https://example.com/favicon.ico".to_string(),
            ]
        );
    }

    #[test]
    fn local_icon_references_reject_pseudo_schemes_and_path_escape() {
        assert!(is_local_icon_reference("icons/www.youtube.com.svg"));
        assert!(is_local_icon_reference(
            "Bilibili_A+哔哩哔哩+bilibili.com.png"
        ));
        assert!(!is_local_icon_reference("about:blank"));
        assert!(!is_local_icon_reference("data:image/png;base64,AAAA"));
        assert!(!is_local_icon_reference("../secret.svg"));
        assert!(!is_local_icon_reference("/icons/example.svg"));
    }

    #[test]
    fn microlink_payload_accepts_api_envelope_and_direct_object() {
        let envelope = json!({
            "status": "success",
            "data": {
                "title": "Envelope",
                "logo": {"url": "https://example.com/logo.png"}
            },
            "statusCode": 200
        });
        let direct = json!({
            "title": "Direct",
            "logo": {"url": "https://example.com/direct.png"}
        });

        assert_eq!(
            string_value(microlink_data_payload(&envelope).unwrap(), "title").as_deref(),
            Some("Envelope")
        );
        assert_eq!(
            nested_string(microlink_data_payload(&direct).unwrap(), &["logo", "url"]).as_deref(),
            Some("https://example.com/direct.png")
        );
        assert!(!microlink_failed(&envelope));
        assert!(microlink_failed(
            &json!({"status": "fail", "statusCode": 400})
        ));
    }

    #[test]
    fn site_target_normalization_uses_one_url_and_host_contract() {
        let full = normalize_site_target(" https://EIXEIX.com/#/dashboard ").unwrap();
        assert_eq!(full.host, "eixeix.com");
        assert_eq!(full.url.as_str(), "https://eixeix.com/");

        let host_with_path = normalize_site_target("Example.com/docs?q=1#top").unwrap();
        assert_eq!(host_with_path.host, "example.com");
        assert_eq!(host_with_path.url.as_str(), "https://example.com/docs?q=1");

        let protocol_relative = normalize_site_target("//Example.com/icon").unwrap();
        assert_eq!(protocol_relative.host, "example.com");
        assert_eq!(protocol_relative.url.as_str(), "https://example.com/icon");

        assert!(normalize_site_target("mailto:test@example.com").is_none());
        assert!(normalize_site_target("about:blank").is_none());
    }
}
