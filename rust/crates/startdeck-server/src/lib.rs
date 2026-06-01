use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use aes_gcm::aead::rand_core::{OsRng, RngCore};
use axum::body::{Body, Bytes};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{DefaultBodyLimit, Multipart, Path as AxumPath, Query, State};
use axum::http::{HeaderMap, HeaderName, HeaderValue, Request, StatusCode, header};
use axum::middleware::map_response;
use axum::response::{IntoResponse, Response};
use axum::routing::{MethodRouter, any, delete, get, get_service, post};
use axum::{Json, Router};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use bcrypt::{DEFAULT_COST, hash, verify};
use chrono::{Duration as ChronoDuration, Utc};
use flate2::read::GzDecoder;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use sqlx::{Row, SqlitePool};
use startdeck_core::models::{
    AppSnapshot, NavGroup, NavItem, SystemConfig, UserRecord, WidgetRecord,
};
use startdeck_core::{
    RuntimeConfig, app_snapshot, migrate_legacy_widget_value, save_snapshot, system_config,
    user_password_hash,
};
use tokio::fs;
use tower::{ServiceBuilder, service_fn};
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;

mod ai_usage;
mod codelife;
mod docker_api;
mod ip_lookup;
mod live_widgets;
mod managed_icons;
mod qweather;
mod static_assets;
mod tapd_defects;
mod telemetry;
mod tencent_map;
mod upstream_allowlist;

const SESSION_COOKIE_NAME: &str = "startdeck_session";
const SESSION_MAX_AGE_SECONDS: i64 = 30 * 24 * 60 * 60;
const SESSION_SIGNING_KEY_BYTES: usize = 32;
const SESSION_KEY_RELATIVE_PATH: &[&str] = &["secrets", "session-signing.key"];
const IMMUTABLE_STATIC_CACHE_CONTROL: &str = "public, max-age=31536000, immutable";
const MUTABLE_STATIC_CACHE_CONTROL: &str = "public, max-age=86400, stale-while-revalidate=604800";
const HTML_CACHE_CONTROL: &str = "no-cache";

#[derive(Clone)]
pub struct AppState {
    config: Arc<RuntimeConfig>,
    pool: SqlitePool,
    http: Client,
    jwt_secret: Arc<Vec<u8>>,
    meta_server_base: Arc<String>,
    remote_widget_fetch_enabled: bool,
}

impl AppState {
    pub fn new(config: RuntimeConfig, pool: SqlitePool) -> Self {
        Self::new_with_remote_widget_fetch(config, pool, true)
    }

    pub fn new_with_remote_widget_fetch(
        config: RuntimeConfig,
        pool: SqlitePool,
        remote_widget_fetch_enabled: bool,
    ) -> Self {
        let meta_server_base = std::env::var("META_SERVER_BASE_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:9002".to_string());
        Self::new_with_meta_server_base(config, pool, remote_widget_fetch_enabled, meta_server_base)
    }

    pub fn new_with_meta_server_base(
        config: RuntimeConfig,
        pool: SqlitePool,
        remote_widget_fetch_enabled: bool,
        meta_server_base: impl Into<String>,
    ) -> Self {
        Self::try_new_with_meta_server_base(
            config,
            pool,
            remote_widget_fetch_enabled,
            meta_server_base,
        )
        .expect("load StartDeck session signing key")
    }

    pub fn try_new_with_meta_server_base(
        config: RuntimeConfig,
        pool: SqlitePool,
        remote_widget_fetch_enabled: bool,
        meta_server_base: impl Into<String>,
    ) -> anyhow::Result<Self> {
        let jwt_secret = load_session_signing_key(&config)?;
        Ok(Self {
            config: Arc::new(config),
            pool,
            http: Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .expect("reqwest client"),
            jwt_secret: Arc::new(jwt_secret),
            meta_server_base: Arc::new(meta_server_base.into().trim_end_matches('/').to_string()),
            remote_widget_fetch_enabled,
        })
    }

    pub async fn run_startup_icon_migration(&self) -> anyhow::Result<()> {
        managed_icons::cleanup_failed_assets(self)
            .await
            .map_err(|error| anyhow::anyhow!(error.into_message()))?;
        let rows = sqlx::query("SELECT username FROM users ORDER BY username ASC")
            .fetch_all(&self.pool)
            .await?;
        for row in rows {
            let username = row.get::<String, _>("username");
            let snapshot = app_snapshot(&self.pool, &username).await?;
            let normalized = normalize_existing_snapshot(
                self,
                snapshot,
                managed_icons::IconNormalizationMode::PreserveEmpty,
            )
            .await
            .map_err(|error| anyhow::anyhow!(error.into_message()))?;
            save_snapshot(&self.pool, &normalized).await?;
        }
        normalize_default_template_file_for_startup(self)
            .await
            .map_err(|error| anyhow::anyhow!(error.into_message()))?;
        Ok(())
    }
}

fn load_session_signing_key(config: &RuntimeConfig) -> anyhow::Result<Vec<u8>> {
    if let Ok(value) = std::env::var("STARTDECK_SECRET") {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            anyhow::bail!("STARTDECK_SECRET must be base64-encoded 32 random bytes");
        }
        return decode_session_signing_key(trimmed, "STARTDECK_SECRET");
    }

    let key_path = SESSION_KEY_RELATIVE_PATH
        .iter()
        .fold(config.data_dir.clone(), |path, segment| path.join(segment));
    match std::fs::read_to_string(&key_path) {
        Ok(value) => decode_session_signing_key(value.trim(), &key_path.display().to_string()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            let parent = key_path.parent().ok_or_else(|| {
                anyhow::anyhow!("session signing key path has no parent directory")
            })?;
            std::fs::create_dir_all(parent)?;
            let mut key = vec![0_u8; SESSION_SIGNING_KEY_BYTES];
            OsRng.fill_bytes(&mut key);
            let encoded = STANDARD.encode(&key);
            let mut options = std::fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                options.mode(0o600);
            }
            match options.open(&key_path) {
                Ok(mut file) => {
                    file.write_all(encoded.as_bytes())?;
                    file.write_all(b"\n")?;
                    Ok(key)
                }
                Err(open_err) if open_err.kind() == std::io::ErrorKind::AlreadyExists => {
                    let value = std::fs::read_to_string(&key_path)?;
                    decode_session_signing_key(value.trim(), &key_path.display().to_string())
                }
                Err(open_err) => Err(open_err.into()),
            }
        }
        Err(err) => Err(err.into()),
    }
}

fn decode_session_signing_key(value: &str, source: &str) -> anyhow::Result<Vec<u8>> {
    let decoded = STANDARD
        .decode(value)
        .map_err(|err| anyhow::anyhow!("{source} is not valid base64: {err}"))?;
    if decoded.len() != SESSION_SIGNING_KEY_BYTES {
        anyhow::bail!("{source} must decode to exactly 32 bytes");
    }
    Ok(decoded)
}

pub fn app(state: AppState) -> Router {
    let public_dir = state.config.public_dir.clone();
    let backgrounds_dir = state.config.backgrounds_dir.clone();
    let mobile_dir = state.config.mobile_backgrounds_dir.clone();
    let assets_dir = static_assets::public_subdir(&state.config, "assets");
    let assets_fallback_dir = assets_dir.clone();
    let sd_live_assets_dir = static_assets::public_subdir(&state.config, "sd-live-assets");
    let sd_assets_dir = static_assets::public_subdir(&state.config, "sd");
    let intro_assets_dir = static_assets::public_subdir(&state.config, "intro-assets");
    Router::new()
        .route("/healthz", get(healthz))
        .route("/ws", get(ws_handler))
        .route("/proxy", any(proxy_request))
        .route("/api/login", post(login))
        .route("/api/session", get(session))
        .route("/api/logout", post(logout))
        .route("/api/data", get(get_data))
        .route("/api/data/import", post(import_data))
        .route("/api/save", post(save_data))
        .route("/api/default/save", post(save_default))
        .route("/api/reset", post(reset_data))
        .route("/api/version", get(version))
        .route("/api/app-version/check", get(app_version_check))
        .route("/api/admin/users", get(list_users).post(add_user))
        .route("/api/admin/users/{username}", delete(delete_user))
        .route("/api/admin/license", post(upload_license))
        .route(
            "/api/system-config",
            get(get_system_config).post(update_system_config),
        )
        .route("/api/widgets/{id}", get(get_widget).put(save_widget))
        .route("/api/ai-usage/query", post(ai_usage::query_usage))
        .route(
            "/api/ai-usage/credentials/{widget_id}/{provider_id}",
            get(ai_usage::get_credential)
                .put(ai_usage::save_credential)
                .delete(ai_usage::delete_credential),
        )
        .route("/api/tapd-defects/query", post(tapd_defects::query_defects))
        .route(
            "/api/tapd-defects/workspace",
            post(tapd_defects::resolve_workspace),
        )
        .route(
            "/api/tapd-defects/credentials/{widget_id}",
            get(tapd_defects::get_credential)
                .put(tapd_defects::save_credential)
                .delete(tapd_defects::delete_credential),
        )
        .route(
            "/api/custom-scripts",
            get(get_custom_scripts).post(save_custom_scripts),
        )
        .route("/api/site/resolve", get(managed_icons::resolve_site))
        .route("/api/icons", post(managed_icons::create_icon_asset))
        .route(
            "/api/icons/{id}",
            get(managed_icons::get_icon_asset).head(managed_icons::head_icon_asset),
        )
        .route("/api/ip/history", get(ip_lookup::user_ip_history))
        .route("/api/ip", get(ip_lookup::ip_info))
        .route("/api/ping", get(ping))
        .route("/api/rtt", get(rtt))
        .route("/api/visitor/track", post(track_visitor))
        .route("/api/system/stats", get(telemetry::system_stats))
        .route("/api/docker-status", get(docker_api::docker_status))
        .route("/api/docker/containers", get(docker_api::docker_containers))
        .route("/api/docker/info", get(docker_api::docker_info))
        .route(
            "/api/docker/check-updates",
            post(docker_api::docker_check_updates),
        )
        .route(
            "/api/docker/container/{id}/{action}",
            post(docker_api::docker_container_action),
        )
        .route(
            "/api/docker/container/{id}/inspect-lite",
            get(docker_api::docker_inspect),
        )
        .route("/api/docker/export-logs", get(docker_api::docker_logs))
        .route("/api/backgrounds", get(list_backgrounds))
        .route("/api/mobile_backgrounds", get(list_mobile_backgrounds))
        .route("/api/backgrounds/upload", post(upload_background))
        .route(
            "/api/mobile_backgrounds/upload",
            post(upload_mobile_background),
        )
        .route("/api/backgrounds/{name}", delete(delete_background))
        .route(
            "/api/mobile_backgrounds/{name}",
            delete(delete_mobile_background),
        )
        .route("/api/wallpaper/proxy", get(wallpaper_proxy))
        .route(
            "/api/config-versions",
            get(list_config_versions).post(save_config_version),
        )
        .route("/api/config-versions/restore", post(restore_config_version))
        .route("/api/config-versions/{id}", delete(delete_config_version))
        .route("/api/today-english", get(live_widgets::cached_widget_data))
        .route("/api/movie-calendar", get(live_widgets::cached_widget_data))
        .route(
            "/api/bing-wallpapers",
            get(live_widgets::cached_widget_data),
        )
        .route(
            "/api/weather/location",
            get(live_widgets::cached_widget_data),
        )
        .route("/api/weather/search", get(live_widgets::cached_widget_data))
        .route(
            "/api/weather/current",
            get(live_widgets::cached_widget_data),
        )
        .route("/api/poem", get(live_widgets::cached_widget_data))
        .route(
            "/api/today-english/media/{kind}",
            get(live_widgets::cached_today_english_media),
        )
        .route(
            "/api/movie-calendar/image/{kind}",
            get(live_widgets::cached_movie_calendar_image),
        )
        .route("/icon-cache/{*path}", any(removed_icon_route))
        .route("/icons/{*path}", any(removed_icon_route))
        .route("/cache/{*path}", any(removed_icon_route))
        .route(
            "/favicon.ico",
            immutable_file_service(public_dir.join("favicon.ico")),
        )
        .route(
            "/favicon.svg",
            immutable_file_service(public_dir.join("favicon.svg")),
        )
        .route(
            "/default-wallpaper.svg",
            immutable_file_service(public_dir.join("default-wallpaper.svg")),
        )
        .route(
            "/ICON.PNG",
            immutable_file_service(public_dir.join("ICON.PNG")),
        )
        .route(
            "/intro.html",
            html_file_service(public_dir.join("intro.html")),
        )
        .route(
            "/index.html",
            html_file_service(public_dir.join("index.html")),
        )
        .nest_service(
            "/assets",
            ServiceBuilder::new()
                .layer(map_response(insert_immutable_static_cache))
                .service(ServeDir::new(assets_dir).fallback(service_fn(
                    move |request: Request<Body>| {
                        let assets_dir = assets_fallback_dir.clone();
                        async move {
                            Ok::<_, std::convert::Infallible>(
                                stale_entry_asset_fallback(assets_dir, request).await,
                            )
                        }
                    },
                ))),
        )
        .nest_service(
            "/sd-live-assets",
            ServiceBuilder::new()
                .layer(map_response(insert_immutable_static_cache))
                .service(ServeDir::new(sd_live_assets_dir)),
        )
        .nest_service(
            "/sd",
            ServiceBuilder::new()
                .layer(map_response(insert_immutable_static_cache))
                .service(ServeDir::new(sd_assets_dir)),
        )
        .nest_service(
            "/intro-assets",
            ServiceBuilder::new()
                .layer(map_response(insert_immutable_static_cache))
                .service(ServeDir::new(intro_assets_dir)),
        )
        .nest_service(
            "/backgrounds",
            ServiceBuilder::new()
                .layer(map_response(insert_mutable_static_cache))
                .service(ServeDir::new(backgrounds_dir)),
        )
        .nest_service(
            "/mobile_backgrounds",
            ServiceBuilder::new()
                .layer(map_response(insert_mutable_static_cache))
                .service(ServeDir::new(mobile_dir)),
        )
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

fn immutable_file_service(path: impl Into<std::path::PathBuf>) -> MethodRouter<AppState> {
    get_service(ServeFile::new(path.into())).layer(map_response(insert_immutable_static_cache))
}

fn html_file_service(path: impl Into<std::path::PathBuf>) -> MethodRouter<AppState> {
    get_service(ServeFile::new(path.into())).layer(map_response(insert_html_cache))
}

async fn insert_immutable_static_cache<B>(mut response: Response<B>) -> Response<B> {
    let status = response.status();
    insert_cache_control_if_success(
        response.headers_mut(),
        status,
        IMMUTABLE_STATIC_CACHE_CONTROL,
    );
    response
}

async fn insert_mutable_static_cache<B>(mut response: Response<B>) -> Response<B> {
    let status = response.status();
    insert_cache_control_if_success(response.headers_mut(), status, MUTABLE_STATIC_CACHE_CONTROL);
    response
}

async fn insert_html_cache<B>(mut response: Response<B>) -> Response<B> {
    let status = response.status();
    insert_cache_control_if_success(response.headers_mut(), status, HTML_CACHE_CONTROL);
    response
}

async fn stale_entry_asset_fallback(assets_dir: PathBuf, request: Request<Body>) -> Response {
    let Some(extension) = stale_entry_asset_extension(request.uri().path()) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let Some(path) = current_entry_asset_path(&assets_dir, extension).await else {
        return StatusCode::NOT_FOUND.into_response();
    };
    match fs::read(path).await {
        Ok(bytes) => {
            let mut response = Response::new(Body::from(bytes));
            response.headers_mut().insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static(entry_asset_content_type(extension)),
            );
            response.headers_mut().insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static(HTML_CACHE_CONTROL),
            );
            response
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

fn stale_entry_asset_extension(path: &str) -> Option<&'static str> {
    let file_name = path.rsplit('/').next()?;
    let (name, extension) = file_name.rsplit_once('.')?;
    if !name.starts_with("index-") {
        return None;
    }
    let hash = name.strip_prefix("index-")?;
    if hash.len() < 6
        || !hash
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    {
        return None;
    }
    match extension {
        "js" => Some("js"),
        "css" => Some("css"),
        _ => None,
    }
}

async fn current_entry_asset_path(assets_dir: &Path, extension: &str) -> Option<PathBuf> {
    let mut dir = fs::read_dir(assets_dir).await.ok()?;
    let mut selected: Option<(SystemTime, PathBuf)> = None;
    while let Some(entry) = dir.next_entry().await.ok()? {
        let file_name = entry.file_name();
        let Some(file_name) = file_name.to_str() else {
            continue;
        };
        if !file_name.starts_with("index-") || !file_name.ends_with(&format!(".{extension}")) {
            continue;
        }
        let modified = entry
            .metadata()
            .await
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        match &selected {
            Some((current_modified, _)) if *current_modified >= modified => {}
            _ => selected = Some((modified, entry.path())),
        }
    }
    selected.map(|(_, path)| path)
}

fn entry_asset_content_type(extension: &str) -> &'static str {
    match extension {
        "css" => "text/css; charset=utf-8",
        _ => "text/javascript; charset=utf-8",
    }
}

fn insert_cache_control_if_success(
    headers: &mut HeaderMap,
    status: StatusCode,
    value: &'static str,
) {
    if status.is_success() && !headers.contains_key(header::CACHE_CONTROL) {
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(value));
    }
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

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    username: String,
    exp: i64,
    sid: String,
}

#[derive(Debug, Clone)]
pub(crate) struct AuthSession {
    username: String,
    sid: String,
}

#[derive(Debug, Clone)]
pub(crate) enum SessionCookieAuth {
    Missing,
    Valid(AuthSession),
    Invalid,
}

async fn healthz() -> Json<Value> {
    Json(json!({"ok": true, "service": "startdeck-server"}))
}

async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<LoginRequest>,
) -> Response {
    match login_inner(state, headers, req).await {
        Ok(response) => response,
        Err(error) => error.with_no_store().into_response(),
    }
}

async fn login_inner(
    state: AppState,
    headers: HeaderMap,
    req: LoginRequest,
) -> Result<Response, ApiError> {
    let username = req.username.unwrap_or_default();
    if username.trim().is_empty() {
        return Err(ApiError::bad_request("username_required"));
    }
    let username = sanitize_username(&username)?;
    let Some(hash) = user_password_hash(&state.pool, &username).await? else {
        return Err(ApiError::unauthorized("user_not_found"));
    };
    if !verify(req.password, &hash).unwrap_or(false) {
        return Err(ApiError::unauthorized("password_incorrect"));
    }
    let sid = Uuid::new_v4().to_string();
    let claims = Claims {
        username: username.clone(),
        exp: (Utc::now() + ChronoDuration::days(30)).timestamp(),
        sid: sid.clone(),
    };
    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_ref().as_slice()),
    )
    .map_err(|err| ApiError::internal(err.to_string()))?;
    let secure = should_mark_session_cookie_secure(&headers);
    let mut response =
        Json(json!({"success": true, "username": username, "sessionGeneration": sid}))
            .into_response();
    insert_no_store(response.headers_mut());
    insert_set_cookie(response.headers_mut(), session_cookie(&token, secure));
    Ok(response)
}

async fn session(State(state): State<AppState>, headers: HeaderMap) -> Response {
    match session_cookie_auth(&headers, &state) {
        SessionCookieAuth::Missing => {
            let mut response =
                Json(json!({"success": true, "authenticated": false, "username": Value::Null}))
                    .into_response();
            insert_no_store(response.headers_mut());
            response
        }
        SessionCookieAuth::Valid(session) => {
            let mut response = Json(json!({
                "success": true,
                "authenticated": true,
                "username": session.username,
                "sessionGeneration": session.sid,
            }))
            .into_response();
            insert_no_store(response.headers_mut());
            response
        }
        SessionCookieAuth::Invalid => ApiError::invalid_token_with_cookie(&headers)
            .with_no_store()
            .into_response(),
    }
}

async fn logout(headers: HeaderMap) -> Response {
    let mut response = Json(json!({"success": true, "authenticated": false})).into_response();
    insert_no_store(response.headers_mut());
    insert_expired_session_cookies(
        response.headers_mut(),
        &headers,
        should_mark_session_cookie_secure(&headers),
    );
    response
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
        .bind(&username)
        .execute(&state.pool)
        .await?;
    managed_icons::cleanup_unreferenced_private_icons(&state, &username).await?;
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

async fn get_data(State(state): State<AppState>, headers: HeaderMap) -> Result<Response, ApiError> {
    match session_cookie_auth(&headers, &state) {
        SessionCookieAuth::Valid(session) => {
            let snapshot = app_snapshot(&state.pool, &session.username).await?;
            Ok(Json(snapshot_to_api_value(snapshot)).into_response())
        }
        SessionCookieAuth::Missing => {
            Ok(Json(default_template_to_api_value(state.config.as_ref()).await?).into_response())
        }
        SessionCookieAuth::Invalid => {
            let mut response =
                Json(default_template_to_api_value(state.config.as_ref()).await?).into_response();
            insert_no_store(response.headers_mut());
            insert_expired_session_cookies(
                response.headers_mut(),
                &headers,
                should_mark_session_cookie_secure(&headers),
            );
            Ok(response)
        }
    }
}

async fn save_data(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let body = parse_json_body(&headers, &body)?;
    if let Some(version) = ignored_stale_save_version(&state.pool, &username, &body).await? {
        let snapshot = app_snapshot(&state.pool, &username).await?;
        return Ok(Json(json!({
            "success": true,
            "ignored": true,
            "version": version,
            "data": snapshot_to_api_value(snapshot),
        })));
    }
    let snapshot = normalize_snapshot(
        &state,
        username,
        body,
        managed_icons::IconNormalizationMode::PreserveEmpty,
    )
    .await?;
    save_snapshot(&state.pool, &snapshot).await?;
    managed_icons::cleanup_unreferenced_private_icons(&state, &snapshot.username).await?;
    let snapshot = app_snapshot(&state.pool, &snapshot.username).await?;
    Ok(Json(json!({
        "success": true,
        "version": snapshot.version,
        "data": snapshot_to_api_value(snapshot),
    })))
}

async fn import_data(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let snapshot = normalize_snapshot(
        &state,
        username,
        body,
        managed_icons::IconNormalizationMode::FillMissingFromUrl,
    )
    .await?;
    save_snapshot(&state.pool, &snapshot).await?;
    managed_icons::cleanup_unreferenced_private_icons(&state, &snapshot.username).await?;
    let snapshot = app_snapshot(&state.pool, &snapshot.username).await?;
    Ok(Json(json!({
        "success": true,
        "version": snapshot.version,
        "data": snapshot_to_api_value(snapshot),
    })))
}

async fn save_default(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let username = require_admin(&headers, &state)?;
    let snapshot = app_snapshot(&state.pool, &username).await?;
    let (template, created_assets) = snapshot_to_template_value(&state, snapshot).await?;
    if let Err(error) = write_default_template_file(state.config.as_ref(), &template).await {
        managed_icons::mark_orphan_assets(&state, &created_assets, "staged_failed").await?;
        return Err(error);
    }
    Ok(Json(json!({
        "success": true,
        "version": Utc::now().timestamp_millis(),
        "data": template,
    })))
}

async fn reset_data(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let template = read_default_template_file(state.config.as_ref()).await?;
    let snapshot = normalize_snapshot(
        &state,
        username,
        template,
        managed_icons::IconNormalizationMode::PreserveEmpty,
    )
    .await?;
    save_snapshot(&state.pool, &snapshot).await?;
    managed_icons::cleanup_unreferenced_private_icons(&state, &snapshot.username).await?;
    let snapshot = app_snapshot(&state.pool, &snapshot.username).await?;
    Ok(Json(json!({
        "success": true,
        "version": snapshot.version,
        "data": snapshot_to_api_value(snapshot),
    })))
}

async fn version(State(state): State<AppState>, headers: HeaderMap) -> Result<Response, ApiError> {
    match session_cookie_auth(&headers, &state) {
        SessionCookieAuth::Valid(session) => {
            let snapshot = app_snapshot(&state.pool, &session.username).await?;
            Ok(Json(json!({"version": snapshot.version})).into_response())
        }
        SessionCookieAuth::Missing => {
            Ok(Json(json!({"version": 0, "isGuest": true})).into_response())
        }
        SessionCookieAuth::Invalid => {
            let mut response = Json(json!({"version": 0, "isGuest": true})).into_response();
            insert_no_store(response.headers_mut());
            insert_expired_session_cookies(
                response.headers_mut(),
                &headers,
                should_mark_session_cookie_secure(&headers),
            );
            Ok(response)
        }
    }
}

async fn app_version_check(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let current_version = env!("CARGO_PKG_VERSION");
    match fetch_latest_docker_hub_version(&state).await {
        Ok(latest_version) => Ok(Json(json!({
            "success": true,
            "currentVersion": current_version,
            "latestVersion": latest_version,
            "hasUpdate": latest_version
                .as_deref()
                .map(|latest| is_remote_version_newer(current_version, latest))
                .unwrap_or(false),
        }))),
        Err(error) => Ok(Json(json!({
            "success": false,
            "currentVersion": current_version,
            "latestVersion": Value::Null,
            "hasUpdate": false,
            "error": error,
        }))),
    }
}

async fn get_system_config(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<SystemConfig>, ApiError> {
    let Some(_) = optional_username_from_headers(&headers, &state)? else {
        return Ok(Json(SystemConfig::default()));
    };
    Ok(Json(system_config(&state.pool).await?))
}

async fn update_system_config(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    require_admin(&headers, &state)?;
    if body.get("authMode").is_some() || body.get("auth_mode").is_some() {
        return Err(ApiError::bad_request("auth_mode_removed"));
    }
    let enable_docker = body
        .get("enableDocker")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let mut config_json = body;
    if let Some(map) = config_json.as_object_mut() {
        map.remove("authMode");
        map.remove("auth_mode");
    }
    sqlx::query(
        r#"INSERT INTO system_config(id, enable_docker, config_json, updated_at)
           VALUES (1, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             enable_docker=excluded.enable_docker,
             config_json=excluded.config_json,
             updated_at=excluded.updated_at"#,
    )
    .bind(enable_docker as i64)
    .bind(config_json.to_string())
    .bind(Utc::now().timestamp_millis())
    .execute(&state.pool)
    .await?;
    Ok(Json(serde_json::to_value(
        system_config(&state.pool).await?,
    )?))
}

async fn get_widget(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<Value>, ApiError> {
    let Some(username) = optional_username_from_headers(&headers, &state)? else {
        let template = read_default_template_file(state.config.as_ref()).await?;
        let widget = default_template_widget(&template, &id)
            .ok_or_else(|| ApiError::not_found("widget_not_found"))?;
        return Ok(Json(widget));
    };
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
           ON CONFLICT(username, id) DO UPDATE SET
             widget_type=excluded.widget_type,
             enabled=excluded.enabled,
             is_public=excluded.is_public,
             data_json=excluded.data_json,
             layout_json=excluded.layout_json,
             sort_order=excluded.sort_order"#,
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
    .bind(false as i64)
    .bind(body.get("data").cloned().unwrap_or_else(|| json!({})).to_string())
    .bind(normalize_widget_layout(&body).to_string())
    .bind(Utc::now().timestamp_millis())
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({"success": true, "id": id})))
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

async fn ping(Query(query): Query<HashMap<String, String>>) -> Json<Value> {
    let url = query.get("url").cloned().unwrap_or_default();
    Json(json!({"success": !url.is_empty(), "url": url, "latency": null}))
}

async fn removed_icon_route() -> StatusCode {
    StatusCode::NOT_FOUND
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

async fn list_config_versions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let rows = sqlx::query(
        "SELECT id, label, created_at FROM config_versions WHERE username = ? ORDER BY created_at DESC",
    )
    .bind(username)
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
        "INSERT INTO config_versions(id, username, label, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&username)
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
    let username = require_username(&headers, &state)?;
    let id = body
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("missing_id"))?;
    let row =
        sqlx::query("SELECT snapshot_json FROM config_versions WHERE id = ? AND username = ?")
            .bind(id)
            .bind(&username)
            .fetch_optional(&state.pool)
            .await?;
    let Some(row) = row else {
        return Err(ApiError::not_found("version_not_found"));
    };
    let mut snapshot: AppSnapshot = serde_json::from_str(&row.get::<String, _>("snapshot_json"))?;
    snapshot.username = username.clone();
    snapshot.user.username = username.clone();
    let snapshot = normalize_existing_snapshot(
        &state,
        snapshot,
        managed_icons::IconNormalizationMode::PreserveEmpty,
    )
    .await?;
    save_snapshot(&state.pool, &snapshot).await?;
    managed_icons::cleanup_unreferenced_private_icons(&state, &username).await?;
    let snapshot = app_snapshot(&state.pool, &username).await?;
    Ok(Json(json!({
        "success": true,
        "version": snapshot.version,
        "data": snapshot_to_api_value(snapshot),
    })))
}

async fn delete_config_version(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    sqlx::query("DELETE FROM config_versions WHERE id = ? AND username = ?")
        .bind(id)
        .bind(username)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({"success": true})))
}

async fn ws_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> Response {
    match session_cookie_auth(&headers, &state) {
        SessionCookieAuth::Valid(session) => ws
            .on_upgrade(move |socket| ws_loop(socket, state, session))
            .into_response(),
        SessionCookieAuth::Missing => ApiError::unauthorized("invalid_token").into_response(),
        SessionCookieAuth::Invalid => ApiError::invalid_token_with_cookie(&headers).into_response(),
    }
}

async fn ws_loop(mut socket: WebSocket, _state: AppState, session: AuthSession) {
    let _ = socket
        .send(Message::Text(
            json!({
                "type": "auth_success",
                "payload": {
                    "sessionID": session.sid,
                    "username": session.username
                }
            })
            .to_string()
            .into(),
        ))
        .await;
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
                        let response = handle_ws_text(text.as_str());
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

fn handle_ws_text(text: &str) -> Option<String> {
    let value: Value = serde_json::from_str(text).ok()?;
    let message_type = value.get("type").and_then(Value::as_str)?;
    match message_type {
        "ping" => Some(json!({"type": "pong"}).to_string()),
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
        "todo_update" => Some(value.to_string()),
        _ => None,
    }
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

const STARTDECK_DOCKER_HUB_TAGS_URL: &str =
    "https://hub.docker.com/v2/repositories/apkdv/startdeck/tags?page_size=100";

#[derive(Debug, Deserialize)]
struct DockerHubTagsResponse {
    results: Vec<DockerHubTag>,
}

#[derive(Debug, Deserialize)]
struct DockerHubTag {
    name: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ParsedVersionTag {
    numbers: [u64; 4],
    prerelease: Vec<String>,
}

async fn fetch_latest_docker_hub_version(state: &AppState) -> Result<Option<String>, String> {
    let response = state
        .http
        .get(STARTDECK_DOCKER_HUB_TAGS_URL)
        .send()
        .await
        .map_err(|err| format!("docker_hub_request_failed: {err}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("docker_hub_status_{}", status.as_u16()));
    }
    let data = response
        .json::<DockerHubTagsResponse>()
        .await
        .map_err(|err| format!("docker_hub_parse_failed: {err}"))?;
    Ok(select_latest_docker_hub_version(data.results))
}

fn select_latest_docker_hub_version(tags: Vec<DockerHubTag>) -> Option<String> {
    tags.into_iter()
        .filter_map(|tag| tag.name)
        .filter(|name| parse_version_tag(name).is_some())
        .max_by(|left, right| compare_version_tags(left, right))
}

fn parse_version_tag(tag: &str) -> Option<ParsedVersionTag> {
    let tag = tag.trim().strip_prefix('v').unwrap_or_else(|| tag.trim());
    if tag.is_empty() {
        return None;
    }

    let (body, dash_prerelease) = tag.split_once('-').unwrap_or((tag, ""));
    let mut numbers = Vec::new();
    let mut dot_prerelease = Vec::new();
    for part in body.split('.') {
        if dot_prerelease.is_empty() && part.chars().all(|ch| ch.is_ascii_digit()) {
            numbers.push(part.parse::<u64>().ok()?);
            continue;
        }
        dot_prerelease.push(part.to_string());
    }

    if !(2..=4).contains(&numbers.len()) || dot_prerelease.iter().any(String::is_empty) {
        return None;
    }

    let mut normalized_numbers = [0_u64; 4];
    for (index, value) in numbers.into_iter().enumerate() {
        normalized_numbers[index] = value;
    }

    let mut prerelease = dot_prerelease;
    if !dash_prerelease.is_empty() {
        prerelease.extend(dash_prerelease.split('.').map(ToString::to_string));
    }
    if prerelease.iter().any(|part| part.is_empty()) {
        return None;
    }

    Some(ParsedVersionTag {
        numbers: normalized_numbers,
        prerelease,
    })
}

fn compare_version_tags(left: &str, right: &str) -> std::cmp::Ordering {
    let Some(left_version) = parse_version_tag(left) else {
        return std::cmp::Ordering::Less;
    };
    let Some(right_version) = parse_version_tag(right) else {
        return std::cmp::Ordering::Greater;
    };
    left_version
        .numbers
        .cmp(&right_version.numbers)
        .then_with(|| compare_prerelease(&left_version.prerelease, &right_version.prerelease))
}

fn compare_prerelease(left: &[String], right: &[String]) -> std::cmp::Ordering {
    if left.is_empty() && right.is_empty() {
        return std::cmp::Ordering::Equal;
    }
    if left.is_empty() {
        return std::cmp::Ordering::Greater;
    }
    if right.is_empty() {
        return std::cmp::Ordering::Less;
    }

    for index in 0..left.len().max(right.len()) {
        let Some(left_part) = left.get(index) else {
            return std::cmp::Ordering::Less;
        };
        let Some(right_part) = right.get(index) else {
            return std::cmp::Ordering::Greater;
        };
        if left_part == right_part {
            continue;
        }

        let left_number = left_part.parse::<u64>();
        let right_number = right_part.parse::<u64>();
        return match (left_number, right_number) {
            (Ok(left_value), Ok(right_value)) => left_value.cmp(&right_value),
            (Ok(_), Err(_)) => std::cmp::Ordering::Less,
            (Err(_), Ok(_)) => std::cmp::Ordering::Greater,
            (Err(_), Err(_)) => left_part.cmp(right_part),
        };
    }

    std::cmp::Ordering::Equal
}

fn is_remote_version_newer(current: &str, remote: &str) -> bool {
    compare_version_tags(remote, current).is_gt()
}

async fn spa_or_404(State(state): State<AppState>, uri: axum::http::Uri) -> Response {
    if uri.path().starts_with("/api/") || uri.path().starts_with("/ws") {
        return StatusCode::NOT_FOUND.into_response();
    }
    if is_explicit_file_path(uri.path()) {
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
            response.headers_mut().insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static(HTML_CACHE_CONTROL),
            );
            response
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

fn is_explicit_file_path(path: &str) -> bool {
    path.rsplit('/')
        .next()
        .filter(|segment| !segment.is_empty())
        .is_some_and(|segment| segment.contains('.'))
}

fn snapshot_to_api_value(snapshot: AppSnapshot) -> Value {
    json!({
        "username": snapshot.username,
        "user": snapshot.user,
        "systemConfig": snapshot.system_config,
        "enableDocker": snapshot.system_config.enable_docker,
        "appConfig": snapshot.user.app_config,
        "groups": snapshot.groups.iter().map(nav_group_to_api_value).collect::<Vec<_>>(),
        "widgets": snapshot.widgets.iter().map(widget_to_api_value).collect::<Vec<_>>(),
        "version": snapshot.version,
    })
}

async fn default_template_to_api_value(config: &RuntimeConfig) -> Result<Value, ApiError> {
    let template = read_default_template_file(config).await?;
    let system = SystemConfig::default();
    let mut out = object_from_value(template);
    let groups = default_template_groups(out.remove("groups").unwrap_or_else(|| json!([])));
    let widgets = default_template_widgets(out.remove("widgets").unwrap_or_else(|| json!([])));
    out.entry("appConfig".to_string())
        .or_insert_with(|| json!({}));
    out.insert("groups".to_string(), groups);
    out.insert("widgets".to_string(), widgets);
    out.insert("username".to_string(), json!("__guest__"));
    out.insert("isGuest".to_string(), json!(true));
    out.insert("systemConfig".to_string(), serde_json::to_value(&system)?);
    out.insert("enableDocker".to_string(), json!(system.enable_docker));
    out.insert("version".to_string(), json!(0));
    Ok(Value::Object(out))
}

async fn normalize_default_template_file_for_startup(state: &AppState) -> Result<(), ApiError> {
    let template = read_default_template_file(state.config.as_ref()).await?;
    let mut created_assets = Vec::new();
    let normalized = normalize_default_template_value(state, template, &mut created_assets).await?;
    verify_template_icon_assets(state, &normalized).await?;
    if let Err(error) = write_default_template_file(state.config.as_ref(), &normalized).await {
        managed_icons::mark_orphan_assets(state, &created_assets, "staged_failed").await?;
        return Err(error);
    }
    Ok(())
}

async fn normalize_default_template_value(
    state: &AppState,
    mut template: Value,
    created_assets: &mut Vec<String>,
) -> Result<Value, ApiError> {
    let Some(object) = template.as_object_mut() else {
        return Ok(template);
    };
    let groups = object.remove("groups").unwrap_or_else(|| json!([]));
    object.insert(
        "groups".to_string(),
        normalize_default_template_groups_for_startup(state, groups, created_assets).await?,
    );
    Ok(template)
}

async fn normalize_default_template_groups_for_startup(
    state: &AppState,
    value: Value,
    created_assets: &mut Vec<String>,
) -> Result<Value, ApiError> {
    let Value::Array(groups) = value else {
        return Ok(json!([]));
    };
    let mut out = Vec::with_capacity(groups.len());
    for mut group in groups {
        if let Some(object) = group.as_object_mut() {
            let items = object.remove("items").unwrap_or_else(|| json!([]));
            object.insert(
                "items".to_string(),
                normalize_default_template_items_for_startup(state, items, created_assets).await?,
            );
        }
        out.push(group);
    }
    Ok(Value::Array(out))
}

async fn normalize_default_template_items_for_startup(
    state: &AppState,
    value: Value,
    created_assets: &mut Vec<String>,
) -> Result<Value, ApiError> {
    let Value::Array(items) = value else {
        return Ok(json!([]));
    };
    let mut out = Vec::with_capacity(items.len());
    for mut item in items {
        let raw_icon = string_value(&item, "icon").unwrap_or_default();
        let icon =
            normalize_template_icon_value(state, &raw_icon, created_assets, "startup").await?;
        if let Some(object) = item.as_object_mut() {
            object.insert("icon".to_string(), json!(icon));
        }
        out.push(item);
    }
    Ok(Value::Array(out))
}

fn default_template_groups(value: Value) -> Value {
    let Value::Array(groups) = value else {
        return json!([]);
    };
    Value::Array(
        groups
            .into_iter()
            .map(|mut group| {
                strip_visibility_fields(&mut group);
                if let Some(object) = group.as_object_mut() {
                    let items = object.remove("items").unwrap_or_else(|| json!([]));
                    object.insert("items".to_string(), default_template_items(items));
                }
                group
            })
            .collect(),
    )
}

fn default_template_items(value: Value) -> Value {
    let Value::Array(items) = value else {
        return json!([]);
    };
    Value::Array(
        items
            .into_iter()
            .map(|mut item| {
                strip_visibility_fields(&mut item);
                normalize_default_template_item_icon(&mut item);
                item
            })
            .collect(),
    )
}

fn normalize_default_template_item_icon(item: &mut Value) {
    let Some(object) = item.as_object_mut() else {
        return;
    };
    let Some(icon) = object.get("icon").and_then(Value::as_str) else {
        return;
    };
    match managed_icons::normalize_icon_url(icon) {
        Some(normalized) => {
            object.insert("icon".to_string(), Value::String(normalized));
        }
        None => {
            object.insert("icon".to_string(), Value::String(String::new()));
        }
    }
}

fn default_template_widgets(value: Value) -> Value {
    let Value::Array(widgets) = value else {
        return json!([]);
    };
    Value::Array(
        widgets
            .into_iter()
            .map(|mut widget| {
                strip_visibility_fields(&mut widget);
                widget
            })
            .collect(),
    )
}

fn default_template_widget(template: &Value, id: &str) -> Option<Value> {
    template
        .get("widgets")
        .and_then(Value::as_array)
        .and_then(|widgets| {
            widgets
                .iter()
                .find(|widget| string_value(widget, "id").as_deref() == Some(id))
                .cloned()
        })
        .map(|mut widget| {
            strip_visibility_fields(&mut widget);
            widget
        })
}

fn strip_visibility_fields(value: &mut Value) {
    if let Some(object) = value.as_object_mut() {
        object.remove("isPublic");
        object.remove("is_public");
    }
}

fn nav_group_to_api_value(group: &NavGroup) -> Value {
    let mut out = object_from_value(unwrap_nested_object(&group.settings, "settings"));
    out.remove("items");
    out.remove("settings");
    out.remove("sort_order");
    out.remove("isPublic");
    out.remove("is_public");
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
    out.remove("isPublic");
    out.remove("is_public");
    out.remove("sort_order");
    out.insert("id".to_string(), json!(item.id));
    out.insert("title".to_string(), json!(item.title));
    out.insert("url".to_string(), json!(item.url));
    out.insert("icon".to_string(), json!(item.icon));
    Value::Object(out)
}

fn widget_to_api_value(widget: &WidgetRecord) -> Value {
    let mut out = widget_layout_to_api_object(&widget.layout);
    out.insert("id".to_string(), json!(widget.id));
    out.insert("type".to_string(), json!(widget.widget_type));
    out.insert("enable".to_string(), json!(widget.enabled));
    out.insert("data".to_string(), widget.data.clone());
    Value::Object(out)
}

async fn normalize_snapshot(
    state: &AppState,
    username: String,
    body: Value,
    icon_mode: managed_icons::IconNormalizationMode,
) -> Result<AppSnapshot, ApiError> {
    let existing = app_snapshot(&state.pool, &username).await?;
    let app_config = body
        .get("appConfig")
        .or_else(|| body.get("app_config"))
        .cloned()
        .unwrap_or(existing.user.app_config);
    let groups = if let Some(items) = body.get("groups").and_then(Value::as_array) {
        normalize_groups(state, &username, items, icon_mode).await?
    } else {
        normalize_existing_groups(state, &username, existing.groups, icon_mode).await?
    };
    let widgets = body
        .get("widgets")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .enumerate()
                .map(|(index, widget)| {
                    let widget = migrate_legacy_widget_value(widget.clone());
                    WidgetRecord {
                        id: string_value(&widget, "id")
                            .unwrap_or_else(|| Uuid::new_v4().to_string()),
                        widget_type: string_value(&widget, "type")
                            .unwrap_or_else(|| "custom".to_string()),
                        enabled: widget
                            .get("enable")
                            .or_else(|| widget.get("enabled"))
                            .and_then(Value::as_bool)
                            .unwrap_or(true),
                        is_public: false,
                        data: widget.get("data").cloned().unwrap_or_else(|| json!({})),
                        layout: normalize_widget_layout(&widget),
                        sort_order: index as i64,
                    }
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

async fn normalize_existing_snapshot(
    state: &AppState,
    mut snapshot: AppSnapshot,
    icon_mode: managed_icons::IconNormalizationMode,
) -> Result<AppSnapshot, ApiError> {
    snapshot.groups =
        normalize_existing_groups(state, &snapshot.username, snapshot.groups, icon_mode).await?;
    snapshot.version = Utc::now().timestamp_millis();
    Ok(snapshot)
}

async fn normalize_groups(
    state: &AppState,
    username: &str,
    groups: &[Value],
    icon_mode: managed_icons::IconNormalizationMode,
) -> Result<Vec<NavGroup>, ApiError> {
    let mut out = Vec::with_capacity(groups.len());
    for (index, group) in groups.iter().enumerate() {
        let mut items_out = Vec::new();
        if let Some(items) = group.get("items").and_then(Value::as_array) {
            for (item_index, item) in items.iter().enumerate() {
                let url = string_value(item, "url").unwrap_or_default();
                let fallback_url = if url.is_empty() {
                    string_value(item, "lanUrl")
                } else {
                    Some(url.clone())
                };
                let raw_icon = string_value(item, "icon").unwrap_or_default();
                let icon = normalize_nav_item_icon(
                    state,
                    username,
                    &raw_icon,
                    fallback_url.as_deref(),
                    icon_mode,
                )
                .await?;
                let mut metadata_source = item.clone();
                if let Some(object) = metadata_source.as_object_mut() {
                    object.insert("icon".to_string(), json!(icon.clone()));
                }
                items_out.push(NavItem {
                    id: string_value(item, "id").unwrap_or_else(|| Uuid::new_v4().to_string()),
                    title: string_value(item, "title").unwrap_or_default(),
                    url,
                    icon,
                    is_public: false,
                    sort_order: item_index as i64,
                    metadata: normalize_item_metadata(&metadata_source),
                });
            }
        }
        out.push(NavGroup {
            id: string_value(group, "id").unwrap_or_else(|| Uuid::new_v4().to_string()),
            title: string_value(group, "title").unwrap_or_default(),
            sort_order: index as i64,
            settings: normalize_group_settings(group),
            items: items_out,
        });
    }
    Ok(out)
}

async fn normalize_existing_groups(
    state: &AppState,
    username: &str,
    groups: Vec<NavGroup>,
    icon_mode: managed_icons::IconNormalizationMode,
) -> Result<Vec<NavGroup>, ApiError> {
    let mut values = Vec::with_capacity(groups.len());
    for group in groups {
        values.push(nav_group_to_api_value(&group));
    }
    normalize_groups(state, username, &values, icon_mode).await
}

async fn normalize_nav_item_icon(
    state: &AppState,
    username: &str,
    raw_icon: &str,
    fallback_url: Option<&str>,
    icon_mode: managed_icons::IconNormalizationMode,
) -> Result<String, ApiError> {
    if raw_icon.trim().is_empty()
        && matches!(
            icon_mode,
            managed_icons::IconNormalizationMode::FillMissingFromUrl
        )
        && let Some(site_url) = fallback_url
    {
        match managed_icons::meta_icon_id(site_url) {
            Ok(id) => {
                let icon = managed_icons::canonical_icon_url(&id);
                if let Err(error) = managed_icons::validate_meta_icon_ref(&icon).await {
                    if is_droppable_icon_resolution_error(error.status()) {
                        tracing::warn!(error = %error.message(), "dropping unresolved navigation meta icon");
                        return Ok(String::new());
                    }
                    return Err(error);
                }
                return Ok(icon);
            }
            Err(error) if is_droppable_icon_resolution_error(error.status()) => {
                tracing::warn!(error = %error.message(), "dropping unresolved navigation meta icon");
                return Ok(String::new());
            }
            Err(error) => return Err(error),
        }
    }
    if let Some(normalized) = managed_icons::normalize_icon_url(raw_icon) {
        if !normalized.is_empty() {
            if managed_icons::is_meta_icon_url(&normalized) {
                if let Err(error) = managed_icons::validate_meta_icon_ref(&normalized).await {
                    if is_droppable_icon_resolution_error(error.status()) {
                        tracing::warn!(error = %error.message(), "dropping invalid meta navigation icon");
                        return Ok(String::new());
                    }
                    return Err(error);
                }
            }
            return Ok(normalized);
        }
    }
    match managed_icons::materialize_icon_value(
        state,
        managed_icons::IconVisibility::Private(username),
        raw_icon,
        fallback_url,
        icon_mode,
        "snapshot",
    )
    .await
    {
        Ok(Some(icon)) => Ok(managed_icons::canonical_icon_url(&icon.asset.id)),
        Ok(None) => Ok(String::new()),
        Err(error) if is_droppable_icon_resolution_error(error.status()) => {
            tracing::warn!(error = %error.message(), "dropping unresolved navigation icon");
            Ok(String::new())
        }
        Err(error) => Err(error),
    }
}

fn is_droppable_icon_resolution_error(status: StatusCode) -> bool {
    matches!(
        status,
        StatusCode::BAD_REQUEST
            | StatusCode::NOT_FOUND
            | StatusCode::BAD_GATEWAY
            | StatusCode::FORBIDDEN
            | StatusCode::UNPROCESSABLE_ENTITY
            | StatusCode::UNSUPPORTED_MEDIA_TYPE
    )
}

async fn ignored_stale_save_version(
    pool: &SqlitePool,
    username: &str,
    body: &Value,
) -> Result<Option<i64>, ApiError> {
    let Some(client_version) = body.get("version").and_then(Value::as_i64) else {
        return Ok(None);
    };
    let server_version = app_snapshot(pool, username).await?.version;
    if client_version < server_version {
        return Ok(Some(server_version));
    }
    Ok(None)
}

async fn snapshot_to_template_value(
    state: &AppState,
    snapshot: AppSnapshot,
) -> Result<(Value, Vec<String>), ApiError> {
    let mut created_assets = Vec::new();
    let mut groups = Vec::with_capacity(snapshot.groups.len());
    for group in &snapshot.groups {
        let mut group_value = nav_group_to_api_value(group);
        if let Some(object) = group_value.as_object_mut() {
            let items = object.remove("items").unwrap_or_else(|| json!([]));
            let normalized_items =
                normalize_template_items(state, items, &mut created_assets).await?;
            object.insert("items".to_string(), normalized_items);
        }
        groups.push(group_value);
    }
    let template = json!({
        "appConfig": snapshot.user.app_config,
        "groups": groups,
        "widgets": snapshot.widgets.iter().map(widget_to_api_value).collect::<Vec<_>>(),
    });
    verify_template_icon_assets(state, &template).await?;
    Ok((template, created_assets))
}

async fn normalize_template_items(
    state: &AppState,
    value: Value,
    created_assets: &mut Vec<String>,
) -> Result<Value, ApiError> {
    let Value::Array(items) = value else {
        return Ok(json!([]));
    };
    let mut out = Vec::with_capacity(items.len());
    for mut item in items {
        let raw_icon = string_value(&item, "icon").unwrap_or_default();
        let normalized =
            normalize_template_icon_value(state, &raw_icon, created_assets, "template").await?;
        if let Some(object) = item.as_object_mut() {
            object.insert("icon".to_string(), json!(normalized));
        }
        out.push(item);
    }
    Ok(Value::Array(out))
}

async fn normalize_template_icon_value(
    state: &AppState,
    raw_icon: &str,
    created_assets: &mut Vec<String>,
    source_hint: &str,
) -> Result<String, ApiError> {
    if let Some(normalized) = managed_icons::normalize_icon_url(raw_icon) {
        if normalized.is_empty()
            || managed_icons::is_seed_icon_url(&normalized)
            || managed_icons::is_meta_icon_url(&normalized)
        {
            if managed_icons::is_meta_icon_url(&normalized) {
                if let Err(error) = managed_icons::validate_meta_icon_ref(&normalized).await {
                    if is_droppable_icon_resolution_error(error.status()) {
                        tracing::warn!(error = %error.message(), "dropping invalid default-template meta icon");
                        return Ok(String::new());
                    }
                    return Err(error);
                }
            }
            return Ok(normalized);
        }
    }
    match managed_icons::materialize_icon_value(
        state,
        managed_icons::IconVisibility::Template,
        raw_icon,
        None,
        managed_icons::IconNormalizationMode::PreserveEmpty,
        source_hint,
    )
    .await
    {
        Ok(Some(icon)) => {
            if !icon.reused {
                created_assets.push(icon.asset.id.clone());
            }
            Ok(managed_icons::canonical_icon_url(&icon.asset.id))
        }
        Ok(None) => Ok(String::new()),
        Err(error) if is_droppable_icon_resolution_error(error.status()) => {
            tracing::warn!(error = %error.message(), "dropping unresolved default-template icon");
            Ok(String::new())
        }
        Err(error) => Err(error),
    }
}

async fn verify_template_icon_assets(state: &AppState, template: &Value) -> Result<(), ApiError> {
    let Some(groups) = template.get("groups").and_then(Value::as_array) else {
        return Ok(());
    };
    for group in groups {
        let Some(items) = group.get("items").and_then(Value::as_array) else {
            continue;
        };
        for item in items {
            let Some(icon) = item.get("icon").and_then(Value::as_str) else {
                continue;
            };
            if icon.trim().is_empty() {
                continue;
            }
            if let Some(resource_path) = managed_icons::seed_icon_resource_path(icon) {
                let public_path = state.config.public_dir.join(&resource_path);
                let fallback_path = state
                    .config
                    .server_resource_dir
                    .join("public")
                    .join(resource_path);
                if public_path.is_file() || fallback_path.is_file() {
                    continue;
                }
                return Err(ApiError::internal("default_template_seed_icon_missing"));
            }
            if managed_icons::is_meta_icon_url(icon) {
                managed_icons::validate_meta_icon_ref(icon).await?;
                continue;
            }
            let Some(asset_id) = managed_icons::extract_asset_id(icon) else {
                return Err(ApiError::internal("default_template_noncanonical_icon"));
            };
            let row = sqlx::query(
                r#"SELECT b.storage_path
                   FROM managed_icon_assets a
                   JOIN managed_icon_blobs b ON b.id = a.blob_id
                   WHERE a.id = ? AND a.visibility = 'template' AND a.lifecycle = 'active'"#,
            )
            .bind(asset_id)
            .fetch_optional(&state.pool)
            .await?;
            let Some(row) = row else {
                return Err(ApiError::internal("default_template_icon_missing"));
            };
            let path = state
                .config
                .data_dir
                .join(row.get::<String, _>("storage_path"));
            if !path.is_file() {
                return Err(ApiError::internal("default_template_blob_missing"));
            }
        }
    }
    Ok(())
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
    out.remove("isPublic");
    out.remove("is_public");
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
    out.remove("isPublic");
    out.remove("is_public");
    out.remove("sort_order");
    for key in ["id", "title", "url", "icon"] {
        if let Some(value) = item.get(key) {
            out.insert(key.to_string(), value.clone());
        }
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

async fn read_default_template_file(config: &RuntimeConfig) -> Result<Value, ApiError> {
    let bytes = fs::read(&config.default_template_file)
        .await
        .map_err(|_| ApiError::not_found("default_template_not_found"))?;
    serde_json::from_slice(&bytes).map_err(ApiError::from)
}

async fn write_default_template_file(
    config: &RuntimeConfig,
    value: &Value,
) -> Result<(), ApiError> {
    let path = &config.default_template_file;
    let parent = path.parent().ok_or_else(|| {
        ApiError::internal("default_template_write_failed: missing parent directory")
    })?;
    fs::create_dir_all(parent)
        .await
        .map_err(default_template_write_error)?;

    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("default.json");
    let temp_path = parent.join(format!(".{file_name}.{}.tmp", Uuid::new_v4()));
    let bytes = serde_json::to_vec_pretty(value)?;
    let mut file = match fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temp_path)
        .await
    {
        Ok(file) => file,
        Err(err) => return Err(default_template_write_error(err)),
    };
    if let Err(err) = tokio::io::AsyncWriteExt::write_all(&mut file, &bytes).await {
        let _ = fs::remove_file(&temp_path).await;
        return Err(default_template_write_error(err));
    }
    if let Err(err) = file.sync_all().await {
        return Err(default_template_write_error(err));
    }
    drop(file);
    if let Err(err) = fs::rename(&temp_path, path).await {
        let _ = fs::remove_file(&temp_path).await;
        return Err(default_template_write_error(err));
    }
    Ok(())
}

fn default_template_write_error(err: std::io::Error) -> ApiError {
    ApiError::internal(format!("default_template_write_failed: {err}"))
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

fn optional_username_from_headers(
    headers: &HeaderMap,
    state: &AppState,
) -> Result<Option<String>, ApiError> {
    match session_cookie_auth(headers, state) {
        SessionCookieAuth::Missing => Ok(None),
        SessionCookieAuth::Valid(session) => Ok(Some(session.username)),
        SessionCookieAuth::Invalid => Err(ApiError::invalid_token_with_cookie(headers)),
    }
}

fn require_username(headers: &HeaderMap, state: &AppState) -> Result<String, ApiError> {
    match session_cookie_auth(headers, state) {
        SessionCookieAuth::Valid(session) => Ok(session.username),
        SessionCookieAuth::Missing => Err(ApiError::unauthorized("invalid_token")),
        SessionCookieAuth::Invalid => Err(ApiError::invalid_token_with_cookie(headers)),
    }
}

fn require_admin(headers: &HeaderMap, state: &AppState) -> Result<String, ApiError> {
    let username = require_username(headers, state)?;
    if username != "admin" {
        return Err(ApiError::forbidden("permission_denied"));
    }
    Ok(username)
}

fn session_cookie_auth(headers: &HeaderMap, state: &AppState) -> SessionCookieAuth {
    let Some(token) = session_cookie_value(headers) else {
        return SessionCookieAuth::Missing;
    };
    let validation = Validation::new(Algorithm::HS256);
    match decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_ref().as_slice()),
        &validation,
    ) {
        Ok(data)
            if !data.claims.username.trim().is_empty() && !data.claims.sid.trim().is_empty() =>
        {
            SessionCookieAuth::Valid(AuthSession {
                username: data.claims.username,
                sid: data.claims.sid,
            })
        }
        _ => SessionCookieAuth::Invalid,
    }
}

fn session_cookie_value(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .find_map(|part| {
            let (name, value) = part.trim().split_once('=')?;
            (name.trim() == SESSION_COOKIE_NAME)
                .then(|| value.trim())
                .filter(|value| !value.is_empty())
        })
}

fn should_mark_session_cookie_secure(headers: &HeaderMap) -> bool {
    headers
        .get("x-forwarded-proto")
        .and_then(|value| value.to_str().ok())
        .map(|value| {
            value
                .split(',')
                .any(|part| part.trim().eq_ignore_ascii_case("https"))
        })
        .unwrap_or(false)
        || headers
            .get("x-forwarded-ssl")
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.eq_ignore_ascii_case("on"))
        || headers
            .get("forwarded")
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.to_ascii_lowercase().contains("proto=https"))
}

fn session_cookie(token: &str, secure: bool) -> String {
    let mut cookie = format!(
        "{SESSION_COOKIE_NAME}={token}; Max-Age={SESSION_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax"
    );
    if secure {
        cookie.push_str("; Secure");
    }
    cookie
}

fn expired_session_cookie(secure: bool) -> String {
    let mut cookie = format!(
        "{SESSION_COOKIE_NAME}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Lax"
    );
    if secure {
        cookie.push_str("; Secure");
    }
    cookie
}

fn expired_session_cookie_for_domain(secure: bool, domain: &str) -> String {
    let mut cookie = expired_session_cookie(secure);
    cookie.push_str("; Domain=");
    cookie.push_str(domain);
    cookie
}

fn session_cookie_clear_domains(headers: &HeaderMap) -> Vec<String> {
    let Some(host) = headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.trim().trim_end_matches('.'))
        .filter(|value| !value.is_empty())
    else {
        return Vec::new();
    };
    if host.starts_with('[') {
        return Vec::new();
    }
    let host = host.split_once(':').map_or(host, |(host, _)| host);
    if host.eq_ignore_ascii_case("localhost") || host.parse::<std::net::IpAddr>().is_ok() {
        return Vec::new();
    }

    let mut domains = vec![host.to_ascii_lowercase()];
    let labels = host.split('.').collect::<Vec<_>>();
    if labels.len() > 2 {
        let parent = labels[labels.len() - 2..].join(".").to_ascii_lowercase();
        if !domains.iter().any(|domain| domain == &parent) {
            domains.push(parent);
        }
    }
    domains
}

fn insert_expired_session_cookies(
    response_headers: &mut HeaderMap,
    request_headers: &HeaderMap,
    secure: bool,
) {
    insert_set_cookie(response_headers, expired_session_cookie(secure));
    for domain in session_cookie_clear_domains(request_headers) {
        insert_set_cookie(
            response_headers,
            expired_session_cookie_for_domain(secure, &domain),
        );
    }
}

fn insert_no_store(headers: &mut HeaderMap) {
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
}

fn insert_set_cookie(headers: &mut HeaderMap, value: String) {
    if let Ok(value) = HeaderValue::from_str(&value) {
        headers.append(header::SET_COOKIE, value);
    }
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

pub(crate) fn parse_json(raw: String) -> Value {
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

fn normalize_icon_content_type(raw: &str) -> String {
    raw.split(';')
        .next()
        .unwrap_or("application/octet-stream")
        .trim()
        .to_ascii_lowercase()
}

fn icon_content_type_from_path(path: &str) -> Option<String> {
    mime_guess::from_path(path)
        .first()
        .map(|mime| mime.essence_str().to_string())
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

pub(crate) async fn validate_remote_url(raw: &str) -> Result<reqwest::Url, ApiError> {
    let parsed = reqwest::Url::parse(raw).map_err(|_| ApiError::bad_request("invalid_url"))?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err(ApiError::bad_request("unsupported_protocol"));
    }
    Ok(parsed)
}

async fn is_blocked_wallpaper_host(host: &str) -> Result<bool, ApiError> {
    Ok(is_blocked_host(host).await? && !is_allowed_wallpaper_host(host))
}

pub(crate) async fn is_blocked_host(host: &str) -> Result<bool, ApiError> {
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

pub(crate) fn is_blocked_ip(ip: IpAddr) -> bool {
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

pub(crate) fn copy_response_header(
    headers_in: &HeaderMap,
    headers_out: &mut HeaderMap,
    name: HeaderName,
) {
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
    clear_session_cookie: bool,
    secure_session_cookie: bool,
    session_cookie_clear_domains: Vec<String>,
    no_store: bool,
}

impl ApiError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
            clear_session_cookie: false,
            secure_session_cookie: false,
            session_cookie_clear_domains: Vec::new(),
            no_store: false,
        }
    }

    pub(crate) fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, message)
    }

    fn invalid_token_with_cookie(headers: &HeaderMap) -> Self {
        Self {
            clear_session_cookie: true,
            secure_session_cookie: should_mark_session_cookie_secure(headers),
            session_cookie_clear_domains: session_cookie_clear_domains(headers),
            ..Self::unauthorized("invalid_token")
        }
    }

    pub(crate) fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }

    pub(crate) fn bad_gateway(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_GATEWAY, message)
    }

    pub(crate) fn forbidden(message: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, message)
    }

    fn conflict(message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, message)
    }

    fn internal(message: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, message)
    }

    pub(crate) fn into_message(self) -> String {
        self.message
    }

    pub(crate) fn status(&self) -> StatusCode {
        self.status
    }

    pub(crate) fn message(&self) -> &str {
        &self.message
    }

    fn with_no_store(mut self) -> Self {
        self.no_store = true;
        self
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut response = (
            self.status,
            Json(json!({"success": false, "error": self.message})),
        )
            .into_response();
        if self.no_store {
            insert_no_store(response.headers_mut());
        }
        if self.clear_session_cookie {
            insert_set_cookie(
                response.headers_mut(),
                expired_session_cookie(self.secure_session_cookie),
            );
            for domain in self.session_cookie_clear_domains {
                insert_set_cookie(
                    response.headers_mut(),
                    expired_session_cookie_for_domain(self.secure_session_cookie, &domain),
                );
            }
        }
        response
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

#[cfg(test)]
mod tests {
    use super::*;

    fn tag(name: &str) -> DockerHubTag {
        DockerHubTag {
            name: Some(name.to_string()),
        }
    }

    #[test]
    fn app_version_helpers_select_highest_semver_tag() {
        let latest = select_latest_docker_hub_version(vec![
            tag("latest"),
            tag("1.2.9"),
            tag("v1.2.10"),
            tag("nightly"),
        ]);
        assert_eq!(latest.as_deref(), Some("v1.2.10"));
    }

    #[test]
    fn app_version_helpers_compare_prerelease_and_stable_versions() {
        assert!(is_remote_version_newer("1.2.3", "1.2.4"));
        assert!(!is_remote_version_newer("1.2.3", "1.2.3"));
        assert!(!is_remote_version_newer("1.2.3", "1.2.2"));
        assert!(!is_remote_version_newer("1.2.3", "1.2.3-rc.1"));
        assert!(is_remote_version_newer("1.2.3-rc.1", "1.2.3"));
    }
}
