use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::json;
use startdeck_core::{RuntimeConfig, connect_sqlite, import_legacy_app_data};
use startdeck_server::{AppState, app as server_app};
use tower::ServiceExt;

async fn main_app(base: &std::path::Path) -> axum::Router {
    let main_base = base.join("main-service");
    let data_dir = main_base.join("Data/data");
    let public_dir = main_base.join("Data/public");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::create_dir_all(public_dir.join("icons")).unwrap();
    std::fs::write(public_dir.join("index.html"), "<main>StartDeck</main>").unwrap();
    std::fs::write(
        data_dir.join("data.json"),
        serde_json::to_vec(&json!({
            "username": "admin",
            "password": "secret",
            "groups": [{
                "id": "main",
                "title": "Main",
                "items": [{
                    "id": "example",
                    "title": "Example",
                    "url": "https://example.com/",
                    "icon": "",
                    "isPublic": true
                }]
            }],
            "widgets": []
        }))
        .unwrap(),
    )
    .unwrap();
    std::fs::write(
        public_dir.join("icons/main-public.svg"),
        r#"<svg id="main-public"/>"#,
    )
    .unwrap();
    std::fs::write(data_dir.join("system.json"), r#"{"authMode":"single"}"#).unwrap();

    let config = RuntimeConfig::from_base_dir(main_base);
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_app_data(&pool, &config).await.unwrap();
    server_app(AppState::new_with_meta_server_base(
        config,
        pool,
        false,
        "http://127.0.0.1:9",
    ))
}

#[tokio::test]
async fn old_icon_routes_are_not_exposed_by_main_backend() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.keep();
    let app = main_app(&base).await;

    for uri in [
        "/api/site/metadata?url=https%3A%2F%2Fexample.com",
        "/api/site/icon?url=https%3A%2F%2Fexample.com",
        "/api/icon-cache",
        "/icon-cache/missing.svg",
        "/icons/main-public.svg",
        "/cache/runtime-cache.svg",
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{uri}");
    }
}
