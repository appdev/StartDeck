use std::collections::HashMap;
use std::io::Read;
use std::net::IpAddr;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use axum::body::{Body, Bytes};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{DefaultBodyLimit, Multipart, Path as AxumPath, Query, State};
use axum::http::{HeaderMap, HeaderName, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{any, delete, get, get_service, post};
use axum::{Json, Router};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use bcrypt::{DEFAULT_COST, hash, verify};
use chrono::{Datelike, Duration as ChronoDuration, Utc};
use flate2::read::GzDecoder;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};
use sqlx::{Row, SqlitePool};
use startdeck_core::models::{
    AppSnapshot, NavGroup, NavItem, SystemConfig, UserRecord, WidgetRecord,
};
use startdeck_core::{
    RuntimeConfig, app_snapshot, save_snapshot, system_config, user_password_hash,
};
use tokio::fs;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    config: Arc<RuntimeConfig>,
    pool: SqlitePool,
    http: Client,
    jwt_secret: Arc<String>,
    icon_service_base: Arc<String>,
}

impl AppState {
    pub fn new(config: RuntimeConfig, pool: SqlitePool) -> Self {
        let jwt_secret = std::env::var("STARTDECK_SECRET").unwrap_or_else(|_| {
            format!(
                "{:x}",
                Sha256::digest(config.sqlite_file.to_string_lossy().as_bytes())
            )
        });
        let icon_service_base = std::env::var("ICON_SERVER_BASE_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:9002".to_string());
        Self {
            config: Arc::new(config),
            pool,
            http: Client::builder()
                .timeout(Duration::from_secs(12))
                .build()
                .expect("reqwest client"),
            jwt_secret: Arc::new(jwt_secret),
            icon_service_base: Arc::new(icon_service_base.trim_end_matches('/').to_string()),
        }
    }
}

pub fn app(state: AppState) -> Router {
    let public_dir = state.config.public_dir.clone();
    let music_dir = state.config.music_dir.clone();
    let backgrounds_dir = state.config.backgrounds_dir.clone();
    let mobile_dir = state.config.mobile_backgrounds_dir.clone();
    let icon_cache_dir = state.config.icon_cache_dir.clone();
    Router::new()
        .route("/healthz", get(healthz))
        .route("/ws", get(ws_handler))
        .route("/socket.io/{*any}", any(socket_io_placeholder))
        .route("/proxy", any(proxy_request))
        .route("/api/login", post(login))
        .route("/api/register", post(register))
        .route("/api/data", get(get_data))
        .route("/api/data/import", post(import_data))
        .route("/api/save", post(save_data))
        .route("/api/default/save", post(save_default))
        .route("/api/reset", post(reset_data))
        .route("/api/version", get(version))
        .route("/api/admin/users", get(list_users).post(add_user))
        .route("/api/admin/users/{username}", delete(delete_user))
        .route("/api/admin/license", post(upload_license))
        .route(
            "/api/system-config",
            get(get_system_config).post(update_system_config),
        )
        .route("/api/widgets/{id}", get(get_widget).put(save_widget))
        .route("/api/memo/{id}", get(get_memo).put(save_memo))
        .route(
            "/api/custom-scripts",
            get(get_custom_scripts).post(save_custom_scripts),
        )
        .route("/api/site/metadata", get(site_metadata))
        .route("/api/site/icon", get(site_icon))
        .route("/api/icon-cache", post(cache_icon))
        .route("/api/ip", get(ip_info))
        .route("/api/ping", get(ping))
        .route("/api/rtt", get(rtt))
        .route("/api/visitor/track", post(track_visitor))
        .route("/api/system/stats", get(system_stats))
        .route("/api/docker-status", get(docker_status))
        .route("/api/config/proxy-status", get(proxy_status))
        .route("/api/docker/containers", get(docker_containers))
        .route("/api/docker/info", get(docker_info))
        .route("/api/docker/check-updates", post(docker_accepted))
        .route("/api/docker/container/{id}/{action}", post(docker_accepted))
        .route(
            "/api/docker/container/{id}/inspect-lite",
            get(docker_inspect),
        )
        .route("/api/docker/export-logs", get(docker_logs))
        .route("/api/music-list", get(music_list))
        .route("/api/backgrounds", get(list_backgrounds))
        .route("/api/mobile_backgrounds", get(list_mobile_backgrounds))
        .route("/api/backgrounds/upload", post(upload_background))
        .route(
            "/api/mobile_backgrounds/upload",
            post(upload_mobile_background),
        )
        .route("/api/music/upload", post(upload_music))
        .route("/api/backgrounds/{name}", delete(delete_background))
        .route(
            "/api/mobile_backgrounds/{name}",
            delete(delete_mobile_background),
        )
        .route("/api/wallpaper/proxy", get(wallpaper_proxy))
        .route("/api/wallpaper/resolve", post(resolve_wallpaper))
        .route("/api/wallpaper/fetch", post(fetch_wallpaper))
        .route(
            "/api/config-versions",
            get(list_config_versions).post(save_config_version),
        )
        .route("/api/config-versions/restore", post(restore_config_version))
        .route("/api/config-versions/{id}", delete(delete_config_version))
        .route("/api/itab/today-english", get(cached_widget_data))
        .route("/api/itab/movie-calendar", get(cached_widget_data))
        .route("/api/itab/bing-wallpapers", get(cached_widget_data))
        .route("/api/itab/weather/location", get(cached_widget_data))
        .route("/api/itab/weather/search", get(cached_widget_data))
        .route("/api/itab/weather/current", get(cached_widget_data))
        .route("/api/itab/poem", get(cached_widget_data))
        .route(
            "/api/itab/today-english/media/{kind}",
            get(cached_media_missing),
        )
        .route(
            "/api/itab/movie-calendar/image/{kind}",
            get(cached_media_missing),
        )
        .route(
            "/api/itab-resources/{resource_id}",
            get(itab_resource).head(itab_resource_head),
        )
        .nest_service(
            "/assets",
            get_service(ServeDir::new(public_dir.join("assets"))),
        )
        .nest_service("/music", get_service(ServeDir::new(music_dir)))
        .nest_service("/backgrounds", get_service(ServeDir::new(backgrounds_dir)))
        .nest_service(
            "/mobile_backgrounds",
            get_service(ServeDir::new(mobile_dir)),
        )
        .nest_service("/icon-cache", get_service(ServeDir::new(icon_cache_dir)))
        .nest_service("/public", get_service(ServeDir::new(public_dir.clone())))
        .fallback(spa_or_404)
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
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

#[derive(Debug, Deserialize)]
struct LoginRequest {
    username: Option<String>,
    password: String,
}

#[derive(Debug, Deserialize)]
struct UserMutationRequest {
    username: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct LicenseRequest {
    key: String,
}

#[derive(Debug, Deserialize)]
struct WallpaperResolveRequest {
    url: String,
}

#[derive(Debug, Deserialize)]
struct WallpaperFetchRequest {
    url: String,
    #[serde(rename = "type")]
    target_type: Option<String>,
    apply: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    username: String,
    exp: i64,
}

const ITAB_BING_WALLPAPER_KIND: &str = "itab_bing_wallpaper";
const ITAB_BING_WALLPAPER_CACHE_TTL_MS: i64 = 6 * 60 * 60 * 1000;
const ITAB_BING_WALLPAPER_DEFAULT_PAGE_SIZE: usize = 24;
const ITAB_BING_WALLPAPER_MAX_PAGE_SIZE: usize = 24;
const ITAB_BING_WALLPAPER_DEFAULT_SIZE: &str = "large";

#[derive(Debug, Deserialize)]
struct TimelessqBingListResponse {
    errno: i64,
    errmsg: String,
    data: Option<TimelessqBingListData>,
}

#[derive(Debug, Deserialize)]
struct TimelessqBingListData {
    count: usize,
    #[serde(rename = "totalPages")]
    total_pages: usize,
    #[serde(rename = "pageSize")]
    page_size: usize,
    #[serde(rename = "currentPage")]
    current_page: usize,
    #[serde(default)]
    data: Vec<TimelessqBingImage>,
}

#[derive(Debug, Deserialize)]
struct TimelessqBingImage {
    #[serde(rename = "_id")]
    id: String,
    copyright: String,
    time: String,
    title: String,
    url: String,
    urlbase: String,
}

async fn healthz() -> Json<Value> {
    Json(json!({"ok": true, "service": "startdeck-server"}))
}

async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<Value>, ApiError> {
    let mut username = req.username.unwrap_or_default();
    if username.trim().is_empty() {
        username = "admin".to_string();
    }
    let Some(hash) = user_password_hash(&state.pool, &username).await? else {
        return Err(ApiError::unauthorized("user_not_found"));
    };
    if !verify(req.password, &hash).unwrap_or(false) {
        return Err(ApiError::unauthorized("password_incorrect"));
    }
    let claims = Claims {
        username: username.clone(),
        exp: (Utc::now() + ChronoDuration::days(30)).timestamp(),
    };
    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    )
    .map_err(|err| ApiError::internal(err.to_string()))?;
    Ok(Json(
        json!({"success": true, "token": token, "username": username}),
    ))
}

async fn register(
    State(state): State<AppState>,
    Json(req): Json<UserMutationRequest>,
) -> Result<Json<Value>, ApiError> {
    create_user(&state, &req.username, &req.password).await?;
    Ok(Json(json!({"success": true})))
}

async fn list_users(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    require_admin(&headers, &state)?;
    let rows =
        sqlx::query("SELECT username FROM users WHERE username != 'admin' ORDER BY username ASC")
            .fetch_all(&state.pool)
            .await?;
    Ok(Json(json!({
        "users": rows.into_iter().map(|row| row.get::<String, _>("username")).collect::<Vec<_>>()
    })))
}

async fn add_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<UserMutationRequest>,
) -> Result<Json<Value>, ApiError> {
    require_admin(&headers, &state)?;
    create_user(&state, &req.username, &req.password).await?;
    Ok(Json(json!({"success": true})))
}

async fn delete_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(username): AxumPath<String>,
) -> Result<Json<Value>, ApiError> {
    require_admin(&headers, &state)?;
    let username = sanitize_username(&username)?;
    if username == "admin" {
        return Err(ApiError::bad_request("invalid_username"));
    }
    sqlx::query("DELETE FROM users WHERE username = ?")
        .bind(username)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({"success": true})))
}

async fn upload_license(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<LicenseRequest>,
) -> Result<Json<Value>, ApiError> {
    require_admin(&headers, &state)?;
    fs::create_dir_all(&state.config.data_dir).await?;
    fs::write(state.config.data_dir.join("license.key"), req.key).await?;
    Ok(Json(json!({"success": true})))
}

async fn get_data(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let username = username_from_headers(&headers, &state).unwrap_or_else(|| "admin".to_string());
    let snapshot = app_snapshot(&state.pool, &username).await?;
    Ok(Json(snapshot_to_api_value(snapshot)))
}

async fn save_data(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let body = parse_json_body(&headers, &body)?;
    let snapshot = normalize_snapshot(&state.pool, username, body).await?;
    save_snapshot(&state.pool, &snapshot).await?;
    Ok(Json(
        json!({"success": true, "version": Utc::now().timestamp_millis()}),
    ))
}

async fn import_data(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let snapshot = normalize_snapshot(&state.pool, username, body).await?;
    save_snapshot(&state.pool, &snapshot).await?;
    Ok(Json(
        json!({"success": true, "version": Utc::now().timestamp_millis()}),
    ))
}

async fn save_default(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let snapshot = app_snapshot(&state.pool, &username).await?;
    let template = snapshot_to_template_value(snapshot);
    sqlx::query(
        r#"INSERT OR REPLACE INTO runtime_cache(kind, cache_key, value_json, expires_at, source_status, updated_at)
           VALUES ('default_template', 'global', ?, NULL, 'ok', ?)"#,
    )
    .bind(template.to_string())
    .bind(Utc::now().timestamp_millis())
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({"success": true})))
}

async fn reset_data(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let template = load_default_template(&state).await?;
    let snapshot = normalize_snapshot(&state.pool, username, template).await?;
    save_snapshot(&state.pool, &snapshot).await?;
    Ok(Json(json!({"success": true})))
}

async fn version(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let username = username_from_headers(&headers, &state).unwrap_or_else(|| "admin".to_string());
    let snapshot = app_snapshot(&state.pool, &username).await?;
    Ok(Json(json!({"version": snapshot.version})))
}

async fn get_system_config(State(state): State<AppState>) -> Result<Json<SystemConfig>, ApiError> {
    Ok(Json(system_config(&state.pool).await?))
}

async fn update_system_config(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    let auth_mode = body
        .get("authMode")
        .and_then(Value::as_str)
        .unwrap_or("single");
    let enable_docker = body
        .get("enableDocker")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    sqlx::query(
        r#"INSERT INTO system_config(id, auth_mode, enable_docker, config_json, updated_at)
           VALUES (1, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET auth_mode=excluded.auth_mode,
             enable_docker=excluded.enable_docker,
             config_json=excluded.config_json,
             updated_at=excluded.updated_at"#,
    )
    .bind(auth_mode)
    .bind(enable_docker as i64)
    .bind(body.to_string())
    .bind(Utc::now().timestamp_millis())
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({"success": true})))
}

async fn get_widget(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<Value>, ApiError> {
    let username = username_from_headers(&headers, &state).unwrap_or_else(|| "admin".to_string());
    let row = sqlx::query("SELECT id, widget_type, enabled, is_public, data_json, layout_json, sort_order FROM widgets WHERE username = ? AND id = ?")
        .bind(username)
        .bind(id)
        .fetch_optional(&state.pool)
        .await?;
    let Some(row) = row else {
        return Err(ApiError::not_found("widget_not_found"));
    };
    let widget = WidgetRecord {
        id: row.get("id"),
        widget_type: row.get("widget_type"),
        enabled: row.get::<i64, _>("enabled") != 0,
        is_public: row.get::<i64, _>("is_public") != 0,
        data: parse_json(row.get::<String, _>("data_json")),
        layout: parse_json(row.get::<String, _>("layout_json")),
        sort_order: row.get("sort_order"),
    };
    Ok(Json(widget_to_api_value(&widget)))
}

async fn save_widget(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<String>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    sqlx::query(
        r#"INSERT INTO widgets(id, username, widget_type, enabled, is_public, data_json, layout_json, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             widget_type=excluded.widget_type,
             enabled=excluded.enabled,
             is_public=excluded.is_public,
             data_json=excluded.data_json,
             layout_json=excluded.layout_json"#,
    )
    .bind(&id)
    .bind(username)
    .bind(body.get("type").and_then(Value::as_str).unwrap_or("custom"))
    .bind(
        body.get("enable")
            .or_else(|| body.get("enabled"))
            .and_then(Value::as_bool)
            .unwrap_or(true) as i64,
    )
    .bind(
        body.get("isPublic")
            .or_else(|| body.get("is_public"))
            .and_then(Value::as_bool)
            .unwrap_or(true) as i64,
    )
    .bind(body.get("data").cloned().unwrap_or_else(|| json!({})).to_string())
    .bind(normalize_widget_layout(&body).to_string())
    .bind(Utc::now().timestamp_millis())
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({"success": true, "id": id})))
}

async fn get_memo(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let row = sqlx::query(
        "SELECT content, mode, server_ts FROM memos WHERE widget_id = ? AND username = ?",
    )
    .bind(id)
    .bind(username)
    .fetch_optional(&state.pool)
    .await?;
    Ok(Json(if let Some(row) = row {
        json!({"content": row.get::<String, _>("content"), "mode": row.get::<String, _>("mode"), "server_ts": row.get::<i64, _>("server_ts")})
    } else {
        json!({"content": "", "mode": "plain", "server_ts": 0})
    }))
}

async fn save_memo(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<String>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let server_ts = body
        .get("server_ts")
        .and_then(Value::as_i64)
        .unwrap_or_else(|| Utc::now().timestamp_millis());
    sqlx::query(
        r#"INSERT INTO memos(widget_id, username, content, mode, server_ts)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(widget_id, username) DO UPDATE SET
             content=excluded.content,
             mode=excluded.mode,
             server_ts=excluded.server_ts"#,
    )
    .bind(id)
    .bind(username)
    .bind(body.get("content").and_then(Value::as_str).unwrap_or(""))
    .bind(body.get("mode").and_then(Value::as_str).unwrap_or("plain"))
    .bind(server_ts)
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({"success": true, "server_ts": server_ts})))
}

async fn get_custom_scripts(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let row = sqlx::query("SELECT value_json FROM runtime_cache WHERE kind = 'custom_scripts' AND cache_key = 'global'")
        .fetch_optional(&state.pool)
        .await?;
    Ok(Json(
        row.map(|r| parse_json(r.get::<String, _>("value_json")))
            .unwrap_or_else(|| json!({})),
    ))
}

async fn save_custom_scripts(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    sqlx::query(
        r#"INSERT OR REPLACE INTO runtime_cache(kind, cache_key, value_json, expires_at, source_status, updated_at)
           VALUES ('custom_scripts', 'global', ?, NULL, 'ok', ?)"#,
    )
    .bind(body.to_string())
    .bind(Utc::now().timestamp_millis())
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({"success": true})))
}

async fn site_metadata(
    State(state): State<AppState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let url = query
        .get("url")
        .cloned()
        .ok_or_else(|| ApiError::bad_request("missing_url"))?;
    let response = state
        .http
        .get(format!("{}/api/site/metadata", state.icon_service_base))
        .query(&[("url", url)])
        .send()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    Ok(Json(
        response
            .json::<Value>()
            .await
            .map_err(|err| ApiError::bad_gateway(err.to_string()))?,
    ))
}

async fn site_icon(
    State(state): State<AppState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Response, ApiError> {
    let url = query
        .get("url")
        .cloned()
        .ok_or_else(|| ApiError::bad_request("missing_url"))?;
    let response = state
        .http
        .get(format!("{}/api/site/icon", state.icon_service_base))
        .query(&[("url", url)])
        .send()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    let status = response.status();
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .cloned()
        .unwrap_or_else(|| HeaderValue::from_static("application/octet-stream"));
    let bytes = response
        .bytes()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    let mut res = Response::new(Body::from(bytes));
    *res.status_mut() = StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    res.headers_mut().insert(header::CONTENT_TYPE, content_type);
    Ok(res)
}

async fn cache_icon(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let raw = body
        .get("dataUrl")
        .or_else(|| body.get("data_url"))
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("data_url_required"))?;
    let (content_type, data) = decode_data_url(raw)?;
    let ext = extension_for_content_type(&content_type).unwrap_or(".bin");
    let hash = format!("{:x}", Sha256::digest(&data));
    let file_name = format!("{hash}{ext}");
    let target = state.config.icon_cache_dir.join(&file_name);
    fs::write(&target, data).await?;
    Ok(Json(
        json!({"success": true, "url": format!("/icon-cache/{file_name}")}),
    ))
}

async fn ip_info(headers: HeaderMap) -> Json<Value> {
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .unwrap_or("127.0.0.1");
    Json(json!({
        "success": true,
        "ip": client_ip,
        "queryIp": client_ip,
        "clientIp": client_ip,
        "clientIpSource": "request-header",
        "location": "本机 本地网络",
        "country": "本机",
        "region": "本地网络",
        "city": "本机",
        "isp": "本地网络",
        "network": "本地网络",
        "cached": false,
        "source": "rust-local"
    }))
}

async fn ping(Query(query): Query<HashMap<String, String>>) -> Json<Value> {
    let url = query.get("url").cloned().unwrap_or_default();
    Json(json!({"success": !url.is_empty(), "url": url, "latency": null}))
}

async fn rtt(Query(query): Query<HashMap<String, String>>) -> Json<Value> {
    Json(
        json!({"success": true, "ts": query.get("ts").cloned(), "serverTs": Utc::now().timestamp_millis()}),
    )
}

async fn track_visitor(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    sqlx::query(
        r#"INSERT INTO visitor_stats(id, total_visitors, today_visitors, last_visit_date, updated_at)
           VALUES (1, 1, 1, date('now'), ?)
           ON CONFLICT(id) DO UPDATE SET
             total_visitors=total_visitors+1,
             today_visitors=CASE WHEN last_visit_date = date('now') THEN today_visitors+1 ELSE 1 END,
             last_visit_date=date('now'),
             updated_at=excluded.updated_at"#,
    )
    .bind(Utc::now().timestamp_millis())
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({"success": true})))
}

async fn system_stats(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    Ok(Json(
        json!({"success": true, "data": {"runtime": "rust", "time": Utc::now().to_rfc3339()}}),
    ))
}

async fn docker_status() -> Json<Value> {
    Json(json!({"available": false, "enabled": false, "runtime": "rust"}))
}

async fn proxy_status() -> Json<Value> {
    let available = std::env::var("HTTP_PROXY")
        .or_else(|_| std::env::var("HTTPS_PROXY"))
        .or_else(|_| std::env::var("ALL_PROXY"))
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    Json(json!({"available": available}))
}

async fn docker_containers(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    Ok(Json(json!({"success": true, "containers": []})))
}

async fn docker_info(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    Ok(Json(
        json!({"success": false, "error": "docker_unavailable"}),
    ))
}

async fn docker_accepted(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    Ok(Json(
        json!({"success": false, "error": "docker_unavailable"}),
    ))
}

async fn docker_inspect(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    Ok(Json(
        json!({"success": false, "error": "docker_unavailable"}),
    ))
}

async fn docker_logs(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    require_username(&headers, &state)?;
    Ok((StatusCode::SERVICE_UNAVAILABLE, "docker unavailable").into_response())
}

async fn music_list(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    Ok(Json(json!(
        list_files_with_ext(&state.config.music_dir, &["mp3", "flac", "wav", "ogg"]).await?
    )))
}

async fn list_backgrounds(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    Ok(Json(json!(
        list_files_with_ext(
            &state.config.backgrounds_dir,
            &["png", "jpg", "jpeg", "gif", "webp", "svg"]
        )
        .await?
    )))
}

async fn list_mobile_backgrounds(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    Ok(Json(json!(
        list_files_with_ext(
            &state.config.mobile_backgrounds_dir,
            &["png", "jpg", "jpeg", "gif", "webp", "svg"]
        )
        .await?
    )))
}

async fn upload_background(
    State(state): State<AppState>,
    headers: HeaderMap,
    multipart: Multipart,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    save_first_upload(&state.config.backgrounds_dir, "/backgrounds", multipart).await
}

async fn upload_mobile_background(
    State(state): State<AppState>,
    headers: HeaderMap,
    multipart: Multipart,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    save_first_upload(
        &state.config.mobile_backgrounds_dir,
        "/mobile_backgrounds",
        multipart,
    )
    .await
}

async fn upload_music(
    State(state): State<AppState>,
    headers: HeaderMap,
    multipart: Multipart,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    save_first_upload(&state.config.music_dir, "/music", multipart).await
}

async fn delete_background(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(name): AxumPath<String>,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    delete_named_file(&state.config.backgrounds_dir, &name).await
}

async fn delete_mobile_background(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(name): AxumPath<String>,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    delete_named_file(&state.config.mobile_backgrounds_dir, &name).await
}

async fn wallpaper_proxy(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Response, ApiError> {
    require_username(&headers, &state)?;
    let url = query
        .get("url")
        .cloned()
        .ok_or_else(|| ApiError::bad_request("missing_url"))?;
    let request_uuid = query.get("uuid").cloned();
    let parsed = validate_remote_url(&url).await?;
    if is_blocked_wallpaper_host(parsed.host_str().unwrap_or_default()).await? {
        return Err(ApiError::forbidden("blocked_host"));
    }
    let response = state
        .http
        .get(parsed)
        .send()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    let status = response.status();
    let headers_in = response.headers().clone();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    let mut out = Response::new(Body::from(bytes));
    *out.status_mut() = StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    copy_response_header(&headers_in, out.headers_mut(), header::CONTENT_TYPE);
    copy_response_header(&headers_in, out.headers_mut(), header::CACHE_CONTROL);
    copy_response_header(&headers_in, out.headers_mut(), header::ETAG);
    if let Some(request_uuid) = request_uuid
        && let Ok(value) = HeaderValue::from_str(&request_uuid)
    {
        out.headers_mut().insert("x-request-uuid", value);
    }
    Ok(out)
}

async fn resolve_wallpaper(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<WallpaperResolveRequest>,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    let parsed = validate_remote_url(&body.url).await?;
    if is_blocked_wallpaper_host(parsed.host_str().unwrap_or_default()).await? {
        return Err(ApiError::forbidden("blocked_host"));
    }
    let final_url = match state.http.head(parsed.clone()).send().await {
        Ok(response) => response.url().to_string(),
        Err(_) => parsed.to_string(),
    };
    Ok(Json(json!({"url": final_url})))
}

async fn fetch_wallpaper(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<WallpaperFetchRequest>,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let parsed = validate_remote_url(&body.url).await?;
    if is_blocked_wallpaper_host(parsed.host_str().unwrap_or_default()).await? {
        return Err(ApiError::forbidden("blocked_host"));
    }
    let response = state
        .http
        .get(parsed)
        .send()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    if !response.status().is_success() {
        return Err(ApiError::bad_gateway("download_failed"));
    }
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    let ext = extension_for_content_type(&content_type).unwrap_or(".jpg");
    let is_mobile = body
        .target_type
        .as_deref()
        .map(|value| value.eq_ignore_ascii_case("mobile"))
        .unwrap_or(false);
    let (dir, prefix, url_prefix) = if is_mobile {
        (
            &state.config.mobile_backgrounds_dir,
            "api_mbg",
            "/mobile_backgrounds",
        )
    } else {
        (&state.config.backgrounds_dir, "api_bg", "/backgrounds")
    };
    fs::create_dir_all(dir).await?;
    let filename = format!(
        "{}_{}_{}{}",
        prefix,
        sanitize_filename(&username).replace(' ', "_"),
        Utc::now().timestamp_millis(),
        ext
    );
    let bytes = response
        .bytes()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    fs::write(dir.join(&filename), bytes).await?;
    let path = format!("{url_prefix}/{filename}");
    Ok(Json(json!({
        "success": true,
        "path": path,
        "filename": filename,
        "apply": body.apply.unwrap_or(true)
    })))
}

async fn list_config_versions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    let rows =
        sqlx::query("SELECT id, label, created_at FROM config_versions ORDER BY created_at DESC")
            .fetch_all(&state.pool)
            .await?;
    Ok(Json(
        json!({"success": true, "versions": rows.into_iter().map(|row| json!({
        "id": row.get::<String, _>("id"),
        "label": row.get::<String, _>("label"),
        "createdAt": row.get::<i64, _>("created_at")
    })).collect::<Vec<_>>() }),
    ))
}

async fn save_config_version(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let snapshot = app_snapshot(&state.pool, &username).await?;
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO config_versions(id, label, snapshot_json, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(
        body.get("label")
            .and_then(Value::as_str)
            .unwrap_or("Snapshot"),
    )
    .bind(serde_json::to_string(&snapshot)?)
    .bind(Utc::now().timestamp_millis())
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({"success": true, "id": id})))
}

async fn restore_config_version(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    let id = body
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("missing_id"))?;
    let row = sqlx::query("SELECT snapshot_json FROM config_versions WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?;
    let Some(row) = row else {
        return Err(ApiError::not_found("version_not_found"));
    };
    let snapshot: AppSnapshot = serde_json::from_str(&row.get::<String, _>("snapshot_json"))?;
    save_snapshot(&state.pool, &snapshot).await?;
    Ok(Json(json!({"success": true})))
}

async fn delete_config_version(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    sqlx::query("DELETE FROM config_versions WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({"success": true})))
}

async fn cached_widget_data(
    State(state): State<AppState>,
    uri: axum::http::Uri,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let kind = widget_kind_from_path(uri.path());
    if kind == ITAB_BING_WALLPAPER_KIND {
        return bing_wallpaper_data(&state, &query).await;
    }
    let row = sqlx::query(
        "SELECT value_json, source_status FROM runtime_cache WHERE kind = ? ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(kind)
    .fetch_optional(&state.pool)
    .await?;
    if let Some(row) = row {
        let data = parse_json(row.get::<String, _>("value_json"));
        let status = row.get::<String, _>("source_status");
        Ok(Json(cached_widget_response(data, &status)))
    } else if let Some((cache_key, data, status)) = fallback_widget_cache(kind) {
        sqlx::query(
            r#"INSERT OR REPLACE INTO runtime_cache(kind, cache_key, value_json, expires_at, source_status, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)"#,
        )
        .bind(kind)
        .bind(cache_key)
        .bind(data.to_string())
        .bind(None::<i64>)
        .bind(status)
        .bind(Utc::now().timestamp_millis())
        .execute(&state.pool)
        .await?;
        Ok(Json(cached_widget_response(data, status)))
    } else {
        Err(ApiError::bad_gateway("cache_miss"))
    }
}

async fn bing_wallpaper_data(
    state: &AppState,
    query: &HashMap<String, String>,
) -> Result<Json<Value>, ApiError> {
    let page = query_usize(query, "page", 1, 1, usize::MAX);
    let page_size = query_usize(
        query,
        "pageSize",
        ITAB_BING_WALLPAPER_DEFAULT_PAGE_SIZE,
        1,
        ITAB_BING_WALLPAPER_MAX_PAGE_SIZE,
    );
    let size = sanitize_bing_image_size(
        query
            .get("size")
            .map(String::as_str)
            .unwrap_or(ITAB_BING_WALLPAPER_DEFAULT_SIZE),
    );
    let refresh = query
        .get("refresh")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let cache_key = format!("timelessq:{size}:page:{page}:pageSize:{page_size}:v1");
    let now = Utc::now().timestamp_millis();
    let cached = sqlx::query(
        "SELECT value_json, source_status, expires_at FROM runtime_cache WHERE kind = ? AND cache_key = ?",
    )
    .bind(ITAB_BING_WALLPAPER_KIND)
    .bind(&cache_key)
    .fetch_optional(&state.pool)
    .await?;

    if let Some(row) = cached.as_ref() {
        let expires_at = row.get::<Option<i64>, _>("expires_at");
        if !refresh && expires_at.map(|value| value > now).unwrap_or(true) {
            let data = parse_json(row.get::<String, _>("value_json"));
            let status = row.get::<String, _>("source_status");
            return Ok(Json(bing_wallpaper_response(data, &status)));
        }
    }

    match fetch_bing_wallpaper_page(&state.http, page, page_size, &size).await {
        Ok(data) => {
            sqlx::query(
                r#"INSERT OR REPLACE INTO runtime_cache(kind, cache_key, value_json, expires_at, source_status, updated_at)
                   VALUES (?, ?, ?, ?, 'ok', ?)"#,
            )
            .bind(ITAB_BING_WALLPAPER_KIND)
            .bind(&cache_key)
            .bind(data.to_string())
            .bind(now + ITAB_BING_WALLPAPER_CACHE_TTL_MS)
            .bind(now)
            .execute(&state.pool)
            .await?;
            Ok(Json(bing_wallpaper_response(data, "ok")))
        }
        Err(source_error) => {
            if let Some(row) = cached {
                let data = parse_json(row.get::<String, _>("value_json"));
                return Ok(Json(bing_wallpaper_response(data, "stale")));
            }
            Err(ApiError::bad_gateway(format!(
                "bing_wallpaper_source_unavailable: {source_error}"
            )))
        }
    }
}

fn query_usize(
    query: &HashMap<String, String>,
    key: &str,
    fallback: usize,
    min: usize,
    max: usize,
) -> usize {
    query
        .get(key)
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(fallback)
        .clamp(min, max)
}

fn sanitize_bing_image_size(value: &str) -> String {
    let trimmed = value.trim();
    match trimmed {
        "default" | "mini" | "small" | "middle" | "large" | "mobile-mini" | "mobile-small"
        | "mobile-middle" | "mobile-default" => trimmed.to_string(),
        _ => ITAB_BING_WALLPAPER_DEFAULT_SIZE.to_string(),
    }
}

async fn fetch_bing_wallpaper_page(
    client: &Client,
    page: usize,
    page_size: usize,
    size: &str,
) -> Result<Value, String> {
    let response = client
        .get("https://api.timelessq.com/bing/list")
        .query(&[
            ("page", page.to_string()),
            ("pageSize", page_size.to_string()),
            ("size", size.to_string()),
        ])
        .send()
        .await
        .map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("source_status_{status}"));
    }
    let payload = response
        .json::<TimelessqBingListResponse>()
        .await
        .map_err(|err| err.to_string())?;
    if payload.errno != 0 {
        return Err(if payload.errmsg.is_empty() {
            format!("source_errno_{}", payload.errno)
        } else {
            payload.errmsg
        });
    }
    let Some(data) = payload.data else {
        return Err("missing_source_data".to_string());
    };
    let entries: Vec<Value> = data
        .data
        .into_iter()
        .map(normalize_bing_wallpaper_entry)
        .collect();

    Ok(json!({
        "entries": entries,
        "updatedAt": Utc::now().to_rfc3339(),
        "count": data.count,
        "totalPages": data.total_pages.max(1),
        "pageSize": data.page_size,
        "currentPage": data.current_page,
        "sourceStatus": "ok"
    }))
}

fn normalize_bing_wallpaper_entry(image: TimelessqBingImage) -> Value {
    let download_url = absolute_bing_url(image.url.trim());
    let thumbnail_url = thumbnail_bing_url(&download_url);
    let (location, credit) = split_bing_copyright(&image.copyright);
    let id_seed = if image.id.trim().is_empty() {
        image.urlbase.trim()
    } else {
        image.id.trim()
    };

    json!({
        "id": format!("bing-{}", sanitize_wallpaper_id(id_seed)),
        "title": image.title.trim(),
        "location": location,
        "credit": if credit.is_empty() { "Bing".to_string() } else { credit },
        "thumbnailUrl": thumbnail_url,
        "downloadUrl": download_url,
        "sourceUrl": absolute_bing_url(image.urlbase.trim()),
        "bingTitle": image.title.trim(),
        "startDate": image.time,
        "copyrightText": image.copyright
    })
}

fn absolute_bing_url(raw: &str) -> String {
    if raw.starts_with("http://") || raw.starts_with("https://") {
        raw.to_string()
    } else if raw.starts_with('/') {
        format!("https://www.bing.com{raw}")
    } else {
        format!("https://www.bing.com/{raw}")
    }
}

fn thumbnail_bing_url(download_url: &str) -> String {
    let separator = if download_url.contains('?') { '&' } else { '?' };
    format!("{download_url}{separator}w=360&h=202")
}

fn split_bing_copyright(copyright: &str) -> (String, String) {
    if let Some((location, rest)) = copyright.split_once(" (© ") {
        let credit = rest.trim_end_matches(')').trim().to_string();
        (location.trim().to_string(), credit)
    } else {
        (copyright.trim().to_string(), "Bing".to_string())
    }
}

fn sanitize_wallpaper_id(seed: &str) -> String {
    let sanitized: String = seed
        .chars()
        .filter_map(|character| {
            if character.is_ascii_alphanumeric() {
                Some(character.to_ascii_lowercase())
            } else if character == '-' || character == '_' {
                Some('-')
            } else {
                None
            }
        })
        .collect();
    if sanitized.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        sanitized
    }
}

fn bing_wallpaper_response(mut data: Value, status: &str) -> Value {
    if let Value::Object(ref mut object) = data {
        object.insert("sourceStatus".to_string(), json!(status));
    }
    cached_widget_response(data, status)
}

fn cached_widget_response(mut data: Value, status: &str) -> Value {
    if let Value::Object(ref mut object) = data {
        object
            .entry("sourceStatus")
            .or_insert_with(|| json!(status));
    }
    json!({"success": true, "data": data, "sourceStatus": status})
}

fn fallback_widget_cache(kind: &str) -> Option<(&'static str, Value, &'static str)> {
    match kind {
        "itab_daily_english" => Some((
            "fallback",
            json!({
                "mode": "跟读",
                "sentence": "Light stretches longer, painting walls gold.",
                "translation": "日光拉得更长，把墙壁染成金色。",
                "progressLabel": "00:00",
                "imageUrl": "",
                "audioUrl": "",
                "dateline": local_date_parts().0,
                "sourceStatus": "fallback"
            }),
            "fallback",
        )),
        "itab_movie_calendar" => {
            let (date, day, month_label, weekday) = local_date_parts();
            Some((
                "today:v2",
                json!({
                    "date": date,
                    "day": day,
                    "monthLabel": month_label,
                    "weekday": weekday,
                    "movieTitle": "雌雄莫辨",
                    "rating": "7.4",
                    "quote": "你不需要成为任何人，只需做你自己。",
                    "posterUrl": "",
                    "coverUrl": "",
                    "sourceUrl": "https://movie.douban.com/subject/4712730/",
                    "year": "2011",
                    "area": "英国 爱尔兰",
                    "director": "罗德里戈·加西亚",
                    "intro": "阿尔伯特穿上男侍制服，靠谨慎与坚韧在陌生城市里寻找属于自己的生活。",
                    "genres": ["剧情"],
                    "bgColor": "3a444c",
                    "textColor": "f4f7f9",
                    "sourceStatus": "fallback"
                }),
                "fallback",
            ))
        }
        "itab_poem" => Some((
            "fallback:v1",
            json!({
                "id": "fallback-ouyangxiu-langtaosha",
                "sentence": "垂杨紫陌洛城东，总是当时携手处，游遍芳丛。",
                "poemTitle": "浪淘沙",
                "author": "欧阳修",
                "dynasty": "宋",
                "fullText": [
                    "把酒祝东风，且共从容。",
                    "垂杨紫陌洛城东，总是当时携手处，游遍芳丛。",
                    "聚散苦匆匆，此恨无穷。",
                    "今年花胜去年红，可惜明年花更好，知与谁同？"
                ],
                "translation": [
                    "端起酒杯向东方祈祷，请你再留些时日不要一去匆匆。",
                    "洛阳城东垂柳婆娑的郊野小道，就是我们去年携手同游的地方。",
                    "欢聚和离散都是这样匆促，心中的遗恨却无尽无穷。"
                ],
                "annotations": [
                    "把酒：端着酒杯。",
                    "从容：留恋，不舍。",
                    "紫陌：指洛阳的道路。",
                    "匆匆：形容时间匆促。"
                ],
                "preface": [
                    "此词为春日与友人在洛阳城东旧地同游，有感而作。",
                    "上片叙事，回忆昔日洛城游春赏花之欢聚；下片写聚散无常之感。"
                ],
                "sourceStatus": "fallback"
            }),
            "fallback",
        )),
        _ => None,
    }
}

fn local_date_parts() -> (String, String, String, String) {
    let local = Utc::now() + ChronoDuration::hours(8);
    let weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    (
        local.format("%Y-%m-%d").to_string(),
        local.day().to_string(),
        format!("{}月", local.month()),
        weekdays[local.weekday().num_days_from_monday() as usize].to_string(),
    )
}

async fn cached_media_missing() -> Result<Response, ApiError> {
    Err(ApiError::not_found("media_not_cached"))
}

async fn itab_resource(AxumPath(resource_id): AxumPath<String>) -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(json!({"error": "resource_not_migrated", "resourceId": resource_id})),
    )
        .into_response()
}

async fn itab_resource_head() -> StatusCode {
    StatusCode::NOT_FOUND
}

async fn ws_handler(State(state): State<AppState>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws_loop(socket, state))
}

async fn ws_loop(mut socket: WebSocket, state: AppState) {
    let mut heartbeat = tokio::time::interval(Duration::from_secs(10));
    loop {
        tokio::select! {
            _ = heartbeat.tick() => {
                let payload = json!({
                    "type": "ping",
                    "payload": {"ts": Utc::now().timestamp_millis()}
                });
                if socket.send(Message::Text(payload.to_string().into())).await.is_err() {
                    break;
                }
            }
            message = socket.recv() => {
                let Some(Ok(message)) = message else {
                    break;
                };
                match message {
                    Message::Text(text) => {
                        let response = handle_ws_text(&state, text.as_str());
                        if let Some(response) = response
                            && socket.send(Message::Text(response.into())).await.is_err()
                        {
                            break;
                        }
                    }
                    Message::Binary(bytes) => {
                        if socket.send(Message::Binary(bytes)).await.is_err() {
                            break;
                        }
                    }
                    Message::Close(_) => break,
                    _ => {}
                }
            }
        }
    }
}

fn handle_ws_text(state: &AppState, text: &str) -> Option<String> {
    let value: Value = serde_json::from_str(text).ok()?;
    let message_type = value.get("type").and_then(Value::as_str)?;
    match message_type {
        "ping" => Some(json!({"type": "pong"}).to_string()),
        "auth" => {
            let token = value
                .get("payload")
                .and_then(|payload| payload.get("token"))
                .and_then(Value::as_str)?;
            let claims = decode::<Claims>(
                token,
                &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
                &Validation::new(Algorithm::HS256),
            )
            .ok()?
            .claims;
            Some(
                json!({
                    "type": "auth_success",
                    "payload": {
                        "sessionID": Uuid::new_v4().to_string(),
                        "username": claims.username
                    }
                })
                .to_string(),
            )
        }
        "network_heartbeat" => Some(
            json!({
                "type": "network_heartbeat",
                "payload": {"ts": Utc::now().timestamp_millis()}
            })
            .to_string(),
        ),
        "network_mode" => value
            .get("payload")
            .cloned()
            .map(|payload| json!({"type": "network_mode", "payload": payload}).to_string()),
        "memo_update" | "todo_update" => Some(value.to_string()),
        _ => None,
    }
}

async fn socket_io_placeholder() -> Json<Value> {
    Json(json!({"success": true, "transport": "socket.io-placeholder"}))
}

async fn proxy_request(
    State(state): State<AppState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Response, ApiError> {
    let url = query
        .get("url")
        .cloned()
        .ok_or_else(|| ApiError::bad_request("missing_url"))?;
    let parsed = validate_remote_url(&url).await?;
    if is_blocked_host(parsed.host_str().unwrap_or_default()).await? {
        return Err(ApiError::forbidden("blocked_host"));
    }
    let response = state
        .http
        .get(parsed)
        .send()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    let status = response.status();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    let mut out = Response::new(Body::from(bytes));
    *out.status_mut() = StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    Ok(out)
}

async fn spa_or_404(State(state): State<AppState>, uri: axum::http::Uri) -> Response {
    if uri.path().starts_with("/api/")
        || uri.path().starts_with("/ws")
        || uri.path().starts_with("/socket.io")
    {
        return StatusCode::NOT_FOUND.into_response();
    }
    let path = state.config.public_dir.join("index.html");
    match fs::read(path).await {
        Ok(bytes) => {
            let mut response = Response::new(Body::from(bytes));
            response.headers_mut().insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/html; charset=utf-8"),
            );
            response
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

fn snapshot_to_api_value(snapshot: AppSnapshot) -> Value {
    json!({
        "username": snapshot.username,
        "user": snapshot.user,
        "systemConfig": snapshot.system_config,
        "authMode": snapshot.system_config.auth_mode,
        "enableDocker": snapshot.system_config.enable_docker,
        "appConfig": snapshot.user.app_config,
        "groups": snapshot.groups.iter().map(nav_group_to_api_value).collect::<Vec<_>>(),
        "widgets": snapshot.widgets.iter().map(widget_to_api_value).collect::<Vec<_>>(),
        "version": snapshot.version,
    })
}

fn nav_group_to_api_value(group: &NavGroup) -> Value {
    let mut out = object_from_value(unwrap_nested_object(&group.settings, "settings"));
    out.remove("items");
    out.remove("settings");
    out.remove("sort_order");
    out.insert("id".to_string(), json!(group.id));
    out.insert("title".to_string(), json!(group.title));
    out.insert(
        "items".to_string(),
        Value::Array(group.items.iter().map(nav_item_to_api_value).collect()),
    );
    Value::Object(out)
}

fn nav_item_to_api_value(item: &NavItem) -> Value {
    let mut out = object_from_value(unwrap_nested_object(&item.metadata, "metadata"));
    out.remove("metadata");
    out.remove("is_public");
    out.remove("sort_order");
    out.insert("id".to_string(), json!(item.id));
    out.insert("title".to_string(), json!(item.title));
    out.insert("url".to_string(), json!(item.url));
    out.insert("icon".to_string(), json!(item.icon));
    out.insert("isPublic".to_string(), json!(item.is_public));
    Value::Object(out)
}

fn widget_to_api_value(widget: &WidgetRecord) -> Value {
    let mut out = widget_layout_to_api_object(&widget.layout);
    out.insert("id".to_string(), json!(widget.id));
    out.insert("type".to_string(), json!(widget.widget_type));
    out.insert("enable".to_string(), json!(widget.enabled));
    out.insert("isPublic".to_string(), json!(widget.is_public));
    out.insert("data".to_string(), widget.data.clone());
    Value::Object(out)
}

async fn normalize_snapshot(
    pool: &SqlitePool,
    username: String,
    body: Value,
) -> Result<AppSnapshot, ApiError> {
    let existing = app_snapshot(pool, &username).await?;
    let app_config = body
        .get("appConfig")
        .or_else(|| body.get("app_config"))
        .cloned()
        .unwrap_or(existing.user.app_config);
    let groups = body
        .get("groups")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .enumerate()
                .map(|(index, group)| NavGroup {
                    id: string_value(group, "id").unwrap_or_else(|| Uuid::new_v4().to_string()),
                    title: string_value(group, "title").unwrap_or_default(),
                    sort_order: index as i64,
                    settings: normalize_group_settings(group),
                    items: group
                        .get("items")
                        .and_then(Value::as_array)
                        .map(|items| {
                            items
                                .iter()
                                .enumerate()
                                .map(|(item_index, item)| NavItem {
                                    id: string_value(item, "id")
                                        .unwrap_or_else(|| Uuid::new_v4().to_string()),
                                    title: string_value(item, "title").unwrap_or_default(),
                                    url: string_value(item, "url").unwrap_or_default(),
                                    icon: string_value(item, "icon").unwrap_or_default(),
                                    is_public: item
                                        .get("isPublic")
                                        .or_else(|| item.get("is_public"))
                                        .and_then(Value::as_bool)
                                        .unwrap_or(true),
                                    sort_order: item_index as i64,
                                    metadata: normalize_item_metadata(item),
                                })
                                .collect()
                        })
                        .unwrap_or_default(),
                })
                .collect()
        })
        .unwrap_or(existing.groups);
    let widgets = body
        .get("widgets")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .enumerate()
                .map(|(index, widget)| WidgetRecord {
                    id: string_value(widget, "id").unwrap_or_else(|| Uuid::new_v4().to_string()),
                    widget_type: string_value(widget, "type")
                        .unwrap_or_else(|| "custom".to_string()),
                    enabled: widget
                        .get("enable")
                        .or_else(|| widget.get("enabled"))
                        .and_then(Value::as_bool)
                        .unwrap_or(true),
                    is_public: widget
                        .get("isPublic")
                        .or_else(|| widget.get("is_public"))
                        .and_then(Value::as_bool)
                        .unwrap_or(true),
                    data: widget.get("data").cloned().unwrap_or_else(|| json!({})),
                    layout: normalize_widget_layout(widget),
                    sort_order: index as i64,
                })
                .collect()
        })
        .unwrap_or(existing.widgets);
    Ok(AppSnapshot {
        username: username.clone(),
        user: UserRecord {
            username,
            role: existing.user.role,
            app_config,
            updated_at: Utc::now(),
        },
        system_config: existing.system_config,
        groups,
        widgets,
        version: Utc::now().timestamp_millis(),
    })
}

fn snapshot_to_template_value(snapshot: AppSnapshot) -> Value {
    json!({
        "appConfig": snapshot.user.app_config,
        "groups": snapshot.groups.iter().map(nav_group_to_api_value).collect::<Vec<_>>(),
        "widgets": snapshot.widgets.iter().map(widget_to_api_value).collect::<Vec<_>>(),
    })
}

fn object_from_value(value: Value) -> Map<String, Value> {
    match value {
        Value::Object(map) => map,
        _ => Map::new(),
    }
}

fn unwrap_nested_object(value: &Value, key: &str) -> Value {
    let mut current = value;
    for _ in 0..16 {
        let Some(next) = current
            .as_object()
            .and_then(|object| object.get(key))
            .filter(|nested| nested.is_object())
        else {
            break;
        };
        current = next;
    }
    current.clone()
}

fn normalize_group_settings(group: &Value) -> Value {
    let mut out = object_from_value(unwrap_nested_object(group, "settings"));
    out.remove("items");
    out.remove("settings");
    out.remove("sort_order");
    if let Some(id) = string_value(group, "id") {
        out.insert("id".to_string(), json!(id));
    }
    if let Some(title) = string_value(group, "title") {
        out.insert("title".to_string(), json!(title));
    }
    Value::Object(out)
}

fn normalize_item_metadata(item: &Value) -> Value {
    let mut out = object_from_value(unwrap_nested_object(item, "metadata"));
    out.remove("metadata");
    out.remove("is_public");
    out.remove("sort_order");
    for key in ["id", "title", "url", "icon"] {
        if let Some(value) = item.get(key) {
            out.insert(key.to_string(), value.clone());
        }
    }
    if let Some(value) = item.get("isPublic").or_else(|| item.get("is_public")) {
        out.insert("isPublic".to_string(), value.clone());
    }
    Value::Object(out)
}

const WIDGET_LAYOUT_KEYS: &[&str] = &[
    "x",
    "y",
    "w",
    "h",
    "colSpan",
    "rowSpan",
    "hideOnMobile",
    "opacity",
    "textColor",
];

fn normalize_widget_layout(widget: &Value) -> Value {
    let mut out = Map::new();
    if let Some(layout) = widget.get("layout").and_then(Value::as_object) {
        for (key, value) in layout {
            out.insert(key.clone(), value.clone());
        }
    }
    if let Some(layouts) = widget.get("layouts") {
        out.insert("layouts".to_string(), layouts.clone());
    }
    for key in WIDGET_LAYOUT_KEYS {
        if let Some(value) = widget.get(*key) {
            out.insert((*key).to_string(), value.clone());
        }
    }
    Value::Object(out)
}

fn widget_layout_to_api_object(layout: &Value) -> Map<String, Value> {
    let Some(layout_object) = layout.as_object() else {
        return Map::new();
    };
    let has_top_level_layout = WIDGET_LAYOUT_KEYS
        .iter()
        .any(|key| layout_object.contains_key(*key))
        || layout_object.contains_key("layouts");
    if !has_top_level_layout
        && ["desktop", "tablet", "mobile"]
            .iter()
            .any(|key| layout_object.contains_key(*key))
    {
        let mut out = Map::new();
        out.insert("layouts".to_string(), layout.clone());
        return out;
    }
    layout_object.clone()
}

async fn load_default_template(state: &AppState) -> Result<Value, ApiError> {
    if let Some(row) = sqlx::query(
        "SELECT value_json FROM runtime_cache WHERE kind = 'default_template' AND cache_key = 'global'",
    )
    .fetch_optional(&state.pool)
    .await?
    {
        return Ok(parse_json(row.get::<String, _>("value_json")));
    }
    let default_file = state.config.data_dir.join("default.json");
    let bytes = fs::read(&default_file)
        .await
        .map_err(|_| ApiError::not_found("default_template_not_found"))?;
    serde_json::from_slice(&bytes).map_err(ApiError::from)
}

async fn list_files_with_ext(dir: &Path, exts: &[&str]) -> Result<Vec<String>, ApiError> {
    let mut out = Vec::new();
    let mut entries = match fs::read_dir(dir).await {
        Ok(entries) => entries,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(out),
        Err(err) => return Err(err.into()),
    };
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ok = path
            .extension()
            .and_then(|value| value.to_str())
            .map(|ext| {
                exts.iter()
                    .any(|candidate| candidate.eq_ignore_ascii_case(ext))
            })
            .unwrap_or(false);
        if ok && let Some(name) = path.file_name().and_then(|value| value.to_str()) {
            out.push(name.to_string());
        }
    }
    out.sort();
    Ok(out)
}

async fn save_first_upload(
    dir: &Path,
    url_prefix: &str,
    mut multipart: Multipart,
) -> Result<Json<Value>, ApiError> {
    fs::create_dir_all(dir).await?;
    let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| ApiError::bad_request(err.to_string()))?
    else {
        return Err(ApiError::bad_request("missing_file"));
    };
    let filename = field
        .file_name()
        .map(sanitize_filename)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("upload-{}", Uuid::new_v4()));
    let data = field
        .bytes()
        .await
        .map_err(|err| ApiError::bad_request(err.to_string()))?;
    let target = dir.join(&filename);
    fs::write(&target, data).await?;
    let path = format!("{}/{}", url_prefix.trim_end_matches('/'), filename);
    Ok(Json(json!({
        "success": true,
        "name": filename,
        "filename": filename,
        "path": path,
        "files": [{"filename": filename, "name": filename, "path": path}]
    })))
}

async fn delete_named_file(dir: &Path, name: &str) -> Result<Json<Value>, ApiError> {
    let name = sanitize_filename(name);
    if name.is_empty() {
        return Err(ApiError::bad_request("invalid_name"));
    }
    let target = dir.join(name);
    if fs::remove_file(target).await.is_ok() {
        Ok(Json(json!({"success": true})))
    } else {
        Err(ApiError::not_found("file_not_found"))
    }
}

fn username_from_headers(headers: &HeaderMap, state: &AppState) -> Option<String> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .and_then(|token| {
            decode::<Claims>(
                token,
                &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
                &Validation::new(Algorithm::HS256),
            )
            .ok()
            .map(|data| data.claims.username)
        })
}

fn require_username(headers: &HeaderMap, state: &AppState) -> Result<String, ApiError> {
    username_from_headers(headers, state).ok_or_else(|| ApiError::unauthorized("invalid_token"))
}

fn require_admin(headers: &HeaderMap, state: &AppState) -> Result<String, ApiError> {
    let username = require_username(headers, state)?;
    if username != "admin" {
        return Err(ApiError::forbidden("permission_denied"));
    }
    Ok(username)
}

async fn create_user(state: &AppState, username: &str, password: &str) -> Result<(), ApiError> {
    let username = sanitize_username(username)?;
    if username == "admin" {
        return Err(ApiError::bad_request("invalid_username"));
    }
    if password.trim().is_empty() {
        return Err(ApiError::bad_request("password_required"));
    }
    let exists = sqlx::query("SELECT username FROM users WHERE username = ?")
        .bind(&username)
        .fetch_optional(&state.pool)
        .await?
        .is_some();
    if exists {
        return Err(ApiError::conflict("user_exists"));
    }
    let now = Utc::now().timestamp_millis();
    let password_hash =
        hash(password, DEFAULT_COST).map_err(|err| ApiError::internal(err.to_string()))?;
    sqlx::query(
        r#"INSERT INTO users(username, password_hash, role, app_config_json, created_at, updated_at)
           VALUES (?, ?, 'user', '{}', ?, ?)"#,
    )
    .bind(username)
    .bind(password_hash)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await?;
    Ok(())
}

fn sanitize_username(raw: &str) -> Result<String, ApiError> {
    let username = raw.trim();
    if username.is_empty()
        || username.len() > 64
        || !username
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        return Err(ApiError::bad_request("invalid_username"));
    }
    Ok(username.to_string())
}

fn parse_json(raw: String) -> Value {
    serde_json::from_str(&raw).unwrap_or_else(|_| json!({}))
}

fn parse_json_body(headers: &HeaderMap, body: &[u8]) -> Result<Value, ApiError> {
    let decoded = if headers
        .get(header::CONTENT_ENCODING)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.eq_ignore_ascii_case("gzip"))
        .unwrap_or(false)
    {
        let mut decoder = GzDecoder::new(body);
        let mut out = Vec::new();
        decoder
            .read_to_end(&mut out)
            .map_err(|err| ApiError::bad_request(err.to_string()))?;
        out
    } else {
        body.to_vec()
    };
    serde_json::from_slice(&decoded).map_err(|err| ApiError::bad_request(err.to_string()))
}

fn string_value(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn widget_kind_from_path(path: &str) -> &'static str {
    match path {
        "/api/itab/today-english" => "itab_daily_english",
        "/api/itab/movie-calendar" => "itab_movie_calendar",
        "/api/itab/bing-wallpapers" => ITAB_BING_WALLPAPER_KIND,
        "/api/itab/weather/location" | "/api/itab/weather/search" | "/api/itab/weather/current" => {
            "itab_weather"
        }
        "/api/itab/poem" => "itab_poem",
        _ => "unknown",
    }
}

fn decode_data_url(raw: &str) -> Result<(String, Vec<u8>), ApiError> {
    let (meta, data) = raw
        .split_once(',')
        .ok_or_else(|| ApiError::bad_request("invalid_data_url"))?;
    let content_type = meta
        .strip_prefix("data:")
        .and_then(|value| value.split(';').next())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = STANDARD
        .decode(data)
        .map_err(|_| ApiError::bad_request("invalid_base64"))?;
    Ok((content_type, bytes))
}

fn extension_for_content_type(content_type: &str) -> Option<&'static str> {
    match content_type {
        "image/png" => Some(".png"),
        "image/jpeg" => Some(".jpg"),
        "image/gif" => Some(".gif"),
        "image/webp" => Some(".webp"),
        "image/svg+xml" => Some(".svg"),
        "image/x-icon" | "image/vnd.microsoft.icon" => Some(".ico"),
        _ => None,
    }
}

async fn validate_remote_url(raw: &str) -> Result<reqwest::Url, ApiError> {
    let parsed = reqwest::Url::parse(raw).map_err(|_| ApiError::bad_request("invalid_url"))?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err(ApiError::bad_request("unsupported_protocol"));
    }
    Ok(parsed)
}

async fn is_blocked_wallpaper_host(host: &str) -> Result<bool, ApiError> {
    Ok(is_blocked_host(host).await? && !is_allowed_wallpaper_host(host))
}

async fn is_blocked_host(host: &str) -> Result<bool, ApiError> {
    let host = host.trim().trim_end_matches('.').to_ascii_lowercase();
    if host.is_empty() || host == "localhost" {
        return Ok(true);
    }
    if let Ok(ip) = host.parse::<IpAddr>() {
        return Ok(is_blocked_ip(ip));
    }
    let addrs = tokio::net::lookup_host((host.as_str(), 80))
        .await
        .map_err(|_| ApiError::bad_request("unresolvable_host"))?;
    for addr in addrs {
        if is_blocked_ip(addr.ip()) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn is_blocked_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            ip.is_loopback()
                || ip.is_private()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.octets()[0] >= 224
        }
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
        }
    }
}

fn is_allowed_wallpaper_host(host: &str) -> bool {
    let host = host.trim().trim_end_matches('.').to_ascii_lowercase();
    if host.is_empty() {
        return false;
    }
    let mut allowed = vec![
        "bing.com".to_string(),
        "www.bing.com".to_string(),
        "cn.bing.com".to_string(),
    ];
    if let Ok(raw) = std::env::var("WALLPAPER_WHITELIST") {
        allowed.extend(
            raw.split([',', ';', '\n'])
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|value| value.to_ascii_lowercase()),
        );
    }
    allowed
        .iter()
        .any(|item| host == *item || host.ends_with(&format!(".{item}")))
}

fn copy_response_header(headers_in: &HeaderMap, headers_out: &mut HeaderMap, name: HeaderName) {
    if let Some(value) = headers_in.get(&name) {
        headers_out.insert(name, value.clone());
    }
}

fn sanitize_filename(raw: &str) -> String {
    raw.chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_' | ' '))
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string()
}

#[derive(Debug)]
pub struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
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

    fn forbidden(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            message: message.into(),
        }
    }

    fn conflict(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::CONFLICT,
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

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({"success": false, "error": self.message})),
        )
            .into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(value: anyhow::Error) -> Self {
        ApiError::internal(value.to_string())
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(value: sqlx::Error) -> Self {
        ApiError::internal(value.to_string())
    }
}

impl From<std::io::Error> for ApiError {
    fn from(value: std::io::Error) -> Self {
        ApiError::internal(value.to_string())
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(value: serde_json::Error) -> Self {
        ApiError::internal(value.to_string())
    }
}
