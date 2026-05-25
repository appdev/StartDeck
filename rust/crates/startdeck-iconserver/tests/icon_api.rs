use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use serde_json::{Value, json};
use startdeck_core::{RuntimeConfig, connect_sqlite, import_legacy_data};
use startdeck_iconserver::{IconState, app};
use tower::ServiceExt;

async fn test_app() -> axum::Router {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.keep();
    let icon_data = base.join("icon-service/data");
    std::fs::create_dir_all(icon_data.join("icons")).unwrap();
    std::fs::create_dir_all(base.join("server/data")).unwrap();
    std::fs::write(
        base.join("server/data/system.json"),
        r#"{"authMode":"single","enableDocker":false}"#,
    )
    .unwrap();
    std::fs::write(
        icon_data.join("seed-data.json"),
        serde_json::to_vec(&json!({"items": [{"title": "Example", "url": "https://example.com", "icon_url": "example.svg", "background_color": "#abc"}]})).unwrap(),
    )
    .unwrap();
    std::fs::write(icon_data.join("icons/example.svg"), "<svg/>").unwrap();

    let config = RuntimeConfig::from_base_dir(base.to_path_buf());
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_data(&pool, &config).await.unwrap();
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
}
