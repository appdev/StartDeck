use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use flate2::Compression;
use flate2::write::GzEncoder;
use serde_json::{Value, json};
use startdeck_core::{RuntimeConfig, connect_sqlite, import_legacy_app_data};
use startdeck_server::{AppState, app};
use std::io::Write;
use tower::ServiceExt;

async fn test_app() -> axum::Router {
    test_app_with_widget_cache(true).await
}

async fn test_app_with_widget_cache(include_poem_cache: bool) -> axum::Router {
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
    let config = RuntimeConfig::from_base_dir(base);
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_app_data(&pool, &config).await.unwrap();
    app(AppState::new_with_remote_itab_fetch(config, pool, false))
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
    body["token"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn login_and_read_data_snapshot() {
    let app = test_app().await;
    let response = app
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

    let app = test_app().await;
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
    assert_eq!(body["appConfig"]["customTitle"], "Demo");
    assert_eq!(body["groups"][0]["title"], "Main");
    assert!(body["groups"][0].get("settings").is_none());
    assert_eq!(body["widgets"][0]["type"], "memo");
    assert_eq!(body["widgets"][0]["enable"], true);
    assert!(body["widgets"][0].get("enabled").is_none());
    assert_eq!(body["widgets"][0]["isPublic"], true);
    assert!(body["widgets"][0].get("is_public").is_none());
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
        .oneshot(
            Request::builder()
                .uri("/api/data")
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
    assert_eq!(body["authMode"], "single");

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

    let (status, body) = json_call(&app, "GET", "/api/memo/memo", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["content"], "");

    let (status, body) = json_call(
        &app,
        "PUT",
        "/api/memo/memo",
        Some(&token),
        Some(json!({"content": "updated memo", "mode": "plain"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

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
    let (status, body) = json_call(&app, "GET", "/api/memo/memo", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["content"], "updated memo");

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
    let (status, body) = json_call(&app, "GET", "/api/config/proxy-status", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["available"].as_bool().is_some());
    let (status, body) = json_call(&app, "GET", "/api/docker/containers", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["containers"], json!([]));

    for uri in [
        "/api/music-list",
        "/api/backgrounds",
        "/api/mobile_backgrounds",
    ] {
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
        Some(&token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);

    let (status, body) = json_call(&app, "GET", "/api/itab/poem", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["sourceStatus"], "fixture");
    assert_eq!(body["data"]["content"], "cached poem");

    let (status, body) = json_call(&app, "GET", "/api/itab/today-english", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["sourceStatus"], "fallback");
    assert!(body["data"]["sentence"].as_str().unwrap().len() > 10);

    let (status, body) = json_call(&app, "GET", "/api/itab/movie-calendar", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["sourceStatus"], "fallback");
    assert_eq!(body["data"]["movieTitle"], "雌雄莫辨");

    let (status, body) = json_call(&app, "GET", "/api/itab/weather/location", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["id"], "101280608");
    assert_eq!(body["data"]["name"], "龙华");

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/itab/weather/current?location=101280608&type=city&refresh=false",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["sourceStatus"], "fallback");
    assert_eq!(body["data"]["current"]["now"]["cond_txt"], "阴");
    assert_eq!(
        body["data"]["hourly"]["hourly"].as_array().unwrap().len(),
        24
    );

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/itab/weather/search?keyword=深圳",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(
        body["data"]
            .as_array()
            .unwrap()
            .iter()
            .any(|city| city["name"] == "深圳")
    );

    let (status, body) = json_call(&app, "GET", "/api/itab/bing-wallpapers", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["sourceStatus"], "fixture");
    assert_eq!(body["data"]["entries"][0]["id"], "fixture-wallpaper");

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/itab/bing-wallpapers?page=2&pageSize=2",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["sourceStatus"], "fixture");
    assert_eq!(body["data"]["currentPage"], 2);
    assert_eq!(body["data"]["totalPages"], 2);
    assert_eq!(body["data"]["entries"][0]["id"], "fixture-wallpaper-page2");

    let (status, body) = json_call(
        &app,
        "POST",
        "/api/wallpaper/resolve",
        Some(&token),
        Some(json!({"url": "http://127.0.0.1/private.jpg"})),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "blocked_host");

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

    let (status, body) =
        json_call(&app, "DELETE", "/api/admin/users/alice", Some(&token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
}

#[tokio::test]
async fn widget_fallbacks_cover_empty_runtime_cache() {
    let app = test_app_with_widget_cache(false).await;

    let (status, body) = json_call(&app, "GET", "/api/itab/poem", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["sourceStatus"], "fallback");
    assert_eq!(body["data"]["poemTitle"], "浪淘沙");
}

#[tokio::test]
async fn weather_current_uses_five_minute_cache_even_when_refresh_requested() {
    let app = test_app_with_seeded_weather_cache().await;

    let (status, body) = json_call(
        &app,
        "GET",
        "/api/itab/weather/current?location=101280608&type=city&refresh=true",
        None,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["sourceStatus"], "ok");
    assert_eq!(body["data"]["provider"], "test-cache");
    assert_eq!(body["data"]["current"]["now"]["cond_txt"], "缓存晴");
}
