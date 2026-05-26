use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use serde_json::{Value, json};
use startdeck_core::{RuntimeConfig, connect_sqlite, import_icon_service_data};
use startdeck_iconserver::{IconState, app};
use tower::ServiceExt;

async fn test_app() -> axum::Router {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.keep();
    let icon_resource = base.join("rust/crates/startdeck-iconserver/resources/data");
    let icon_data = base.join("icon-service-data");
    std::fs::create_dir_all(icon_resource.join("icons")).unwrap();
    std::fs::create_dir_all(icon_data.join("cache")).unwrap();
    std::fs::create_dir_all(base.join("Data/data")).unwrap();
    std::fs::write(
        base.join("Data/data/system.json"),
        r#"{"authMode":"single","enableDocker":false}"#,
    )
    .unwrap();
    std::fs::write(
        icon_resource.join("seed-data.json"),
        serde_json::to_vec(&json!({"items": [{"title": "Example", "url": "https://example.com", "icon_url": "data/icons/example.svg", "background_color": "#abc"}]})).unwrap(),
    )
    .unwrap();
    std::fs::write(icon_resource.join("icons/example.svg"), "<svg/>").unwrap();
    std::fs::write(
        icon_data.join("cache.json"),
        serde_json::to_vec(&json!({"records": [{
            "host": "cache.example",
            "title": "Runtime Cache",
            "url": "https://cache.example",
            "localIcons": ["runtime-cache.svg"]
        }]}))
        .unwrap(),
    )
    .unwrap();
    std::fs::write(
        icon_data.join("cache/runtime-cache.svg"),
        "<svg id=\"runtime\"/>",
    )
    .unwrap();

    let mut config = RuntimeConfig::from_base_dir(base.to_path_buf());
    config.icon_service_data_dir = icon_data;
    config.icon_service_resource_dir = icon_resource;
    let pool = connect_sqlite(&config).await.unwrap();
    import_icon_service_data(&pool, &config).await.unwrap();
    app(IconState::new(config, pool))
}

async fn json_call(app: &axum::Router, uri: &str) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    (status, body)
}

#[tokio::test]
async fn seed_icon_lookup_returns_metadata_envelope() {
    let app = test_app().await;

    let (status, body) = json_call(&app, "/healthz").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["code"], 200);

    let (status, body) = json_call(&app, "/api/icon?host=example.com").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["code"], 200);
    assert_eq!(body["data"]["title"], "Example");
    assert_eq!(body["data"]["icon"], "/icons/example.svg");

    let (status, body) = json_call(&app, "/api/site/metadata?url=https%3A%2F%2Fexample.com").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["title"], "Example");
    assert_eq!(body["data"]["icon"], "/icons/example.svg");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/site/icon?url=https%3A%2F%2Fexample.com")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(&bytes[..], b"<svg/>");

    let app = test_app().await;
    let response = app
        .oneshot(
            Request::builder()
                .uri("/icons/example.svg")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(&bytes[..], b"<svg/>");

    let app = test_app().await;
    let (status, body) = json_call(&app, "/api/icon?host=cache.example").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["title"], "Runtime Cache");
    assert_eq!(body["data"]["icon"], "/cache/runtime-cache.svg");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/cache/runtime-cache.svg")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(&bytes[..], b"<svg id=\"runtime\"/>");
}
