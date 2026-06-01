use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use axum::routing::get;
use axum::{Json, Router};
use base64::Engine;
use flate2::Compression;
use flate2::write::GzEncoder;
use serde_json::{Value, json};
use startdeck_core::{RuntimeConfig, connect_sqlite, import_legacy_app_data};
use startdeck_server::{AppState, app};
use std::io::Write;
use std::sync::Mutex;
use tokio::net::TcpListener;
use tower::ServiceExt;

static ENV_LOCK: Mutex<()> = Mutex::new(());

struct TestContext {
    app: axum::Router,
    pool: sqlx::SqlitePool,
    config: RuntimeConfig,
}

async fn test_app() -> axum::Router {
    test_context_with_widget_cache(true).await.app
}

async fn test_app_with_widget_cache(include_poem_cache: bool) -> axum::Router {
    test_context_with_widget_cache(include_poem_cache).await.app
}

async fn test_context_with_meta_server_base(meta_server_base: String) -> TestContext {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.keep();
    let data_dir = base.join("Data/data");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::write(
        data_dir.join("system.json"),
        r#"{"authMode":"multi","enableDocker":false}"#,
    )
    .unwrap();
    std::fs::write(
        data_dir.join("data.json"),
        serde_json::to_vec(&json!({
            "username": "admin",
            "password": "secret",
            "appConfig": {"customTitle": "Demo"},
            "groups": [{"id": "g1", "title": "Main", "items": []}],
            "widgets": []
        }))
        .unwrap(),
    )
    .unwrap();
    let public_dir = base.join("Data/public");
    std::fs::create_dir_all(&public_dir).unwrap();
    std::fs::write(public_dir.join("index.html"), "<main>StartDeck</main>").unwrap();
    let config = RuntimeConfig::from_base_dir(base);
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_app_data(&pool, &config).await.unwrap();
    let app = {
        let _guard = ENV_LOCK.lock().unwrap();
        app(AppState::new_with_meta_server_base(
            config.clone(),
            pool.clone(),
            false,
            meta_server_base,
        ))
    };
    TestContext { app, pool, config }
}

async fn test_context_with_widget_cache(include_poem_cache: bool) -> TestContext {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.keep();
    let data_dir = base.join("Data/data");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::write(
        data_dir.join("system.json"),
        r#"{"authMode":"single","enableDocker":false}"#,
    )
    .unwrap();
    std::fs::write(
        data_dir.join("data.json"),
        serde_json::to_vec(&json!({
            "username": "admin",
            "password": "secret",
            "appConfig": {"customTitle": "Demo"},
            "groups": [{"id": "g1", "title": "Main", "items": []}],
            "widgets": [{"id": "memo", "type": "memo", "enable": true, "isPublic": true, "data": {"content": "hello"}}]
        }))
        .unwrap(),
    )
    .unwrap();
    std::fs::write(
        data_dir.join("default.json"),
        serde_json::to_vec(&json!({
            "version": 12345,
            "appConfig": {"customTitle": "Guest Default"},
            "groups": [{
                "id": "guest-group",
                "title": "Guest Group",
                "items": [
                    {"id": "public-link", "title": "Public Link", "url": "https://example.com/path?q=1", "icon": "/icon-cache/missing.svg", "isPublic": true},
                    {"id": "private-link", "title": "Private Link", "url": "https://secret.example.com", "icon": "", "isPublic": false}
                ]
            }],
            "widgets": [
                {"id": "memo", "type": "memo", "enable": true, "isPublic": true, "data": {"content": "guest memo"}},
                {"id": "private-widget", "type": "memo", "enable": true, "isPublic": false, "data": {"content": "private"}}
            ]
        }))
        .unwrap(),
    )
    .unwrap();
    if include_poem_cache {
        std::fs::write(
            data_dir.join("widget_cache.json"),
            serde_json::to_vec(&json!({
                "sd_poem": {
                    "default": {
                        "data": {"content": "cached poem"},
                        "sourceStatus": "fixture",
                        "updatedAt": 1779700000000_i64
                    }
                },
                "sd_bing_wallpaper": {
                    "timelessq:large:page:1:pageSize:24:v1": {
                        "data": {
                            "entries": [
                                {
                                    "id": "fixture-wallpaper",
                                    "title": "后端缓存壁纸",
                                    "location": "测试地点",
                                    "credit": "Bing",
                                    "thumbnailUrl": "https://www.bing.com/th?id=OHR.Test_ZH-CN_1920x1080.jpg&w=360&h=202",
                                    "downloadUrl": "https://www.bing.com/th?id=OHR.Test_ZH-CN_1920x1080.jpg"
                                }
                            ],
                            "updatedAt": "2026-05-26T00:00:00Z",
                            "count": 3,
                            "totalPages": 1,
                            "pageSize": 24,
                            "currentPage": 1
                        },
                        "sourceStatus": "fixture",
                        "updatedAt": 1779700000000_i64
                    },
                    "timelessq:large:page:2:pageSize:2:v1": {
                        "data": {
                            "entries": [
                                {
                                    "id": "fixture-wallpaper-page2",
                                    "title": "后端缓存壁纸第二页",
                                    "location": "测试地点二",
                                    "credit": "Bing",
                                    "thumbnailUrl": "https://www.bing.com/th?id=OHR.Test2_ZH-CN_1920x1080.jpg&w=360&h=202",
                                    "downloadUrl": "https://www.bing.com/th?id=OHR.Test2_ZH-CN_1920x1080.jpg"
                                }
                            ],
                            "updatedAt": "2026-05-26T00:00:00Z",
                            "count": 3,
                            "totalPages": 2,
                            "pageSize": 2,
                            "currentPage": 2
                        },
                        "sourceStatus": "fixture",
                        "updatedAt": 1779700000000_i64
                    }
                }
            }))
            .unwrap(),
        )
        .unwrap();
    }
    let public_dir = base.join("Data/public");
    std::fs::create_dir_all(&public_dir).unwrap();
    std::fs::write(public_dir.join("index.html"), "<main>StartDeck</main>").unwrap();
    std::fs::write(
        public_dir.join("intro.html"),
        "<main>StartDeck official site</main>",
    )
    .unwrap();
    std::fs::write(public_dir.join("favicon.ico"), b"ico-bytes").unwrap();
    std::fs::write(
        public_dir.join("favicon.svg"),
        r#"<svg xmlns="http://www.w3.org/2000/svg" id="startdeck"/>"#,
    )
    .unwrap();
    std::fs::write(
        public_dir.join("default-wallpaper.svg"),
        r#"<svg xmlns="http://www.w3.org/2000/svg" id="wallpaper"/>"#,
    )
    .unwrap();
    std::fs::write(public_dir.join("ICON.PNG"), b"png-bytes").unwrap();
    std::fs::create_dir_all(public_dir.join("assets/ai-usage/providers")).unwrap();
    std::fs::create_dir_all(public_dir.join("assets/seed-icons/nav")).unwrap();
    std::fs::create_dir_all(public_dir.join("sd-live-assets/anniversary")).unwrap();
    std::fs::create_dir_all(public_dir.join("sd/weather/icon")).unwrap();
    std::fs::write(
        public_dir.join("assets/index-current123.js"),
        b"console.log('current entry')",
    )
    .unwrap();
    std::fs::write(
        public_dir.join("assets/index-current123.css"),
        b".current-entry{}",
    )
    .unwrap();
    std::fs::write(
        public_dir.join("assets/ai-usage/providers/openai.svg"),
        r#"<svg id="openai"/>"#,
    )
    .unwrap();
    std::fs::write(
        public_dir.join("assets/seed-icons/nav/github.svg"),
        r#"<svg id="github"/>"#,
    )
    .unwrap();
    std::fs::write(
        public_dir.join("sd-live-assets/anniversary/yiyan-2.webp"),
        b"webp-bytes",
    )
    .unwrap();
    std::fs::write(
        public_dir.join("sd/weather/icon/104-fill.svg"),
        r#"<svg id="weather"/>"#,
    )
    .unwrap();
    let pc_dir = base.join("Data/PC");
    let mobile_dir = base.join("Data/APP");
    std::fs::create_dir_all(&pc_dir).unwrap();
    std::fs::create_dir_all(&mobile_dir).unwrap();
    std::fs::write(pc_dir.join("desk.jpg"), b"pc-background").unwrap();
    std::fs::write(mobile_dir.join("phone.jpg"), b"mobile-background").unwrap();
    let config = RuntimeConfig::from_base_dir(base);
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_app_data(&pool, &config).await.unwrap();
    let app = {
        let _guard = ENV_LOCK.lock().unwrap();
        app(AppState::new_with_remote_widget_fetch(
            config.clone(),
            pool.clone(),
            false,
        ))
    };
    TestContext { app, pool, config }
}

async fn test_app_with_seeded_weather_cache() -> axum::Router {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.keep();
    let data_dir = base.join("Data/data");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::write(
        data_dir.join("system.json"),
        r#"{"authMode":"single","enableDocker":false}"#,
    )
    .unwrap();
    std::fs::write(
        data_dir.join("data.json"),
        serde_json::to_vec(&json!({
            "username": "admin",
            "password": "secret",
            "appConfig": {"customTitle": "Demo"},
            "groups": [{"id": "g1", "title": "Main", "items": []}],
            "widgets": []
        }))
        .unwrap(),
    )
    .unwrap();
    std::fs::write(
        data_dir.join("default.json"),
        serde_json::to_vec(&json!({
            "appConfig": {"customTitle": "Default"},
            "groups": [{"id": "default-group", "title": "Default Group", "items": []}],
            "widgets": [{"id": "default-clock", "type": "sd-clock", "enable": true, "isPublic": true, "data": {}}]
        }))
        .unwrap(),
    )
    .unwrap();
    let public_dir = base.join("Data/public");
    std::fs::create_dir_all(&public_dir).unwrap();
    std::fs::write(public_dir.join("index.html"), "<main>StartDeck</main>").unwrap();
    let config = RuntimeConfig::from_base_dir(base);
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_app_data(&pool, &config).await.unwrap();
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query(
        r#"INSERT INTO runtime_cache(kind, cache_key, value_json, expires_at, source_status, updated_at)
           VALUES ('sd_weather', 'current:city:location:101280608', ?, ?, 'ok', ?)"#,
    )
    .bind(
        json!({
            "sourceStatus": "ok",
            "provider": "test-cache",
            "current": {
                "status": "ok",
                "now": {"tmp": "28", "cond_txt": "缓存晴", "cond_code": "100"},
                "daily_forecast": [{"date": "2026-05-27", "tmp_max": "32", "tmp_min": "25", "cond_txt_d": "缓存晴", "cond_code_d": "100", "wind_sc": "2"}]
            },
            "hourly": {
                "updateTime": "2026-05-27T02:00+08:00",
                "hourly": [{"fxTime": "2026-05-27T03:00+08:00", "temp": "28", "icon": "100"}]
            }
        })
        .to_string(),
    )
    .bind(now + 5 * 60 * 1000)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();
    {
        let _guard = ENV_LOCK.lock().unwrap();
        app(AppState::new_with_remote_widget_fetch(config, pool, true))
    }
}

async fn json_call(
    app: &axum::Router,
    method: &str,
    uri: &str,
    session_cookie: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(session_cookie) = session_cookie {
        builder = builder.header("cookie", session_cookie);
    }
    let request = if let Some(body) = body {
        builder
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&body).unwrap()))
            .unwrap()
    } else {
        builder.body(Body::empty()).unwrap()
    };
    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| json!({"raw": String::from_utf8_lossy(&bytes)}));
    (status, value)
}

async fn login_token(app: &axum::Router) -> String {
    login_token_for(app, "admin", "secret").await
}

async fn login_token_for(app: &axum::Router, username: &str, password: &str) -> String {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({"username": username, "password": password}))
                        .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let session_cookie = response
        .headers()
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .unwrap()
        .to_string();
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["success"], true);
    assert_eq!(body["username"], username);
    assert!(body.get("token").is_none());
    assert!(body["sessionGeneration"].as_str().unwrap().len() > 20);
    session_cookie
}

fn response_header(response: &axum::response::Response, name: &str) -> String {
    response
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string()
}

fn response_headers(response: &axum::response::Response, name: &str) -> Vec<String> {
    response
        .headers()
        .get_all(name)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .map(ToOwned::to_owned)
        .collect()
}

async fn seed_stale_default_runtime_cache(pool: &sqlx::SqlitePool, value: Value) {
    sqlx::query(
        r#"INSERT OR REPLACE INTO runtime_cache(kind, cache_key, value_json, expires_at, source_status, updated_at)
           VALUES ('default_template', 'global', ?, NULL, 'stale-fixture', ?)"#,
    )
    .bind(value.to_string())
    .bind(chrono::Utc::now().timestamp_millis())
    .execute(pool)
    .await
    .unwrap();
}

async fn default_runtime_cache_value(pool: &sqlx::SqlitePool) -> Option<String> {
    sqlx::query_scalar::<_, String>(
        "SELECT value_json FROM runtime_cache WHERE kind = 'default_template' AND cache_key = 'global'",
    )
    .fetch_optional(pool)
    .await
    .unwrap()
}

fn read_default_template_json(config: &RuntimeConfig) -> Value {
    serde_json::from_slice(&std::fs::read(&config.default_template_file).unwrap()).unwrap()
}

#[tokio::test]
async fn startup_icon_migration_drops_invalid_legacy_icon_refs() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.keep();
    let data_dir = base.join("Data/data");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::write(
        data_dir.join("system.json"),
        r#"{"authMode":"single","enableDocker":false}"#,
    )
    .unwrap();
    std::fs::write(
        data_dir.join("data.json"),
        serde_json::to_vec(&json!({
            "username": "admin",
            "password": "secret",
            "appConfig": {"customTitle": "Legacy Icons"},
            "groups": [{
                "id": "legacy-group",
                "title": "Legacy",
                "items": [{
                    "id": "bad-user-icon",
                    "title": "Bad User Icon",
                    "url": "https://example.com",
                    "icon": ""
                }]
            }],
            "widgets": []
        }))
        .unwrap(),
    )
    .unwrap();
    std::fs::write(
        data_dir.join("default.json"),
        serde_json::to_vec(&json!({
            "appConfig": {"customTitle": "Guest Legacy"},
            "groups": [{
                "id": "guest-legacy-group",
                "title": "Guest Legacy",
                "items": [{
                    "id": "bad-template-icon",
                    "title": "Bad Template Icon",
                    "url": "https://example.com",
                    "icon": "legacy://bad-template-icon"
                }]
            }],
            "widgets": []
        }))
        .unwrap(),
    )
    .unwrap();
    let public_dir = base.join("Data/public");
    std::fs::create_dir_all(&public_dir).unwrap();
    std::fs::write(public_dir.join("index.html"), "<main>StartDeck</main>").unwrap();

    let config = RuntimeConfig::from_base_dir(base);
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_app_data(&pool, &config).await.unwrap();
    sqlx::query("UPDATE nav_items SET icon = ? WHERE id = 'bad-user-icon'")
        .bind("legacy://bad-user-icon")
        .execute(&pool)
        .await
        .unwrap();

    let state = {
        let _guard = ENV_LOCK.lock().unwrap();
        AppState::try_new_with_meta_server_base(
            config.clone(),
            pool.clone(),
            false,
            "http://127.0.0.1:1",
        )
        .unwrap()
    };
    state.run_startup_icon_migration().await.unwrap();

    let user_icon: String =
        sqlx::query_scalar("SELECT icon FROM nav_items WHERE id = 'bad-user-icon'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(user_icon, "");
    let default_json = read_default_template_json(&config);
    assert_eq!(default_json["groups"][0]["items"][0]["icon"], "");
}

#[tokio::test]
async fn ai_usage_credentials_are_encrypted_scoped_and_never_echoed() {
    let app = test_app().await;
    let token = login_token(&app).await;

    let (status, _) = json_call(
        &app,
        "GET",
        "/api/ai-usage/credentials/ai-widget/openai",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, body) = json_call(
        &app,
        "PUT",
        "/api/ai-usage/credentials/ai-widget/openai",
        Some(&token),
        Some(json!({
            "credentialType": "session_cookie",
            "credential": "sk-live-secret-123456",
            "accountId": "acct-visible-1234",
            "serverStorageAcknowledged": true
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["hasServerCredential"], true);
    assert_eq!(body["credentialType"], "session_cookie");
    assert_eq!(body["accountIdHint"], "****1234");
    let body_text = body.to_string();
    assert!(!body_text.contains("sk-live-secret-123456"));
    assert!(!body_text.contains("acct-visible-1234"));

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/ai-usage/credentials/ai-widget/openai",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["hasServerCredential"], true);
    assert_eq!(body["accountIdHint"], "****1234");
    assert!(!body.to_string().contains("sk-live-secret-123456"));

    let (status, body) = json_call(&app, "GET", "/api/data", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    let body_text = body.to_string();
    assert!(!body_text.contains("sk-live-secret-123456"));
    assert!(!body_text.contains("acct-visible-1234"));

    let (status, _) = json_call(
        &app,
        "POST",
        "/api/admin/users",
        Some(&token),
        Some(json!({"username": "alice", "password": "secret"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let alice_token = login_token_for(&app, "alice", "secret").await;
    let (status, body) = json_call(
        &app,
        "GET",
        "/api/ai-usage/credentials/ai-widget/openai",
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["hasServerCredential"], false);

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/ai-usage/query",
        Some(&token),
        Some(json!({
            "widgetId": "ai-widget",
            "providerId": "claude",
            "credentialStorage": "once",
            "credentialType": "access_token",
            "credential": "planned-provider-secret"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "error");
    assert_eq!(body["errorCode"], "provider_query_planned");
    assert!(!body.to_string().contains("planned-provider-secret"));

    let (status, body) = json_call(
        &app,
        "DELETE",
        "/api/ai-usage/credentials/ai-widget/openai",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
    let (status, body) = json_call(
        &app,
        "GET",
        "/api/ai-usage/credentials/ai-widget/openai",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["hasServerCredential"], false);
}

#[tokio::test]
async fn tapd_credentials_are_encrypted_scoped_and_never_echoed() {
    let app = test_app().await;
    let token = login_token(&app).await;

    let (status, _) = json_call(
        &app,
        "GET",
        "/api/tapd-defects/credentials/tapd-widget",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, body) = json_call(
        &app,
        "PUT",
        "/api/tapd-defects/credentials/tapd-widget",
        Some(&token),
        Some(json!({
            "credentialType": "basic",
            "apiUser": "tapd_api_user",
            "apiPassword": "tapd-api-password-secret",
            "serverStorageAcknowledged": true
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["hasServerCredential"], true);
    assert_eq!(body["credentialType"], "basic");
    assert_eq!(body["accountHint"], "tapd_api_user");
    assert!(!body.to_string().contains("tapd-api-password-secret"));

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/tapd-defects/credentials/tapd-widget",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["hasServerCredential"], true);
    assert!(!body.to_string().contains("tapd-api-password-secret"));

    let (status, body) = json_call(&app, "GET", "/api/data", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(!body.to_string().contains("tapd-api-password-secret"));

    let (status, _) = json_call(
        &app,
        "POST",
        "/api/admin/users",
        Some(&token),
        Some(json!({"username": "tapd_alice", "password": "secret"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let alice_token = login_token_for(&app, "tapd_alice", "secret").await;
    let (status, body) = json_call(
        &app,
        "GET",
        "/api/tapd-defects/credentials/tapd-widget",
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["hasServerCredential"], false);

    let (status, body) = json_call(
        &app,
        "PUT",
        "/api/tapd-defects/credentials/tapd-widget",
        Some(&token),
        Some(json!({
            "credentialType": "bearer",
            "accessToken": "tapd-access-token-secret",
            "serverStorageAcknowledged": true
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["credentialType"], "bearer");
    assert_eq!(body["accountHint"], "****cret");
    assert!(!body.to_string().contains("tapd-access-token-secret"));

    let (status, body) = json_call(
        &app,
        "DELETE",
        "/api/tapd-defects/credentials/tapd-widget",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
    let (status, body) = json_call(
        &app,
        "GET",
        "/api/tapd-defects/credentials/tapd-widget",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["hasServerCredential"], false);
}

#[tokio::test]
async fn login_and_read_data_snapshot() {
    let app = test_app().await;
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/login")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"username":"admin","password":"secret"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let token = response
        .headers()
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .unwrap()
        .to_string();
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["success"], true);
    assert!(body.get("token").is_none());
    assert!(body["sessionGeneration"].as_str().unwrap().len() > 20);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/data")
                .header("cookie", &token)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["appConfig"]["customTitle"], "Demo");
    assert_eq!(body["groups"][0]["title"], "Main");
    assert!(body["groups"][0].get("settings").is_none());
    assert_eq!(body["widgets"][0]["type"], "memo");
    assert_eq!(body["widgets"][0]["enable"], true);
    assert!(body["widgets"][0].get("enabled").is_none());
    assert!(body["widgets"][0].get("isPublic").is_none());
    assert!(body["widgets"][0].get("is_public").is_none());
    assert!(body.get("authMode").is_none());
    assert!(body["systemConfig"].get("authMode").is_none());

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/data")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["isGuest"], true);
    assert_eq!(body["username"], "__guest__");
    assert_eq!(body["appConfig"]["customTitle"], "Guest Default");
    assert_eq!(body["groups"][0]["title"], "Guest Group");
    assert_eq!(body["groups"][0]["items"][0]["id"], "public-link");
    assert_eq!(body["groups"][0]["items"][0]["icon"], "");
    assert_eq!(body["groups"][0]["items"].as_array().unwrap().len(), 2);
    assert!(body["groups"][0]["items"][0].get("isPublic").is_none());
    assert!(body["groups"][0]["items"][1].get("isPublic").is_none());
    assert_eq!(body["widgets"][0]["id"], "memo");
    assert_eq!(body["widgets"].as_array().unwrap().len(), 2);
    assert!(body["widgets"][0].get("isPublic").is_none());
    assert!(body["widgets"][1].get("isPublic").is_none());
    assert!(body.get("authMode").is_none());
    assert!(body["systemConfig"].get("authMode").is_none());
    assert_eq!(body["enableDocker"], false);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/data")
                .header("cookie", "startdeck_session=invalid-token")
                .header("host", "start.put.run")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let set_cookies = response_headers(&response, "set-cookie");
    assert!(set_cookies.iter().any(|value| value.contains("Max-Age=0")));
    assert!(
        set_cookies
            .iter()
            .any(|value| value.contains("Domain=start.put.run"))
    );
    assert!(
        set_cookies
            .iter()
            .any(|value| value.contains("Domain=put.run"))
    );
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["isGuest"], true);
    assert_eq!(body["username"], "__guest__");
    assert_eq!(body["widgets"].as_array().unwrap().len(), 2);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/widgets/memo")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["id"], "memo");
    assert_eq!(body["type"], "memo");
    assert_eq!(body["data"]["content"], "guest memo");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/widgets/private-widget")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["id"], "private-widget");
    assert!(body.get("isPublic").is_none());
}

#[tokio::test]
async fn login_sets_http_only_cookie_without_token_and_no_store() {
    let app = test_app().await;
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/login")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"username":"admin","password":"secret"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response_header(&response, "cache-control"), "no-store");
    let set_cookie = response_header(&response, "set-cookie");
    assert!(set_cookie.starts_with("startdeck_session="));
    assert!(set_cookie.contains("HttpOnly"));
    assert!(set_cookie.contains("SameSite=Lax"));
    assert!(set_cookie.contains("Path=/"));
    assert!(set_cookie.contains("Max-Age=2592000"));
    assert!(!set_cookie.contains("Domain="));
    assert!(!set_cookie.contains("Secure"));
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["success"], true);
    assert!(body.get("token").is_none());
    assert_eq!(body["username"], "admin");
    assert!(body["sessionGeneration"].as_str().unwrap().len() > 20);
}

#[tokio::test]
async fn login_marks_cookie_secure_behind_https_proxy() {
    let app = test_app().await;
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/login")
                .header("x-forwarded-proto", "https")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"username":"admin","password":"secret"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert!(response_header(&response, "set-cookie").contains("Secure"));
}

#[tokio::test]
async fn session_and_logout_use_no_store_and_expire_invalid_cookie() {
    let app = test_app().await;
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/session")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response_header(&response, "cache-control"), "no-store");
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["authenticated"], false);
    assert!(body["username"].is_null());

    let cookie = login_token(&app).await;
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/session")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response_header(&response, "cache-control"), "no-store");
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["authenticated"], true);
    assert_eq!(body["username"], "admin");
    assert!(body["sessionGeneration"].as_str().unwrap().len() > 20);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/session")
                .header("cookie", "startdeck_session=invalid")
                .header("host", "start.put.run")
                .header("x-forwarded-proto", "https")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(response_header(&response, "cache-control"), "no-store");
    let expired = response_header(&response, "set-cookie");
    assert!(expired.contains("startdeck_session="));
    assert!(expired.contains("Max-Age=0"));
    assert!(expired.contains("Expires=Thu, 01 Jan 1970 00:00:00 GMT"));
    assert!(expired.contains("Secure"));
    let set_cookies = response_headers(&response, "set-cookie");
    assert!(
        set_cookies
            .iter()
            .any(|value| value.contains("Domain=start.put.run"))
    );
    assert!(
        set_cookies
            .iter()
            .any(|value| value.contains("Domain=put.run"))
    );

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/logout")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response_header(&response, "cache-control"), "no-store");
    assert!(response_header(&response, "set-cookie").contains("Max-Age=0"));
}

#[tokio::test]
async fn startdeck_authorization_bearer_no_longer_authenticates_sessions() {
    let app = test_app().await;
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/data")
                .header("authorization", "Bearer any-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["appConfig"]["customTitle"], "Guest Default");

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/data",
        Some("startdeck_session=invalid"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["isGuest"], true);
    assert_eq!(body["username"], "__guest__");
    assert_eq!(body["appConfig"]["customTitle"], "Guest Default");
}

#[tokio::test]
async fn session_signing_key_env_and_file_are_strict() {
    let _guard = ENV_LOCK.lock().unwrap();
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path().join("app");
    let config = RuntimeConfig::from_base_dir(base);
    std::fs::create_dir_all(&config.data_dir).unwrap();
    let pool = connect_sqlite(&config).await.unwrap();

    unsafe {
        std::env::set_var(
            "STARTDECK_SECRET",
            base64::engine::general_purpose::STANDARD.encode([7_u8; 32]),
        );
    }
    assert!(
        AppState::try_new_with_meta_server_base(
            config.clone(),
            pool.clone(),
            false,
            "http://127.0.0.1:1",
        )
        .is_ok()
    );

    unsafe {
        std::env::set_var(
            "STARTDECK_SECRET",
            base64::engine::general_purpose::STANDARD.encode([7_u8; 31]),
        );
    }
    assert!(
        AppState::try_new_with_meta_server_base(
            config.clone(),
            pool.clone(),
            false,
            "http://127.0.0.1:1",
        )
        .is_err()
    );

    unsafe {
        std::env::remove_var("STARTDECK_SECRET");
    }
    let state = AppState::try_new_with_meta_server_base(
        config.clone(),
        pool.clone(),
        false,
        "http://127.0.0.1:1",
    );
    assert!(state.is_ok());
    let key_path = config.data_dir.join("secrets/session-signing.key");
    let first_key = std::fs::read_to_string(&key_path).unwrap();
    assert_eq!(
        base64::engine::general_purpose::STANDARD
            .decode(first_key.trim())
            .unwrap()
            .len(),
        32
    );
    let second = AppState::try_new_with_meta_server_base(
        config.clone(),
        pool.clone(),
        false,
        "http://127.0.0.1:1",
    );
    assert!(second.is_ok());
    assert_eq!(std::fs::read_to_string(&key_path).unwrap(), first_key);

    std::fs::write(&key_path, "invalid").unwrap();
    assert!(
        AppState::try_new_with_meta_server_base(config, pool, false, "http://127.0.0.1:1").is_err()
    );
    unsafe {
        std::env::remove_var("STARTDECK_SECRET");
    }
}

#[tokio::test]
async fn stale_default_runtime_cache_does_not_affect_guest_reads_or_reset() {
    let context = test_context_with_widget_cache(true).await;
    seed_stale_default_runtime_cache(
        &context.pool,
        json!({
            "appConfig": {"customTitle": "Stale Runtime Cache"},
            "groups": [{
                "id": "stale-group",
                "title": "Stale Group",
                "items": [{"id": "stale-link", "title": "Stale Link", "url": "https://stale.example.com", "icon": "", "isPublic": true}]
            }],
            "widgets": [
                {"id": "memo", "type": "memo", "enable": true, "isPublic": true, "data": {"content": "stale memo"}},
                {"id": "runtime-cache-only", "type": "memo", "enable": true, "isPublic": true, "data": {"content": "cache only"}}
            ]
        }),
    )
    .await;

    let (status, body) = json_call(&context.app, "GET", "/api/data", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["isGuest"], true);
    assert_eq!(body["appConfig"]["customTitle"], "Guest Default");
    assert_eq!(body["groups"][0]["id"], "guest-group");
    assert_eq!(body["widgets"][0]["data"]["content"], "guest memo");
    assert!(!body.to_string().contains("Stale Runtime Cache"));

    let (status, body) = json_call(&context.app, "GET", "/api/widgets/memo", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["content"], "guest memo");

    let (status, body) = json_call(
        &context.app,
        "GET",
        "/api/widgets/runtime-cache-only",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "widget_not_found");

    let token = login_token(&context.app).await;
    let (status, body) = json_call(
        &context.app,
        "POST",
        "/api/save",
        Some(&token),
        Some(json!({
            "appConfig": {"customTitle": "Before Reset"},
            "groups": [],
            "widgets": []
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(&context.app, "POST", "/api/reset", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(&context.app, "GET", "/api/data", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["appConfig"]["customTitle"], "Guest Default");
    assert_eq!(body["groups"][0]["id"], "guest-group");
    assert_eq!(body["widgets"][0]["data"]["content"], "guest memo");
    assert!(!body.to_string().contains("Stale Runtime Cache"));
}

#[tokio::test]
async fn system_config_get_uses_public_default_without_auth_and_db_for_valid_token() {
    let context = test_context_with_widget_cache(true).await;
    let token = login_token(&context.app).await;
    sqlx::query(
        r#"INSERT INTO system_config(id, enable_docker, config_json, updated_at)
           VALUES (1, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             enable_docker=excluded.enable_docker,
             config_json=excluded.config_json,
             updated_at=excluded.updated_at"#,
    )
    .bind(json!({"enableDocker": true, "dbOnly": "visible-to-auth"}).to_string())
    .bind(chrono::Utc::now().timestamp_millis())
    .execute(&context.pool)
    .await
    .unwrap();

    let (status, body) = json_call(&context.app, "GET", "/api/system-config", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["enableDocker"], false);
    assert!(body.get("dbOnly").is_none());

    let (status, body) = json_call(
        &context.app,
        "GET",
        "/api/system-config",
        Some("startdeck_session=invalid-token"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "invalid_token");

    let (status, body) = json_call(
        &context.app,
        "GET",
        "/api/system-config",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["enableDocker"], true);
    assert_eq!(body["dbOnly"], "visible-to-auth");
}

#[tokio::test]
async fn default_save_requires_admin_and_non_admin_failures_leave_file_unchanged() {
    let context = test_context_with_widget_cache(true).await;
    let before = std::fs::read(&context.config.default_template_file).unwrap();

    let (status, body) = json_call(&context.app, "POST", "/api/default/save", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "invalid_token");
    assert_eq!(
        std::fs::read(&context.config.default_template_file).unwrap(),
        before
    );

    let admin_token = login_token(&context.app).await;
    let (status, body) = json_call(
        &context.app,
        "POST",
        "/api/admin/users",
        Some(&admin_token),
        Some(json!({"username": "editor", "password": "secret"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
    let user_token = login_token_for(&context.app, "editor", "secret").await;

    let (status, body) = json_call(
        &context.app,
        "POST",
        "/api/default/save",
        Some(&user_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "permission_denied");
    assert_eq!(
        std::fs::read(&context.config.default_template_file).unwrap(),
        before
    );
}

#[tokio::test]
async fn admin_default_save_writes_default_file_without_mutating_runtime_cache() {
    let context = test_context_with_widget_cache(true).await;
    seed_stale_default_runtime_cache(
        &context.pool,
        json!({
            "appConfig": {"customTitle": "Do Not Mutate Runtime Cache"},
            "groups": [],
            "widgets": []
        }),
    )
    .await;
    let stale_cache = default_runtime_cache_value(&context.pool).await;
    let token = login_token(&context.app).await;

    let (status, body) = json_call(
        &context.app,
        "POST",
        "/api/save",
        Some(&token),
        Some(json!({
            "appConfig": {"customTitle": "Saved Admin Default"},
            "groups": [{
                "id": "saved-group",
                "title": "Saved Group",
                "items": [{"id": "saved-link", "title": "Saved Link", "url": "https://saved.example.com", "icon": "", "isPublic": true}]
            }],
            "widgets": [{"id": "saved-widget", "type": "memo", "enable": true, "isPublic": true, "data": {"content": "saved widget"}}]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(
        &context.app,
        "POST",
        "/api/default/save",
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let default_json = read_default_template_json(&context.config);
    assert_eq!(
        default_json["appConfig"]["customTitle"],
        "Saved Admin Default"
    );
    assert_eq!(default_json["groups"][0]["id"], "saved-group");
    assert_eq!(default_json["groups"][0]["items"][0]["id"], "saved-link");
    assert_eq!(default_json["widgets"][0]["id"], "saved-widget");
    assert_eq!(
        default_json["widgets"][0]["data"]["content"],
        "saved widget"
    );
    assert!(default_json["appConfig"].is_object());
    assert!(default_json["groups"].is_array());
    assert!(default_json["widgets"].is_array());
    assert!(default_json.get("username").is_none());
    assert!(default_json.get("password").is_none());
    assert!(default_json.get("systemConfig").is_none());
    assert!(default_json.get("enableDocker").is_none());
    assert_eq!(
        default_runtime_cache_value(&context.pool).await,
        stale_cache
    );
}

#[cfg(unix)]
#[tokio::test]
async fn admin_default_save_write_failure_preserves_existing_default_file() {
    use std::os::unix::fs::PermissionsExt;

    let context = test_context_with_widget_cache(true).await;
    let token = login_token(&context.app).await;
    let before = std::fs::read(&context.config.default_template_file).unwrap();
    let parent = context.config.default_template_file.parent().unwrap();
    let original_permissions = std::fs::metadata(parent).unwrap().permissions();
    let mut read_only_permissions = original_permissions.clone();
    read_only_permissions.set_mode(0o555);
    std::fs::set_permissions(parent, read_only_permissions).unwrap();

    let (status, body) = json_call(
        &context.app,
        "POST",
        "/api/default/save",
        Some(&token),
        None,
    )
    .await;
    std::fs::set_permissions(parent, original_permissions).unwrap();

    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert!(
        body["error"]
            .as_str()
            .unwrap()
            .contains("default_template_write_failed")
    );
    assert_eq!(
        std::fs::read(&context.config.default_template_file).unwrap(),
        before
    );
}

#[tokio::test]
async fn blank_username_login_is_rejected() {
    let app = test_app().await;
    let (status, body) = json_call(
        &app,
        "POST",
        "/api/login",
        None,
        Some(json!({"username": "", "password": "secret"})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "username_required");
}

#[tokio::test]
async fn users_can_save_same_navigation_and_widget_ids_without_conflict() {
    let app = test_app().await;
    let admin_token = login_token(&app).await;
    let (status, _) = json_call(
        &app,
        "POST",
        "/api/admin/users",
        Some(&admin_token),
        Some(json!({"username": "sameid", "password": "secret"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let user_token = login_token_for(&app, "sameid", "secret").await;

    for (token, title, widget_content) in [
        (&admin_token, "Admin Shared", "admin widget"),
        (&user_token, "User Shared", "user widget"),
    ] {
        let (status, body) = json_call(
            &app,
            "POST",
            "/api/save",
            Some(token),
            Some(json!({
                "appConfig": {"customTitle": title},
                "groups": [{
                    "id": "shared-group",
                    "title": title,
                    "items": [{"id": "shared-item", "title": title, "url": "https://example.com", "icon": "", "isPublic": true}]
                }],
                "widgets": [{"id": "shared-widget", "type": "memo", "enable": true, "isPublic": true, "data": {"content": widget_content}}]
            })),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["success"], true);
    }

    let (status, body) = json_call(&app, "GET", "/api/data", Some(&admin_token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["groups"][0]["title"], "Admin Shared");
    assert_eq!(body["widgets"][0]["data"]["content"], "admin widget");

    let (status, body) = json_call(&app, "GET", "/api/data", Some(&user_token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["groups"][0]["title"], "User Shared");
    assert_eq!(body["widgets"][0]["data"]["content"], "user widget");

    let (status, _) = json_call(
        &app,
        "PUT",
        "/api/widgets/shared-widget",
        Some(&admin_token),
        Some(json!({"type": "memo", "enable": true, "isPublic": true, "data": {"content": "admin single"}})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = json_call(
        &app,
        "PUT",
        "/api/widgets/shared-widget",
        Some(&user_token),
        Some(json!({"type": "memo", "enable": true, "isPublic": true, "data": {"content": "user single"}})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/widgets/shared-widget",
        Some(&admin_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["content"], "admin single");
    let (status, body) = json_call(
        &app,
        "GET",
        "/api/widgets/shared-widget",
        Some(&user_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["content"], "user single");
}

#[tokio::test]
async fn stale_full_save_is_ignored_instead_of_overwriting_navigation() {
    let app = test_app().await;
    let token = login_token(&app).await;

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/save",
        Some(&token),
        Some(json!({
            "groups": [{
                "id": "bookmarks",
                "title": "Bookmarks",
                "items": [{
                    "id": "github",
                    "title": "GitHub",
                    "url": "https://github.com/",
                    "icon": "",
                    "isPublic": true
                }]
            }],
            "widgets": []
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/save",
        Some(&token),
        Some(json!({
            "version": 0,
            "groups": [{"id": "bookmarks", "title": "Bookmarks", "items": []}],
            "widgets": []
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
    assert_eq!(body["ignored"], true);

    let (status, body) = json_call(&app, "GET", "/api/data", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["groups"][0]["items"][0]["title"], "GitHub");
}

#[tokio::test]
async fn root_favicon_assets_are_served_as_static_files() {
    let app = test_app().await;

    for (uri, expected_body, expected_content_type) in [
        ("/favicon.ico", b"ico-bytes".as_slice(), "image/x-icon"),
        (
            "/favicon.svg",
            r#"<svg xmlns="http://www.w3.org/2000/svg" id="startdeck"/>"#.as_bytes(),
            "image/svg+xml",
        ),
        (
            "/default-wallpaper.svg",
            r#"<svg xmlns="http://www.w3.org/2000/svg" id="wallpaper"/>"#.as_bytes(),
            "image/svg+xml",
        ),
        ("/ICON.PNG", b"png-bytes".as_slice(), "image/png"),
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{uri}");
        assert_eq!(
            response
                .headers()
                .get("cache-control")
                .and_then(|value| value.to_str().ok()),
            Some("public, max-age=31536000, immutable"),
            "{uri}"
        );
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default();
        assert!(
            content_type.starts_with(expected_content_type),
            "{uri} content-type was {content_type:?}"
        );
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(body.as_ref(), expected_body, "{uri}");
    }
}

#[tokio::test]
async fn html_entry_points_are_no_cache() {
    let app = test_app().await;

    for uri in ["/", "/index.html", "/intro.html", "/dashboard"] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{uri}");
        assert_eq!(
            response
                .headers()
                .get("cache-control")
                .and_then(|value| value.to_str().ok()),
            Some("no-cache"),
            "{uri}"
        );
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default();
        assert!(
            content_type.starts_with("text/html"),
            "{uri} content-type was {content_type:?}"
        );
    }
}

#[tokio::test]
async fn intro_html_is_served_from_public_assets() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/intro.html")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    assert!(content_type.starts_with("text/html"));
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(body.as_ref(), b"<main>StartDeck official site</main>");
}

#[tokio::test]
async fn application_assets_are_served_from_assets_route() {
    let app = test_app().await;

    for uri in [
        "/assets/ai-usage/providers/openai.svg",
        "/assets/seed-icons/nav/github.svg",
        "/sd-live-assets/anniversary/yiyan-2.webp",
        "/sd/weather/icon/104-fill.svg",
        "/intro-assets/missing-but-route-checked-later.svg",
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        if uri.contains("missing-but-route") {
            assert_eq!(response.status(), StatusCode::NOT_FOUND, "{uri}");
            assert!(response.headers().get("cache-control").is_none(), "{uri}");
            continue;
        }
        assert_eq!(response.status(), StatusCode::OK, "{uri}");
        assert_eq!(
            response
                .headers()
                .get("cache-control")
                .and_then(|value| value.to_str().ok()),
            Some("public, max-age=31536000, immutable"),
            "{uri}"
        );
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert!(!body.is_empty(), "{uri}");
    }
}

#[tokio::test]
async fn stale_entry_assets_fall_back_to_current_entry_bundle() {
    let app = test_app().await;

    for (uri, expected_body, expected_content_type) in [
        (
            "/assets/index-stale456.js",
            b"console.log('current entry')".as_slice(),
            "text/javascript",
        ),
        (
            "/assets/index-stale456.css",
            b".current-entry{}".as_slice(),
            "text/css",
        ),
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{uri}");
        assert_eq!(
            response
                .headers()
                .get("cache-control")
                .and_then(|value| value.to_str().ok()),
            Some("no-cache"),
            "{uri}"
        );
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default();
        assert!(
            content_type.starts_with(expected_content_type),
            "{uri} content-type was {content_type:?}"
        );
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(body.as_ref(), expected_body, "{uri}");
    }
}

#[tokio::test]
async fn missing_non_entry_assets_still_return_404() {
    let app = test_app().await;

    for uri in [
        "/assets/chunk-stale456.js",
        "/assets/index-short.js",
        "/assets/index-stale456.map",
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{uri}");
        assert!(response.headers().get("cache-control").is_none(), "{uri}");
    }
}

#[tokio::test]
async fn mutable_background_assets_are_cacheable_but_not_immutable() {
    let app = test_app().await;

    for uri in ["/backgrounds/desk.jpg", "/mobile_backgrounds/phone.jpg"] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{uri}");
        assert_eq!(
            response
                .headers()
                .get("cache-control")
                .and_then(|value| value.to_str().ok()),
            Some("public, max-age=86400, stale-while-revalidate=604800"),
            "{uri}"
        );
    }
}

#[tokio::test]
async fn missing_file_like_paths_do_not_fall_back_to_spa_html() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/missing-image.svg")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn save_updates_relational_snapshot() {
    let app = test_app().await;
    let token = login_token(&app).await;
    let payload = serde_json::to_vec(&json!({
        "appConfig": {"customTitle": "Updated"},
        "groups": [{"id": "g2", "title": "Updated Group", "gridGap": 12, "items": [{"id": "i2", "title": "Docs", "url": "https://docs.rs", "icon": "", "isPublic": false, "titleColor": "#fff"}]}],
        "widgets": [{"id": "w2", "type": "todo", "enable": true, "isPublic": true, "x": 2, "y": 3, "w": 2, "h": 1, "colSpan": 2, "rowSpan": 1, "hideOnMobile": true, "data": {}}]
    }))
    .unwrap();
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&payload).unwrap();
    let compressed = encoder.finish().unwrap();
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/save")
                .header("content-type", "application/json")
                .header("content-encoding", "gzip")
                .header("cookie", &token)
                .body(Body::from(compressed))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/data")
                .header("cookie", &token)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["appConfig"]["customTitle"], "Updated");
    assert_eq!(body["groups"][0]["gridGap"], 12);
    assert_eq!(body["groups"][0]["items"][0]["title"], "Docs");
    assert!(body["groups"][0]["items"][0].get("isPublic").is_none());
    assert_eq!(body["groups"][0]["items"][0]["titleColor"], "#fff");
    assert!(body["groups"][0]["items"][0].get("is_public").is_none());
    assert_eq!(body["widgets"][0]["type"], "todo");
    assert_eq!(body["widgets"][0]["enable"], true);
    assert!(body["widgets"][0].get("enabled").is_none());
    assert!(body["widgets"][0].get("isPublic").is_none());
    assert!(body["widgets"][0].get("is_public").is_none());
    assert_eq!(body["widgets"][0]["x"], 2);
    assert_eq!(body["widgets"][0]["y"], 3);
    assert_eq!(body["widgets"][0]["w"], 2);
    assert_eq!(body["widgets"][0]["h"], 1);
    assert_eq!(body["widgets"][0]["hideOnMobile"], true);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/data")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["isGuest"], true);
    assert_eq!(body["appConfig"]["customTitle"], "Guest Default");
    assert_eq!(body["widgets"][0]["id"], "memo");
}

#[tokio::test]
async fn route_surface_smoke_covers_auth_and_runtime_semantics() {
    let app = test_app().await;
    let token = login_token(&app).await;

    let response = app
        .clone()
        .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let (status, body) = json_call(&app, "GET", "/healthz", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["service"], "startdeck-server");

    let (status, body) = json_call(&app, "GET", "/api/version", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["version"].as_i64().is_some());

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/version")
                .header("cookie", "startdeck_session=invalid-token")
                .header("host", "start.put.run")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert!(
        response_headers(&response, "set-cookie")
            .iter()
            .any(|value| value.contains("Max-Age=0"))
    );
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["version"], 0);
    assert_eq!(body["isGuest"], true);

    let (status, body) = json_call(&app, "GET", "/api/system-config", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.get("authMode").is_none());
    assert_eq!(body["enableDocker"], false);

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/system-config",
        Some(&token),
        Some(json!({"authMode": "single"})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "auth_mode_removed");

    let (status, _) = json_call(
        &app,
        "POST",
        "/api/register",
        None,
        Some(json!({"username": "public-user", "password": "secret"})),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (status, body) = json_call(&app, "GET", "/api/admin/users", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["users"], json!([]));

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/admin/users",
        Some(&token),
        Some(json!({"username": "alice", "password": "secret"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(&app, "GET", "/api/admin/users", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["users"], json!(["alice"]));
    let alice_token = login_token_for(&app, "alice", "secret").await;
    let (status, body) = json_call(&app, "GET", "/api/admin/users", Some(&alice_token), None).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "permission_denied");

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/admin/license",
        Some(&token),
        Some(json!({"key": "test-license"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(&app, "GET", "/api/widgets/memo", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["type"], "memo");

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/data/import",
        Some(&token),
        Some(json!({
            "appConfig": {"customTitle": "Imported"},
            "groups": [{"id": "imported", "title": "Imported Group", "items": []}],
            "widgets": []
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(&app, "GET", "/api/data", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["appConfig"]["customTitle"], "Imported");

    let (status, body) = json_call(&app, "POST", "/api/default/save", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/save",
        Some(&token),
        Some(json!({
            "appConfig": {"customTitle": "Before Reset"},
            "groups": [],
            "widgets": []
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(&app, "POST", "/api/reset", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(&app, "GET", "/api/data", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["appConfig"]["customTitle"], "Imported");

    let (status, body) = json_call(
        &app,
        "PUT",
        "/api/widgets/runtime",
        Some(&token),
        Some(json!({"type": "clock", "enable": true, "data": {"theme": "dark"}})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["id"], "runtime");

    let (status, _) = json_call(
        &app,
        "POST",
        "/api/save",
        None,
        Some(json!({"appConfig": {}, "groups": [], "widgets": []})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, body) = json_call(&app, "GET", "/api/custom-scripts", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({}));

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/custom-scripts",
        Some(&token),
        Some(json!({"head": "console.log(1)"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/icons",
        None,
        Some(json!({"source": {"type": "dataUrl", "value": "data:image/svg+xml;base64,PHN2Zy8+"}})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "invalid_token");

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/icons",
        Some(&token),
        Some(json!({"source": {"type": "dataUrl", "value": "data:image/svg+xml;base64,PHN2Zy8+"}})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(
        body["data"]["url"]
            .as_str()
            .unwrap()
            .starts_with("/api/icons/icn_")
    );
    assert_eq!(body["data"]["assetId"], body["data"]["id"]);

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/icons",
        Some(&token),
        Some(json!({"source": {"type": "remoteUrl", "value": "http://127.0.0.1:9/icon.svg"}})),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "blocked_host");

    let (status, _) = json_call(
        &app,
        "POST",
        "/api/icon-cache",
        None,
        Some(json!({"dataUrl": "data:image/svg+xml;base64,PHN2Zy8+"})),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    for uri in [
        "/api/ip",
        "/api/ping?url=https://example.com",
        "/api/rtt?ts=1",
    ] {
        let (status, body) = json_call(&app, "GET", uri, None, None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["success"], true);
    }
    let (status, body) = json_call(&app, "GET", "/api/ip", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["queryIp"], "127.0.0.1");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/ip")
                .header("cookie", &token)
                .header("x-forwarded-for", "8.8.8.8")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["queryIp"], "8.8.8.8");

    let (status, body) = json_call(&app, "GET", "/api/ip/history", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["username"], "admin");
    assert_eq!(body["data"].as_array().unwrap().len(), 1);
    assert_eq!(body["data"][0]["ip"], "8.8.8.8");
    assert_eq!(body["data"][0]["seenCount"], 1);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/ip")
                .header("cookie", "startdeck_session=invalid-token")
                .header("x-forwarded-for", "8.8.8.8")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["error"], "invalid_token");
    let (status, body) = json_call(&app, "GET", "/api/ip/history", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"][0]["seenCount"], 1);

    let (status, body) = json_call(&app, "GET", "/api/ip?ip=1.1.1.1", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["queryIp"], "1.1.1.1");
    let (status, body) = json_call(&app, "GET", "/api/ip/history", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"].as_array().unwrap().len(), 1);
    assert_eq!(body["data"][0]["ip"], "8.8.8.8");

    let (status, _) = json_call(&app, "GET", "/api/ip/history", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, body) = json_call(&app, "GET", "/api/ip?ip=not-ip", None, None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "invalid_ipv4");

    let (status, body) = json_call(&app, "POST", "/api/visitor/track", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, _) = json_call(&app, "GET", "/api/system/stats", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let (status, body) = json_call(&app, "GET", "/api/system/stats", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["runtime"], "rust");

    let (status, body) = json_call(&app, "GET", "/api/docker-status", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["enabled"], false);
    let (status, body) = json_call(&app, "GET", "/api/docker/containers", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["containers"], json!([]));

    for uri in ["/api/backgrounds", "/api/mobile_backgrounds"] {
        let (status, body) = json_call(&app, "GET", uri, None, None).await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.as_array().is_some());
    }

    let (status, body) = json_call(&app, "GET", "/api/config-versions", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/config-versions",
        Some(&token),
        Some(json!({"label": "smoke"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let version_id = body["id"].as_str().unwrap().to_string();

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/config-versions",
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["versions"], json!([]));

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/config-versions",
        Some(&alice_token),
        Some(json!({"label": "alice"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let alice_version_id = body["id"].as_str().unwrap().to_string();

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/config-versions/restore",
        Some(&alice_token),
        Some(json!({"id": version_id})),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "version_not_found");

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/config-versions/restore",
        Some(&token),
        Some(json!({"id": version_id})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(
        &app,
        "DELETE",
        &format!("/api/config-versions/{version_id}"),
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
    let (status, body) = json_call(&app, "GET", "/api/config-versions", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["versions"].as_array().unwrap().len(), 1);

    let (status, body) = json_call(
        &app,
        "DELETE",
        &format!("/api/config-versions/{version_id}"),
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(
        &app,
        "DELETE",
        &format!("/api/config-versions/{alice_version_id}"),
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(&app, "GET", "/api/poem", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["sourceStatus"], "fixture");
    assert_eq!(body["data"]["content"], "cached poem");

    let (status, body) = json_call(&app, "GET", "/api/today-english", None, None).await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(body["success"], false);
    assert_eq!(body["error"], "cache_miss");

    let (status, body) = json_call(&app, "GET", "/api/movie-calendar", None, None).await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(body["success"], false);
    assert_eq!(body["error"], "cache_miss");

    let (status, body) = json_call(&app, "GET", "/api/weather/location", None, None).await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(body["success"], false);
    assert_eq!(body["error"], "weather_source_unavailable");

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/weather/current?location=101280608&type=city&refresh=false",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(body["success"], false);
    assert_eq!(body["error"], "weather_source_unavailable");

    let (status, body) =
        json_call(&app, "GET", "/api/weather/search?keyword=深圳", None, None).await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(body["success"], false);
    assert_eq!(body["error"], "weather_source_unavailable");

    let (status, body) = json_call(&app, "GET", "/api/bing-wallpapers", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["sourceStatus"], "fixture");
    assert_eq!(body["data"]["entries"][0]["id"], "fixture-wallpaper");

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/bing-wallpapers?page=2&pageSize=2",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["sourceStatus"], "fixture");
    assert_eq!(body["data"]["currentPage"], 2);
    assert_eq!(body["data"]["totalPages"], 2);
    assert_eq!(body["data"]["entries"][0]["id"], "fixture-wallpaper-page2");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/backgrounds/upload")
                .header("cookie", &token)
                .header("content-type", "multipart/form-data; boundary=x-test")
                .body(Body::from(
                    "--x-test\r\nContent-Disposition: form-data; name=\"files\"; filename=\"wall.png\"\r\nContent-Type: image/png\r\n\r\nabc\r\n--x-test--\r\n",
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["success"], true);
    assert_eq!(body["files"][0]["path"], "/backgrounds/wall.png");

    for (method, uri, body) in [
        ("GET", "/api/memo/memo", None),
        ("PUT", "/api/memo/memo", Some(json!({"content": "removed"}))),
        ("GET", "/api/config/proxy-status", None),
        ("GET", "/api/music-list", None),
        ("POST", "/api/music/upload", None),
        (
            "POST",
            "/api/wallpaper/resolve",
            Some(json!({"url": "https://example.com/wall.jpg"})),
        ),
        (
            "POST",
            "/api/wallpaper/fetch",
            Some(json!({"url": "https://example.com/wall.jpg"})),
        ),
        ("GET", concat!("/api/", "sd/poem"), None),
        ("GET", "/api/sd-resources/legacy-resource", None),
    ] {
        let (status, _) = json_call(&app, method, uri, Some(&token), body).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method} {uri}");
    }

    let (status, body) =
        json_call(&app, "DELETE", "/api/admin/users/alice", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
}

#[tokio::test]
async fn dynamic_widgets_without_cache_return_empty_error() {
    let app = test_app_with_widget_cache(false).await;

    for uri in ["/api/poem", "/api/today-english", "/api/movie-calendar"] {
        let (status, body) = json_call(&app, "GET", uri, None, None).await;
        assert_eq!(status, StatusCode::BAD_GATEWAY, "{uri}");
        assert_eq!(body["success"], false, "{uri}");
        assert_eq!(body["error"], "cache_miss", "{uri}");
    }
}

async fn spawn_mock_meta_server() -> (String, tokio::task::JoinHandle<()>) {
    async fn metadata() -> Json<Value> {
        Json(json!({
            "code": 200,
            "msg": "ok",
            "data": {
                "url": "https://example.com/",
                "title": "Example Metadata",
                "description": "Resolved from mock MetaServer",
                "icon": "/cache/example.svg",
                "backgroundColor": "#123456",
                "fetchStatus": "blocked",
                "failureKind": "remote_icon_blocked",
                "retryAfter": "2026-06-01T10:00:00Z"
            }
        }))
    }

    async fn icon() -> impl axum::response::IntoResponse {
        (
            [("content-type", "image/svg+xml")],
            r#"<svg xmlns="http://www.w3.org/2000/svg" id="example"/>"#,
        )
    }

    let router = Router::new()
        .route("/api/site/metadata", get(metadata))
        .route("/api/site/icon", get(icon))
        .route("/cache/example.svg", get(icon));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (format!("http://{addr}"), handle)
}

#[tokio::test]
async fn site_resolve_returns_public_meta_icon_proxy_without_managed_asset() {
    let (meta_server_base, meta_server) = spawn_mock_meta_server().await;
    let ctx = test_context_with_meta_server_base(meta_server_base).await;
    let TestContext { app, pool, .. } = ctx;
    let admin_token = login_token(&app).await;
    let asset_count_before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM managed_icon_assets")
        .fetch_one(&pool)
        .await
        .unwrap();

    let (status, body) =
        json_call(&app, "GET", "/api/site/resolve?url=example.com", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "invalid_token");

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/site/resolve?url=example.com",
        Some(&admin_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
    assert_eq!(body["data"]["title"], "Example Metadata");
    assert_eq!(body["data"]["description"], "Resolved from mock MetaServer");
    assert_eq!(body["data"]["fetchStatus"], "blocked");
    assert_eq!(body["data"]["failureKind"], "remote_icon_blocked");
    assert_eq!(body["data"]["retryAfter"], "2026-06-01T10:00:00Z");
    let icon_url = body["data"]["selectedIcon"]["url"].as_str().unwrap();
    assert!(icon_url.starts_with("/api/icons/mta_"));
    assert_eq!(body["data"]["iconCandidates"].as_array().unwrap().len(), 1);
    let asset_count_after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM managed_icon_assets")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(asset_count_after, asset_count_before);

    let (status, _) = json_call(
        &app,
        "POST",
        "/api/admin/users",
        Some(&admin_token),
        Some(json!({"username": "alice", "password": "secret"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(icon_url)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(icon_url)
                .header("host", "startdeck.local")
                .header("origin", "https://evil.example")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("HEAD")
                .uri(icon_url)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok()),
        Some("image/svg+xml")
    );

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(icon_url)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(
        body.as_ref(),
        br#"<svg xmlns="http://www.w3.org/2000/svg" id="example"/>"#
    );

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/data/import",
        Some(&admin_token),
        Some(json!({
            "groups": [{
                "id": "imported",
                "title": "Imported",
                "items": [{
                    "id": "example-import",
                    "title": "Example",
                    "url": "https://example.com/",
                    "lanUrl": "http://192.168.1.10/",
                    "icon": ""
                }]
            }],
            "widgets": []
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let imported_icon = body["data"]["groups"][0]["items"][0]["icon"]
        .as_str()
        .unwrap();
    assert!(imported_icon.starts_with("/api/icons/mta_"));
    let stored_icon: String =
        sqlx::query_scalar("SELECT icon FROM nav_items WHERE id = 'example-import'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stored_icon, imported_icon);

    meta_server.abort();
}

#[tokio::test]
async fn weather_current_uses_five_minute_cache_even_when_refresh_requested() {
    let app = test_app_with_seeded_weather_cache().await;

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/weather/current?location=101280608&type=city&refresh=true",
        None,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["sourceStatus"], "ok");
    assert_eq!(body["data"]["provider"], "test-cache");
    assert_eq!(body["data"]["current"]["now"]["cond_txt"], "缓存晴");
}
