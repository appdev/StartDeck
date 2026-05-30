use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use flate2::Compression;
use flate2::write::GzEncoder;
use serde_json::{Value, json};
use startdeck_core::{RuntimeConfig, connect_sqlite, import_legacy_app_data};
use startdeck_server::{AppState, app};
use std::io::Write;
use tower::ServiceExt;

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
                "itab_poem": {
                    "default": {
                        "data": {"content": "cached poem"},
                        "sourceStatus": "fixture",
                        "updatedAt": 1779700000000_i64
                    }
                },
                "itab_bing_wallpaper": {
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
    let config = RuntimeConfig::from_base_dir(base);
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_app_data(&pool, &config).await.unwrap();
    let app = app(AppState::new_with_remote_itab_fetch(
        config.clone(),
        pool.clone(),
        false,
    ));
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
            "widgets": [{"id": "default-clock", "type": "itab-clock", "enable": true, "isPublic": true, "data": {}}]
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
           VALUES ('itab_weather', 'current:city:location:101280608', ?, ?, 'ok', ?)"#,
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
    app(AppState::new_with_remote_itab_fetch(config, pool, true))
}

async fn json_call(
    app: &axum::Router,
    method: &str,
    uri: &str,
    token: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(token) = token {
        builder = builder.header("authorization", format!("Bearer {token}"));
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
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    body["token"].as_str().unwrap().to_string()
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
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["success"], true);
    assert!(body["token"].as_str().unwrap().len() > 20);

    let token = body["token"].as_str().unwrap().to_string();
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/data")
                .header("authorization", format!("Bearer {token}"))
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
    assert_eq!(body["widgets"][0]["isPublic"], true);
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
    assert_eq!(
        body["groups"][0]["items"][0]["icon"],
        "/api/site/icon?url=https%3A%2F%2Fexample.com%2Fpath%3Fq%3D1"
    );
    assert_eq!(body["groups"][0]["items"].as_array().unwrap().len(), 1);
    assert_eq!(body["widgets"][0]["id"], "memo");
    assert_eq!(body["widgets"].as_array().unwrap().len(), 1);
    assert!(body.get("authMode").is_none());
    assert!(body["systemConfig"].get("authMode").is_none());
    assert_eq!(body["enableDocker"], false);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/data")
                .header("authorization", "Bearer invalid-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

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
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
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
        Some("invalid-token"),
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
                    "icon": "/icon-cache/github.svg",
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
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{uri}");
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
                .header("authorization", format!("Bearer {token}"))
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
                .header("authorization", format!("Bearer {token}"))
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
    assert_eq!(body["groups"][0]["items"][0]["isPublic"], false);
    assert_eq!(body["groups"][0]["items"][0]["titleColor"], "#fff");
    assert!(body["groups"][0]["items"][0].get("is_public").is_none());
    assert_eq!(body["widgets"][0]["type"], "todo");
    assert_eq!(body["widgets"][0]["enable"], true);
    assert!(body["widgets"][0].get("enabled").is_none());
    assert_eq!(body["widgets"][0]["isPublic"], true);
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
        "/api/icon-cache",
        None,
        Some(json!({"dataUrl": "data:image/svg+xml;base64,PHN2Zy8+"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["url"].as_str().unwrap().starts_with("/icon-cache/"));
    assert_eq!(body["path"], body["url"]);

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/icon-cache",
        None,
        Some(json!({"url": "http://127.0.0.1:9/icon.svg"})),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "blocked_host");

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
                .header("authorization", format!("Bearer {token}"))
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
                .header("authorization", "Bearer invalid-token")
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
                .header("authorization", format!("Bearer {token}"))
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
        ("GET", concat!("/api/", "itab/poem"), None),
        ("GET", "/api/itab-resources/legacy-resource", None),
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
