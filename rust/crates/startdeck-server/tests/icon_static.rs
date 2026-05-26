use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use startdeck_core::{
    RuntimeConfig, connect_sqlite, import_icon_service_data, import_legacy_app_data,
};
use startdeck_iconserver::{IconState, app as icon_app};
use startdeck_server::{AppState, app as server_app};
use tokio::net::TcpListener;
use tower::ServiceExt;

async fn spawn_icon_service(base: &std::path::Path) -> (String, tokio::task::JoinHandle<()>) {
    let icon_base = base.join("icon-service");
    let icon_data_dir = icon_base.join("runtime-data");
    let icon_resource_dir = icon_base.join("defaults");

    std::fs::create_dir_all(icon_data_dir.join("cache")).unwrap();
    std::fs::create_dir_all(icon_resource_dir.join("icons")).unwrap();
    std::fs::write(
        icon_resource_dir.join("icons/resource.svg"),
        r#"<svg id="resource"/>"#,
    )
    .unwrap();
    std::fs::write(
        icon_data_dir.join("cache/runtime-cache.svg"),
        r#"<svg id="runtime-cache"/>"#,
    )
    .unwrap();

    let mut config = RuntimeConfig::from_base_dir(icon_base);
    config.icon_service_data_dir = icon_data_dir;
    config.icon_service_resource_dir = icon_resource_dir;
    let pool = connect_sqlite(&config).await.unwrap();
    import_icon_service_data(&pool, &config).await.unwrap();
    let router = icon_app(IconState::new(config, pool));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (format!("http://{addr}"), handle)
}

async fn main_app(icon_service_base: String, base: &std::path::Path) -> axum::Router {
    let main_base = base.join("main-service");
    let data_dir = main_base.join("Data/data");
    let public_dir = main_base.join("Data/public");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::create_dir_all(public_dir.join("icons")).unwrap();
    std::fs::write(public_dir.join("index.html"), "<main>StartDeck</main>").unwrap();
    std::fs::write(
        public_dir.join("icons/main-public.svg"),
        r#"<svg id="main-public"/>"#,
    )
    .unwrap();
    std::fs::write(data_dir.join("system.json"), r#"{"authMode":"single"}"#).unwrap();

    let config = RuntimeConfig::from_base_dir(main_base);
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_app_data(&pool, &config).await.unwrap();
    server_app(AppState::new_with_icon_service_base(
        config,
        pool,
        false,
        icon_service_base,
    ))
}

#[tokio::test]
async fn proxies_icon_service_static_resources_over_http() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.keep();
    let (icon_service_base, icon_service) = spawn_icon_service(&base).await;
    let app = main_app(icon_service_base, &base).await;

    for (uri, expected) in [
        ("/icons/main-public.svg", r#"<svg id="main-public"/>"#),
        ("/icons/resource.svg", r#"<svg id="resource"/>"#),
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

    icon_service.abort();
}
