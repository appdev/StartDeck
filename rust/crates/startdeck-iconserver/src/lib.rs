use std::collections::HashMap;
use std::path::{Path, PathBuf};
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
pub struct IconState {
    config: Arc<RuntimeConfig>,
    pool: SqlitePool,
    http: Client,
    public_icon_base_url: Arc<String>,
}

impl IconState {
    pub fn new(config: RuntimeConfig, pool: SqlitePool) -> Self {
        Self {
            config: Arc::new(config),
            pool,
            http: Client::builder()
                .timeout(Duration::from_secs(20))
                .user_agent("StartDeck-IconService-Rust/1.0")
                .build()
                .expect("reqwest client"),
            public_icon_base_url: Arc::new(
                std::env::var("PUBLIC_ICON_BASE_URL").unwrap_or_default(),
            ),
        }
    }
}

pub fn icon_addr_from_env() -> String {
    if let Ok(addr) = std::env::var("ICON_SERVICE_ADDR")
        && !addr.trim().is_empty()
    {
        return addr;
    }
    let host = std::env::var("ICON_SERVICE_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("ICON_SERVICE_PORT").unwrap_or_else(|_| "9002".to_string());
    format!("{host}:{port}")
}

pub fn app(state: IconState) -> Router {
    let icon_dir = state.config.icon_service_data_dir.join("icons");
    let cache_dir = state.config.icon_service_data_dir.join("cache");
    Router::new()
        .route("/healthz", get(healthz))
        .route("/api/icon", get(lookup_icon))
        .route("/api/site/metadata", get(site_metadata))
        .route("/api/site/icon", get(site_icon))
        .route("/api/icon/refresh", post(refresh_icon))
        .route("/api/icon/cache", delete(delete_icon_cache))
        .nest_service("/icons", get_service(ServeDir::new(icon_dir)))
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
    State(state): State<IconState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    let target = query
        .get("host")
        .or_else(|| query.get("url"))
        .cloned()
        .ok_or_else(|| IconError::bad_request("host_or_url_required"))?;
    let host = normalize_host(&target).ok_or_else(|| IconError::bad_request("invalid_host"))?;
    let record = get_or_fetch_record(&state, &target, &host).await?;
    Ok(Json(
        json!({"code": 200, "data": icon_response_data(&state, &record), "msg": "ok"}),
    ))
}

async fn site_metadata(
    State(state): State<IconState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    let target = query
        .get("url")
        .cloned()
        .ok_or_else(|| IconError::bad_request("url_required"))?;
    let host = normalize_host(&target).ok_or_else(|| IconError::bad_request("invalid_url"))?;
    let record = get_or_fetch_record(&state, &target, &host).await?;
    Ok(Json(json!({
        "code": 200,
        "data": {
            "url": record.url,
            "finalUrl": record.final_url,
            "title": empty_to_null(&record.title),
            "name": empty_to_null(&record.title),
            "icon": record.icon.as_ref().map(|icon| public_icon_url(&state, icon)),
            "iconUrl": record.icon.as_ref().map(|icon| public_icon_url(&state, icon)),
            "description": empty_to_null(&record.description),
            "backgroundColor": empty_to_null(&record.background_color),
            "fetchedAt": record.fetched_at.to_rfc3339()
        },
        "msg": "ok"
    })))
}

async fn site_icon(
    State(state): State<IconState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Response, IconError> {
    let target = query
        .get("url")
        .or_else(|| query.get("host"))
        .cloned()
        .ok_or_else(|| IconError::bad_request("url_required"))?;
    let host = normalize_host(&target).ok_or_else(|| IconError::bad_request("invalid_url"))?;
    let record = get_or_fetch_record(&state, &target, &host).await?;
    let icon = record
        .icon
        .ok_or_else(|| IconError::not_found("icon_not_found"))?;
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
    let response = state
        .http
        .get(&icon)
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
    State(state): State<IconState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    let target = query
        .get("host")
        .or_else(|| query.get("url"))
        .cloned()
        .ok_or_else(|| IconError::bad_request("host_or_url_required"))?;
    let host = normalize_host(&target).ok_or_else(|| IconError::bad_request("invalid_host"))?;
    let record = fetch_remote_record(&state, &target, &host).await?;
    upsert_icon_record(&state.pool, &record).await?;
    Ok(Json(
        json!({"code": 200, "data": icon_response_data(&state, &record), "msg": "ok"}),
    ))
}

async fn delete_icon_cache(
    State(state): State<IconState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    let target = query
        .get("host")
        .or_else(|| query.get("url"))
        .cloned()
        .ok_or_else(|| IconError::bad_request("host_or_url_required"))?;
    let host = normalize_host(&target).ok_or_else(|| IconError::bad_request("invalid_host"))?;
    sqlx::query("DELETE FROM icon_records WHERE host = ? AND source != 'seed'")
        .bind(host)
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
    state: &IconState,
    target: &str,
    host: &str,
) -> Result<IconRecord, IconError> {
    if let Some(record) = icon_record(&state.pool, host).await? {
        return Ok(record);
    }
    let record = fetch_remote_record(state, target, host).await?;
    upsert_icon_record(&state.pool, &record).await?;
    Ok(record)
}

async fn fetch_remote_record(
    state: &IconState,
    target: &str,
    host: &str,
) -> Result<IconRecord, IconError> {
    let url = normalize_url(target, host)?;
    let response = state
        .http
        .get(url.clone())
        .send()
        .await
        .map_err(|err| IconError::bad_gateway(err.to_string()))?;
    let final_url = response.url().to_string();
    let html = response
        .text()
        .await
        .map_err(|err| IconError::bad_gateway(err.to_string()))?;
    let (title, description, icon) = {
        let page = Html::parse_document(&html);
        (
            select_text(&page, "title").unwrap_or_else(|| host.to_string()),
            select_meta(&page, "description")
                .or_else(|| select_meta(&page, "og:description"))
                .unwrap_or_default(),
            select_icon(&page, &final_url),
        )
    };
    let local_icon = if let Some(icon) = icon {
        cache_remote_icon(state, host, &icon)
            .await
            .ok()
            .or(Some(icon))
    } else {
        None
    };
    Ok(IconRecord {
        host: host.to_string(),
        title,
        url: url.to_string(),
        final_url,
        description,
        background_color: String::new(),
        icon: local_icon,
        source: "remote".to_string(),
        fetched_at: Utc::now(),
    })
}

async fn cache_remote_icon(state: &IconState, host: &str, icon: &str) -> Result<String, IconError> {
    let response = state
        .http
        .get(icon)
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
    let cache_dir = state.config.icon_service_data_dir.join("cache");
    fs::create_dir_all(&cache_dir).await?;
    fs::write(cache_dir.join(&filename), bytes).await?;
    Ok(format!("/cache/{filename}"))
}

fn icon_response_data(state: &IconState, record: &IconRecord) -> Value {
    json!({
        "url": null_if_empty(&record.url),
        "finalUrl": null_if_empty(&record.final_url),
        "title": null_if_empty(&record.title),
        "name": null_if_empty(&record.title),
        "icon": record.icon.as_ref().map(|icon| public_icon_url(state, icon)),
        "description": null_if_empty(&record.description),
        "backgroundColor": null_if_empty(&record.background_color),
        "fetchedAt": record.fetched_at.to_rfc3339()
    })
}

fn normalize_url(target: &str, host: &str) -> Result<Url, IconError> {
    if let Ok(url) = Url::parse(target)
        && matches!(url.scheme(), "http" | "https")
    {
        return Ok(url);
    }
    Url::parse(&format!("https://{host}")).map_err(|_| IconError::bad_request("invalid_url"))
}

fn normalize_host(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    if let Ok(url) = Url::parse(raw) {
        return url.host_str().map(|host| host.to_ascii_lowercase());
    }
    Some(
        raw.trim_start_matches("http://")
            .trim_start_matches("https://")
            .split('/')
            .next()
            .unwrap_or_default()
            .split(':')
            .next()
            .unwrap_or_default()
            .to_ascii_lowercase(),
    )
    .filter(|value| !value.is_empty())
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

fn select_icon(page: &Html, final_url: &str) -> Option<String> {
    let selector = Selector::parse("link[rel]").ok()?;
    let base = Url::parse(final_url).ok()?;
    for node in page.select(&selector) {
        let rel = node
            .value()
            .attr("rel")
            .unwrap_or_default()
            .to_ascii_lowercase();
        if !rel.contains("icon") {
            continue;
        }
        let href = node.value().attr("href")?;
        if let Ok(url) = base.join(href) {
            return Some(url.to_string());
        }
    }
    base.join("/favicon.ico").ok().map(|url| url.to_string())
}

fn public_icon_url(state: &IconState, icon: &str) -> String {
    if icon.starts_with("http://") || icon.starts_with("https://") {
        return icon.to_string();
    }
    let icon = if icon.starts_with('/') {
        icon.to_string()
    } else if icon.contains('/') {
        format!("/{icon}")
    } else {
        format!("/icons/{icon}")
    };
    if state.public_icon_base_url.is_empty() {
        icon
    } else {
        format!(
            "{}{}",
            state.public_icon_base_url.trim_end_matches('/'),
            icon
        )
    }
}

fn resolve_local_icon(state: &IconState, icon: &str) -> Option<PathBuf> {
    let trimmed = icon.trim_start_matches('/');
    let candidate = if let Some(name) = trimmed.strip_prefix("icons/") {
        state.config.icon_service_data_dir.join("icons").join(name)
    } else if let Some(name) = trimmed.strip_prefix("cache/") {
        state.config.icon_service_data_dir.join("cache").join(name)
    } else if !trimmed.contains("://") {
        state
            .config
            .icon_service_data_dir
            .join("icons")
            .join(trimmed)
    } else {
        return None;
    };
    Some(candidate).filter(|path| path.exists())
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
