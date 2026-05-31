use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use serde_json::json;
use startdeck_core::{
    RuntimeConfig, connect_sqlite, import_legacy_app_data, import_meta_server_data,
};
use startdeck_metaserver::{MetaState, app as meta_app};
use startdeck_server::{AppState, app as server_app};
use tokio::net::TcpListener;
use tower::ServiceExt;

async fn spawn_meta_server(base: &std::path::Path) -> (String, tokio::task::JoinHandle<()>) {
    let meta_base = base.join("meta-service");
    let meta_data_dir = meta_base.join("runtime-data");
    let meta_resource_dir = meta_base.join("defaults");

    std::fs::create_dir_all(meta_data_dir.join("cache")).unwrap();
    std::fs::create_dir_all(meta_resource_dir.join("icons")).unwrap();
    std::fs::write(
        meta_resource_dir.join("icons/resource.svg"),
        r#"<svg id="resource"/>"#,
    )
    .unwrap();
    std::fs::write(
        meta_resource_dir.join("seed-data.json"),
        serde_json::to_vec(&json!({
            "items": [{
                "title": "Example",
                "url": "https://example.com/",
                "icon_url": "data/icons/resource.svg",
                "background_color": "#fff"
            }]
        }))
        .unwrap(),
    )
    .unwrap();
    std::fs::write(
        meta_resource_dir.join("icons/Bilibili_A+哔哩哔哩+bilibili.com.png"),
        r#"icon-with-unicode-path"#,
    )
    .unwrap();
    std::fs::write(
        meta_data_dir.join("cache/runtime-cache.svg"),
        r#"<svg id="runtime-cache"/>"#,
    )
    .unwrap();

    let mut config = RuntimeConfig::from_base_dir(meta_base);
    config.meta_server_data_dir = meta_data_dir;
    config.meta_server_resource_dir = meta_resource_dir;
    let pool = connect_sqlite(&config).await.unwrap();
    import_meta_server_data(&pool, &config).await.unwrap();
    let router = meta_app(MetaState::new(config, pool));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (format!("http://{addr}"), handle)
}

async fn main_app(meta_server_base: String, base: &std::path::Path) -> axum::Router {
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
                    "icon": "/icon-cache/missing.svg",
                    "isPublic": true
                }]
            }],
            "widgets": []
        }))
        .unwrap(),
    )
    .unwrap();
    // This file must be ignored by /icons routing; MetaServer is the only icon source.
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
        meta_server_base,
    ))
}

#[tokio::test]
async fn proxies_meta_server_static_resources_over_http() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.keep();
    let (meta_server_base, meta_server) = spawn_meta_server(&base).await;
    let app = main_app(meta_server_base, &base).await;

    for (uri, expected) in [
        ("/icons/resource.svg", r#"<svg id="resource"/>"#),
        (
            "/icons/Bilibili_A+%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9+bilibili.com.png",
            r#"icon-with-unicode-path"#,
        ),
        ("/cache/runtime-cache.svg", r#"<svg id="runtime-cache"/>"#),
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{uri}");
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(body.as_ref(), expected.as_bytes(), "{uri}");
    }

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/icons/main-public.svg")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    meta_server.abort();
}

#[tokio::test]
async fn missing_icon_cache_file_falls_back_to_meta_server() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.keep();
    let (meta_server_base, meta_server) = spawn_meta_server(&base).await;
    let app = main_app(meta_server_base, &base).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/icon-cache/missing.svg?t=1780113685141")
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
    assert_eq!(content_type, "image/svg+xml");
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(body.as_ref(), br#"<svg id="resource"/>"#);

    meta_server.abort();
}
