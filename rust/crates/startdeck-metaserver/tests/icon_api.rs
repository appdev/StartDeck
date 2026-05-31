use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use axum::Json;
use axum::Router;
use axum::body::{Body, to_bytes};
use axum::extract::{Query, State};
use axum::http::{Request, StatusCode};
use axum::response::Html;
use axum::routing::get;
use serde_json::{Value, json};
use sqlx::SqlitePool;
use startdeck_core::{RuntimeConfig, connect_sqlite, import_meta_server_data};
use startdeck_metaserver::{MetaState, app};
use tokio::net::TcpListener;
use tower::ServiceExt;

struct TestMetaApp {
    app: axum::Router,
    pool: SqlitePool,
    config: RuntimeConfig,
}

async fn test_app() -> axum::Router {
    test_app_with_microlink_api("").await
}

async fn test_app_with_microlink_api(microlink_api_url: &str) -> axum::Router {
    test_app_context_with_microlink_api(microlink_api_url)
        .await
        .app
}

async fn test_app_context_with_microlink_api(microlink_api_url: &str) -> TestMetaApp {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.keep();
    let meta_resource = base.join("rust/crates/startdeck-metaserver/resources/data");
    let meta_data = base.join("meta-service-data");
    std::fs::create_dir_all(meta_resource.join("icons")).unwrap();
    std::fs::create_dir_all(meta_data.join("cache")).unwrap();
    std::fs::create_dir_all(base.join("Data/data")).unwrap();
    std::fs::write(
        base.join("Data/data/system.json"),
        r#"{"authMode":"single","enableDocker":false}"#,
    )
    .unwrap();
    std::fs::write(
        meta_resource.join("seed-data.json"),
        serde_json::to_vec(&json!({"items": [{"title": "Example", "url": "https://example.com", "icon_url": "icons/example.svg", "background_color": "#abc"}]})).unwrap(),
    )
    .unwrap();
    std::fs::write(meta_resource.join("icons/example.svg"), "<svg/>").unwrap();
    std::fs::write(
        meta_data.join("cache/runtime-cache.svg"),
        "<svg id=\"runtime\"/>",
    )
    .unwrap();

    let mut config = RuntimeConfig::from_base_dir(base.to_path_buf());
    config.meta_server_data_dir = meta_data;
    config.meta_server_resource_dir = meta_resource;
    let pool = connect_sqlite(&config).await.unwrap();
    import_meta_server_data(&pool, &config).await.unwrap();
    let app =
        app(MetaState::new(config.clone(), pool.clone()).with_microlink_api_url(microlink_api_url));
    TestMetaApp { app, pool, config }
}

async fn test_app_context_with_public_base_url(public_base_url: &str) -> TestMetaApp {
    let mut context = test_app_context_with_microlink_api("").await;
    context.app = app(MetaState::new(context.config.clone(), context.pool.clone())
        .with_microlink_api_url("")
        .with_public_meta_base_url(public_base_url));
    context
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

async fn spawn_dynamic_icon_site() -> (String, tokio::task::JoinHandle<()>) {
    let router = Router::new()
        .route(
            "/",
            get(|| async {
                Html(
                    r#"<html><head>
                        <title>Dynamic Icon Site</title>
                        <link rel="shortcut icon" type="image/png" href="about:blank">
                    </head><body></body></html>"#,
                )
            }),
        )
        .route("/favicon.ico", get(|| async { StatusCode::NOT_FOUND }));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (format!("http://{addr}"), handle)
}

async fn spawn_no_icon_site() -> (String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
    let hits = Arc::new(AtomicUsize::new(0));
    let router = Router::new()
        .route(
            "/",
            get(|State(hits): State<Arc<AtomicUsize>>| async move {
                hits.fetch_add(1, Ordering::SeqCst);
                Html(r#"<html><head><title>No Icon Site</title></head><body></body></html>"#)
            }),
        )
        .route(
            "/favicon.ico",
            get(|State(hits): State<Arc<AtomicUsize>>| async move {
                hits.fetch_add(1, Ordering::SeqCst);
                StatusCode::NOT_FOUND
            }),
        )
        .with_state(hits.clone());
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (format!("http://{addr}"), hits, handle)
}

async fn spawn_blocked_site() -> (String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
    let hits = Arc::new(AtomicUsize::new(0));
    let router = Router::new()
        .route(
            "/",
            get(|State(hits): State<Arc<AtomicUsize>>| async move {
                hits.fetch_add(1, Ordering::SeqCst);
                (
                    StatusCode::SERVICE_UNAVAILABLE,
                    [("cf-ray", "test-ray"), ("server", "cloudflare")],
                    "<html><title>Just a moment...</title><script src=\"/cdn-cgi/challenge-platform/h/b/orchestrate\"></script></html>",
                )
            }),
        )
        .with_state(hits.clone());
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (format!("http://{addr}"), hits, handle)
}

async fn spawn_error_site() -> (String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
    let hits = Arc::new(AtomicUsize::new(0));
    let router = Router::new()
        .route(
            "/",
            get(|State(hits): State<Arc<AtomicUsize>>| async move {
                hits.fetch_add(1, Ordering::SeqCst);
                (StatusCode::INTERNAL_SERVER_ERROR, "upstream failed")
            }),
        )
        .with_state(hits.clone());
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (format!("http://{addr}"), hits, handle)
}

async fn spawn_remote_icon_challenge_site() -> (String, tokio::task::JoinHandle<()>) {
    let router = Router::new()
        .route(
            "/",
            get(|| async {
                Html(
                    r#"<html><head>
                        <title>Icon Challenge Site</title>
                        <link rel="icon" href="/favicon.ico">
                    </head><body></body></html>"#,
                )
            }),
        )
        .route(
            "/favicon.ico",
            get(|| async {
                (
                    StatusCode::SERVICE_UNAVAILABLE,
                    [
                        ("cf-ray", "test-ray"),
                        ("server", "cloudflare"),
                        ("content-type", "text/html"),
                    ],
                    "<html><title>Just a moment...</title><script src=\"/cdn-cgi/challenge-platform/h/b/orchestrate\"></script></html>",
                )
            }),
        );
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (format!("http://{addr}"), handle)
}

async fn spawn_remote_icon_rate_limited_site() -> (String, tokio::task::JoinHandle<()>) {
    let router = Router::new()
        .route(
            "/",
            get(|| async {
                Html(
                    r#"<html><head>
                        <title>Icon Rate Limited Site</title>
                        <link rel="icon" href="/favicon.ico">
                    </head><body></body></html>"#,
                )
            }),
        )
        .route(
            "/favicon.ico",
            get(|| async { (StatusCode::TOO_MANY_REQUESTS, "rate limited") }),
        );
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (format!("http://{addr}"), handle)
}

async fn spawn_repairable_icon_site() -> (String, tokio::task::JoinHandle<()>) {
    let router = Router::new()
        .route(
            "/",
            get(|| async {
                Html(
                    r#"<html><head>
                        <title>Repairable Icon Site</title>
                        <link rel="icon" href="/favicon.ico">
                    </head><body></body></html>"#,
                )
            }),
        )
        .route(
            "/favicon.ico",
            get(|| async { ([("content-type", "image/png")], "repair-icon") }),
        );
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (format!("http://{addr}"), handle)
}

async fn spawn_microlink_media_fixture() -> (
    String,
    String,
    tokio::task::JoinHandle<()>,
    tokio::task::JoinHandle<()>,
) {
    let site_router = Router::new()
        .route(
            "/",
            get(|| async {
                Html(
                    r#"<html><head>
                        <title>Fallback Site Title</title>
                        <meta name="description" content="Fallback description">
                        <link rel="icon" href="/fallback.ico">
                    </head><body></body></html>"#,
                )
            }),
        )
        .route(
            "/logo.png",
            get(|| async { ([("content-type", "image/png")], "microlink-logo") }),
        )
        .route(
            "/fallback.ico",
            get(|| async { ([("content-type", "image/x-icon")], "fallback-icon") }),
        );
    let site_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let site_addr = site_listener.local_addr().unwrap();
    let site_url = format!("http://{site_addr}");
    let site_handle = tokio::spawn(async move {
        axum::serve(site_listener, site_router).await.unwrap();
    });

    let microlink_target_url = site_url.clone();
    let microlink_logo_url = format!("{site_url}/logo.png");
    let microlink_router = Router::new().route(
        "/",
        get(move |Query(_query): Query<HashMap<String, String>>| {
            let target_url = microlink_target_url.clone();
            let logo_url = microlink_logo_url.clone();
            async move {
                Json(json!({
                    "status": "success",
                    "data": {
                        "title": "Microlink Site Title",
                        "description": "Microlink description",
                        "url": target_url,
                        "publisher": "Example",
                        "logo": {
                            "url": logo_url,
                            "type": "png",
                            "width": 64,
                            "height": 64
                        }
                    },
                    "statusCode": 200
                }))
            }
        }),
    );
    let microlink_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let microlink_addr = microlink_listener.local_addr().unwrap();
    let microlink_handle = tokio::spawn(async move {
        axum::serve(microlink_listener, microlink_router)
            .await
            .unwrap();
    });

    (
        site_url,
        format!("http://{microlink_addr}"),
        site_handle,
        microlink_handle,
    )
}

fn encode_url_param(value: &str) -> String {
    value
        .replace(':', "%3A")
        .replace('/', "%2F")
        .replace('#', "%23")
}

fn host_key(value: &str) -> String {
    value
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .split(':')
        .next()
        .unwrap_or(value)
        .to_string()
}

fn assert_public_icon_proxy(value: &Value) {
    let icon = value.as_str().expect("icon should be a string");
    assert!(
        icon.contains("/api/site/icon?url="),
        "icon should route through /api/site/icon, got {icon}"
    );
    assert!(
        !icon.starts_with("/icons/") && !icon.starts_with("/cache/"),
        "icon should not expose direct static path, got {icon}"
    );
}

async fn insert_icon_record_with_asset(pool: &SqlitePool, host: &str, site_url: &str, icon: &str) {
    sqlx::query(
        r#"INSERT OR REPLACE INTO icon_records(
            host, title, url, final_url, description, background_color, source,
            fetch_status, failure_kind, failure_count, retry_after, last_error, fetched_at, updated_at
        ) VALUES (?, ?, ?, ?, '', '', 'test', 'ok', '', 0, 0, '', 1700000000000, 1700000000000)"#,
    )
    .bind(host)
    .bind(format!("Title {host}"))
    .bind(site_url)
    .bind(site_url)
    .execute(pool)
    .await
    .unwrap();
    sqlx::query("DELETE FROM icon_assets WHERE host = ?")
        .bind(host)
        .execute(pool)
        .await
        .unwrap();
    sqlx::query(
        r#"INSERT INTO icon_assets(host, asset_kind, url, is_local, sort_order)
           VALUES (?, 'primary', ?, 1, 0)"#,
    )
    .bind(host)
    .bind(icon)
    .execute(pool)
    .await
    .unwrap();
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
    assert_public_icon_proxy(&body["data"]["icon"]);
    assert_eq!(
        body["data"]["icon"],
        "/api/site/icon?url=https%3A%2F%2Fexample.com%2F"
    );
    assert_eq!(body["data"]["iconUrl"], body["data"]["icon"]);

    let (status, body) = json_call(&app, "/api/site/metadata?url=https%3A%2F%2Fexample.com").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["title"], "Example");
    assert_public_icon_proxy(&body["data"]["icon"]);
    assert_eq!(
        body["data"]["icon"],
        "/api/site/icon?url=https%3A%2F%2Fexample.com%2F"
    );
    assert_eq!(body["data"]["iconUrl"], body["data"]["icon"]);

    let response = app
        .clone()
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
        .clone()
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

    let response = app
        .clone()
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

#[tokio::test]
async fn public_meta_base_url_is_applied_to_json_icon_fields() {
    let TestMetaApp { app, .. } =
        test_app_context_with_public_base_url("https://meta.example.test/base/").await;

    let (status, body) = json_call(&app, "/api/icon?host=example.com").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body["data"]["icon"],
        "https://meta.example.test/base/api/site/icon?url=https%3A%2F%2Fexample.com%2F"
    );
    assert_eq!(body["data"]["iconUrl"], body["data"]["icon"]);

    let (status, body) = json_call(&app, "/api/site/metadata?url=https%3A%2F%2Fexample.com").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body["data"]["icon"],
        "https://meta.example.test/base/api/site/icon?url=https%3A%2F%2Fexample.com%2F"
    );
    assert_eq!(body["data"]["iconUrl"], body["data"]["icon"]);
}

#[tokio::test]
async fn site_icon_resolves_canonical_and_legacy_local_refs() {
    let TestMetaApp { app, pool, .. } = test_app_context_with_microlink_api("").await;
    let cases: Vec<(&str, &str, &[u8])> = vec![
        (
            "canonical-icons.example.com",
            "icons/example.svg",
            b"<svg/>",
        ),
        (
            "legacy-data-icons.example.com",
            "data/icons/example.svg",
            b"<svg/>",
        ),
        (
            "legacy-slash-icons.example.com",
            "/icons/example.svg",
            b"<svg/>",
        ),
        (
            "canonical-cache.example.com",
            "cache/runtime-cache.svg",
            b"<svg id=\"runtime\"/>",
        ),
        (
            "legacy-data-cache.example.com",
            "data/cache/runtime-cache.svg",
            b"<svg id=\"runtime\"/>",
        ),
        (
            "legacy-slash-cache.example.com",
            "/cache/runtime-cache.svg",
            b"<svg id=\"runtime\"/>",
        ),
    ];

    for (host, icon, expected) in cases {
        let site_url = format!("https://{host}");
        insert_icon_record_with_asset(&pool, host, &site_url, icon).await;
        let encoded_site_url = encode_url_param(&site_url);
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/site/icon?url={encoded_site_url}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "case {host}");
        let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(&bytes[..], expected, "case {host}");
    }
}

#[test]
fn seed_data_guard_keeps_item_count_and_canonical_icon_urls() {
    let seed_path =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/data/seed-data.json");
    let text = std::fs::read_to_string(seed_path).unwrap();
    let data: Value = serde_json::from_str(&text).unwrap();
    let items = data["items"].as_array().unwrap();
    assert_eq!(items.len(), 4362);
    assert_eq!(
        items
            .iter()
            .filter(|item| item["icon_url"]
                .as_str()
                .unwrap_or_default()
                .starts_with("data/icons/"))
            .count(),
        0
    );
    assert_eq!(
        items
            .iter()
            .filter(|item| item["icon_url"]
                .as_str()
                .unwrap_or_default()
                .starts_with("icons/"))
            .count(),
        4362
    );

    let mut item_key_sequences = Vec::new();
    let mut current_keys = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix('"')
            && let Some((key, _)) = rest.split_once('"')
            && matches!(
                key,
                "title"
                    | "url"
                    | "icon_url"
                    | "original_icon_url"
                    | "background_color"
                    | "icon_local_host"
            )
        {
            current_keys.push(key.to_string());
        }
        if (trimmed == "}," || trimmed == "}") && !current_keys.is_empty() {
            item_key_sequences.push(std::mem::take(&mut current_keys));
        }
    }
    assert_eq!(item_key_sequences.len(), 4362);
    assert!(item_key_sequences.iter().all(|keys| {
        keys == &[
            "title".to_string(),
            "url".to_string(),
            "icon_url".to_string(),
            "original_icon_url".to_string(),
            "background_color".to_string(),
            "icon_local_host".to_string(),
        ]
    }));
}

#[tokio::test]
async fn microlink_media_lookup_is_used_before_html_discovery() {
    let (site_url, microlink_url, site_handle, microlink_handle) =
        spawn_microlink_media_fixture().await;
    let app = test_app_with_microlink_api(&microlink_url).await;
    let encoded_site_url = encode_url_param(&format!("{site_url}/#/dashboard"));

    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["url"], format!("{site_url}/"));
    assert_eq!(body["data"]["title"], "Microlink Site Title");
    assert_eq!(body["data"]["description"], "Microlink description");
    let icon_path = body["data"]["icon"].as_str().unwrap();
    assert_public_icon_proxy(&body["data"]["icon"]);
    assert!(icon_path.starts_with("/api/site/icon?url="));
    assert!(!icon_path.starts_with("/cache/"));
    assert!(!icon_path.starts_with("/icons/"));
    assert_eq!(body["data"]["iconUrl"], icon_path);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(icon_path)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(&bytes[..], b"microlink-logo");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/site/icon?url={encoded_site_url}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(&bytes[..], b"microlink-logo");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/icon/refresh?url={encoded_site_url}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let refresh_body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_public_icon_proxy(&refresh_body["data"]["icon"]);
    assert_eq!(
        refresh_body["data"]["iconUrl"],
        refresh_body["data"]["icon"]
    );

    site_handle.abort();
    microlink_handle.abort();
}

#[tokio::test]
async fn dynamic_placeholder_icon_returns_no_icon_instead_of_bad_gateway() {
    let app = test_app().await;
    let (site_url, site_handle) = spawn_dynamic_icon_site().await;
    let encoded_site_url = encode_url_param(&format!("{site_url}/"));

    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["title"], "Dynamic Icon Site");
    assert_eq!(body["data"]["icon"], Value::Null);
    assert_eq!(body["data"]["iconUrl"], Value::Null);
    assert_eq!(body["data"]["fetchStatus"], "no_icon");
    assert!(body["data"]["retryAfter"].as_str().is_some());

    let (status, body) = json_call(&app, &format!("/api/site/icon?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], 404);
    assert_eq!(body["msg"], "icon_not_found");

    site_handle.abort();
}

#[tokio::test]
async fn no_icon_result_is_cached_until_retry_after() {
    let TestMetaApp { app, .. } = test_app_context_with_microlink_api("").await;
    let (site_url, hits, site_handle) = spawn_no_icon_site().await;
    let encoded_site_url = encode_url_param(&site_url);

    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["fetchStatus"], "no_icon");
    assert_eq!(body["data"]["failureKind"], "remote_icon_http_404");
    assert_eq!(hits.load(Ordering::SeqCst), 2);

    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["fetchStatus"], "no_icon");
    assert_eq!(hits.load(Ordering::SeqCst), 2);

    site_handle.abort();
}

#[tokio::test]
async fn blocked_result_is_terminal_until_manual_refresh() {
    let TestMetaApp { app, .. } = test_app_context_with_microlink_api("").await;
    let (site_url, hits, site_handle) = spawn_blocked_site().await;
    let encoded_site_url = encode_url_param(&site_url);

    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["fetchStatus"], "blocked");
    assert_eq!(body["data"]["failureKind"], "site_blocked");
    assert_eq!(body["data"]["retryAfter"], Value::Null);
    assert_eq!(hits.load(Ordering::SeqCst), 1);

    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["fetchStatus"], "blocked");
    assert_eq!(hits.load(Ordering::SeqCst), 1);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/icon/refresh?url={encoded_site_url}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["data"]["fetchStatus"], "blocked");
    assert_eq!(hits.load(Ordering::SeqCst), 2);

    site_handle.abort();
}

#[tokio::test]
async fn remote_icon_challenge_is_cached_as_blocked() {
    let TestMetaApp { app, .. } = test_app_context_with_microlink_api("").await;
    let (site_url, site_handle) = spawn_remote_icon_challenge_site().await;
    let encoded_site_url = encode_url_param(&site_url);

    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["title"], "Icon Challenge Site");
    assert_eq!(body["data"]["icon"], Value::Null);
    assert_eq!(body["data"]["fetchStatus"], "blocked");
    assert_eq!(body["data"]["failureKind"], "remote_icon_blocked");
    assert_eq!(body["data"]["retryAfter"], Value::Null);

    site_handle.abort();
}

#[tokio::test]
async fn plain_429_icon_response_uses_transient_error_backoff() {
    let TestMetaApp { app, pool, .. } = test_app_context_with_microlink_api("").await;
    let (site_url, site_handle) = spawn_remote_icon_rate_limited_site().await;
    let encoded_site_url = encode_url_param(&site_url);

    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["title"], "Icon Rate Limited Site");
    assert_eq!(body["data"]["fetchStatus"], "error");
    assert_eq!(body["data"]["failureKind"], "remote_icon_http_429");
    assert!(body["data"]["retryAfter"].as_str().is_some());

    let (retry_after, fetched_at): (i64, i64) =
        sqlx::query_as("SELECT retry_after, fetched_at FROM icon_records WHERE host = ?")
            .bind(host_key(&site_url))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(
        (2_000..=4_000).contains(&(retry_after - fetched_at)),
        "429 icon retry should use the first transient backoff"
    );

    site_handle.abort();
}

#[tokio::test]
async fn transient_errors_use_retry_after_and_backoff() {
    let TestMetaApp { app, pool, .. } = test_app_context_with_microlink_api("").await;
    let (site_url, hits, site_handle) = spawn_error_site().await;
    let encoded_site_url = encode_url_param(&site_url);

    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["fetchStatus"], "error");
    assert_eq!(body["data"]["failureKind"], "site_http_500");
    assert!(body["data"]["retryAfter"].as_str().is_some());
    assert_eq!(hits.load(Ordering::SeqCst), 1);
    let (first_retry_after, first_fetched_at): (i64, i64) =
        sqlx::query_as("SELECT retry_after, fetched_at FROM icon_records WHERE host = ?")
            .bind(host_key(&site_url))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(
        (2_000..=4_000).contains(&(first_retry_after - first_fetched_at)),
        "first retry should be about 3 seconds"
    );

    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["fetchStatus"], "error");
    assert_eq!(hits.load(Ordering::SeqCst), 1);

    sqlx::query("UPDATE icon_records SET retry_after = 0 WHERE host = ?")
        .bind(host_key(&site_url))
        .execute(&pool)
        .await
        .unwrap();
    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["fetchStatus"], "error");
    assert_eq!(hits.load(Ordering::SeqCst), 2);
    let (failure_count, second_retry_after, second_fetched_at): (i64, i64, i64) = sqlx::query_as(
        "SELECT failure_count, retry_after, fetched_at FROM icon_records WHERE host = ?",
    )
    .bind(host_key(&site_url))
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(failure_count, 2);
    assert!(
        (5_000..=7_000).contains(&(second_retry_after - second_fetched_at)),
        "second retry should be about 6 seconds"
    );

    sqlx::query("UPDATE icon_records SET failure_count = 30, retry_after = 0 WHERE host = ?")
        .bind(host_key(&site_url))
        .execute(&pool)
        .await
        .unwrap();
    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["fetchStatus"], "error");
    assert_eq!(hits.load(Ordering::SeqCst), 3);
    let (failure_count, capped_retry_after, capped_fetched_at): (i64, i64, i64) = sqlx::query_as(
        "SELECT failure_count, retry_after, fetched_at FROM icon_records WHERE host = ?",
    )
    .bind(host_key(&site_url))
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(failure_count, 31);
    assert!(
        (3_590_000..=3_601_000).contains(&(capped_retry_after - capped_fetched_at)),
        "transient retry should cap at about 1 hour"
    );

    site_handle.abort();
}

#[tokio::test]
async fn missing_local_cache_file_refreshes_immediately() {
    let TestMetaApp { app, pool, config } = test_app_context_with_microlink_api("").await;
    let (site_url, site_handle) = spawn_repairable_icon_site().await;
    let encoded_site_url = encode_url_param(&site_url);

    let (status, body) =
        json_call(&app, &format!("/api/site/metadata?url={encoded_site_url}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["fetchStatus"], "ok");
    let cached_icon: String = sqlx::query_scalar(
        "SELECT url FROM icon_assets WHERE host = ? ORDER BY sort_order ASC LIMIT 1",
    )
    .bind(host_key(&site_url))
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(cached_icon.starts_with("cache/"));
    assert!(!cached_icon.starts_with("/cache/"));
    let cache_file = cached_icon.strip_prefix("cache/").unwrap();
    let cache_path = config.meta_server_data_dir.join("cache").join(cache_file);
    assert!(cache_path.is_file());
    std::fs::remove_file(&cache_path).unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/site/icon?url={encoded_site_url}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(&bytes[..], b"repair-icon");
    assert!(cache_path.is_file());

    site_handle.abort();
}
