use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, get_service, post};
use axum::{Json, Router};
use chrono::Utc;
use reqwest::{Client, Url};
use scraper::{Html, Selector};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use startdeck_core::models::{IconAssetRecord, IconRecord};
use startdeck_core::{RuntimeConfig, icon_record, upsert_icon_record};
use tokio::fs;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;

struct IconHttpResponse {
    status: StatusCode,
    headers: reqwest::header::HeaderMap,
    final_url: Url,
    raw_content_type: String,
    bytes: Vec<u8>,
}

#[derive(Clone)]
pub struct MetaState {
    config: Arc<RuntimeConfig>,
    pool: SqlitePool,
    http: Client,
    public_meta_base_url: Arc<String>,
    microlink_api_url: Arc<String>,
}

impl MetaState {
    pub fn new(config: RuntimeConfig, pool: SqlitePool) -> Self {
        Self {
            config: Arc::new(config),
            pool,
            http: Client::builder()
                .timeout(meta_server_timeout())
                .user_agent("StartDeck-MetaServer-Rust/1.0")
                .build()
                .expect("reqwest client"),
            public_meta_base_url: Arc::new(
                std::env::var("PUBLIC_META_BASE_URL").unwrap_or_default(),
            ),
            microlink_api_url: Arc::new(
                std::env::var("META_SERVER_MICROLINK_API_URL")
                    .unwrap_or_else(|_| "https://api.microlink.io".to_string())
                    .trim_end_matches('/')
                    .to_string(),
            ),
        }
    }

    pub fn with_microlink_api_url(mut self, url: impl Into<String>) -> Self {
        self.microlink_api_url = Arc::new(url.into().trim_end_matches('/').to_string());
        self
    }

    pub fn with_public_meta_base_url(mut self, url: impl Into<String>) -> Self {
        self.public_meta_base_url = Arc::new(url.into().trim_end_matches('/').to_string());
        self
    }
}

fn meta_server_timeout() -> Duration {
    meta_server_timeout_from_value(std::env::var("META_SERVER_TIMEOUT_MS").ok())
}

fn meta_server_timeout_from_value(value: Option<String>) -> Duration {
    let millis = value
        .as_deref()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_META_SERVER_TIMEOUT_MS);
    Duration::from_millis(millis)
}

pub fn meta_addr_from_env() -> String {
    if let Ok(addr) = std::env::var("META_SERVER_ADDR")
        && !addr.trim().is_empty()
    {
        return addr;
    }
    let host = std::env::var("META_SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("META_SERVER_PORT").unwrap_or_else(|_| "9002".to_string());
    format!("{host}:{port}")
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct NormalizedSiteTarget {
    input_url: Url,
    site_url: Url,
    host: String,
}

const FETCH_STATUS_OK: &str = "ok";
const FETCH_STATUS_NO_ICON: &str = "no_icon";
const FETCH_STATUS_BLOCKED: &str = "blocked";
const FETCH_STATUS_ERROR: &str = "error";
const NO_ICON_TTL_MS: i64 = 24 * 60 * 60 * 1000;
const ERROR_INITIAL_RETRY_MS: i64 = 3 * 1000;
const ERROR_MAX_RETRY_MS: i64 = 60 * 60 * 1000;
const DEFAULT_META_SERVER_TIMEOUT_MS: u64 = 60_000;
const MAX_ICON_CANDIDATES_TO_EVALUATE: usize = 8;
const ICON_CANDIDATE_CONCURRENCY: usize = 4;
const ACCEPTABLE_ICON_QUALITY_SCORE: i32 = 120;
const QUALITY_REFRESH_RETRY_MS: i64 = 24 * 60 * 60 * 1000;

#[derive(Clone, Debug)]
struct FetchFailure {
    status: &'static str,
    kind: String,
    message: String,
}

#[derive(Clone, Debug)]
struct RemoteMetadata {
    title: String,
    final_url: String,
    description: String,
    source: &'static str,
    candidates: Vec<IconCandidate>,
}

#[derive(Clone, Debug)]
struct IconCandidate {
    url: String,
    source: &'static str,
    rel: String,
    declared_type: String,
    declared_width: Option<u32>,
    declared_height: Option<u32>,
    sizes: String,
    sort_order: usize,
}

#[derive(Debug)]
struct DownloadedIconCandidate {
    candidate: IconCandidate,
    content_type: String,
    bytes: Vec<u8>,
    detected_width: Option<u32>,
    detected_height: Option<u32>,
    quality_score: i32,
}

#[derive(Debug, Default)]
struct CandidateEvaluation {
    best: Option<DownloadedIconCandidate>,
    failure: Option<FetchFailure>,
}

impl FetchFailure {
    fn no_icon(kind: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            status: FETCH_STATUS_NO_ICON,
            kind: kind.into(),
            message: message.into(),
        }
    }

    fn blocked(kind: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            status: FETCH_STATUS_BLOCKED,
            kind: kind.into(),
            message: message.into(),
        }
    }

    fn temporary(kind: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            status: FETCH_STATUS_ERROR,
            kind: kind.into(),
            message: message.into(),
        }
    }

    fn priority(&self) -> u8 {
        match self.status {
            FETCH_STATUS_BLOCKED => 3,
            FETCH_STATUS_ERROR => 2,
            FETCH_STATUS_NO_ICON => 1,
            _ => 0,
        }
    }
}

pub fn app(state: MetaState) -> Router {
    let icon_dir = state.config.meta_server_data_dir.join("icons");
    let meta_resource_dir = state.config.meta_server_resource_dir.join("icons");
    let cache_dir = state.config.meta_server_data_dir.join("cache");
    Router::new()
        .route("/healthz", get(healthz))
        .route("/api/icon", get(lookup_icon))
        .route("/api/site/metadata", get(site_metadata))
        .route("/api/site/icon", get(site_icon))
        .route("/api/icon/refresh", post(refresh_icon))
        .route("/api/icon/cache", delete(delete_icon_cache))
        .nest_service(
            "/icons",
            get_service(ServeDir::new(icon_dir).fallback(ServeDir::new(meta_resource_dir))),
        )
        .nest_service("/cache", get_service(ServeDir::new(cache_dir)))
        .fallback(not_found)
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

async fn healthz() -> Json<Value> {
    Json(json!({"code": 200, "msg": "ok"}))
}

async fn lookup_icon(
    State(state): State<MetaState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    let target = normalize_query_target(
        &query,
        &["host", "url"],
        "host_or_url_required",
        "invalid_host",
    )?;
    let record = get_or_fetch_record(&state, &target).await?;
    Ok(Json(
        json!({"code": 200, "data": icon_response_data(&state, &record), "msg": "ok"}),
    ))
}

async fn site_metadata(
    State(state): State<MetaState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    let target = normalize_query_target(&query, &["url"], "url_required", "invalid_url")?;
    let record = get_or_fetch_record(&state, &target).await?;
    let icon_url = public_site_icon_url(&state, &record);
    Ok(Json(json!({
        "code": 200,
        "data": {
            "url": record.url,
            "finalUrl": record.final_url,
            "title": empty_to_null(&record.title),
            "name": empty_to_null(&record.title),
            "icon": icon_url.clone(),
            "iconUrl": icon_url,
            "description": empty_to_null(&record.description),
            "backgroundColor": empty_to_null(&record.background_color),
            "fetchedAt": record.fetched_at.to_rfc3339(),
            "fetchStatus": &record.fetch_status,
            "failureKind": empty_to_null(&record.failure_kind),
            "retryAfter": retry_after_json(record.retry_after)
        },
        "msg": "ok"
    })))
}

async fn site_icon(
    State(state): State<MetaState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Response, IconError> {
    let target = normalize_query_target(&query, &["url", "host"], "url_required", "invalid_url")?;
    let record = get_or_fetch_record(&state, &target).await?;
    let icon = record
        .icon
        .clone()
        .ok_or_else(|| icon_record_missing_error(&record))?;
    if let Some(local) = resolve_local_icon(&state, &icon) {
        let bytes = fs::read(&local)
            .await
            .map_err(|_| IconError::not_found("icon_not_found"))?;
        return Ok(bytes_response(
            bytes,
            mime_guess::from_path(local)
                .first_or_octet_stream()
                .as_ref(),
        ));
    }
    let remote_icon_url =
        parse_http_url(&icon).ok_or_else(|| IconError::not_found("icon_not_found"))?;
    let response = state
        .http
        .get(remote_icon_url)
        .send()
        .await
        .map_err(|err| IconError::bad_gateway(err.to_string()))?;
    if !response.status().is_success() {
        return Err(IconError::bad_gateway("remote_icon_fetch_failed"));
    }
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| IconError::bad_gateway(err.to_string()))?;
    Ok(bytes_response(bytes.to_vec(), &content_type))
}

async fn refresh_icon(
    State(state): State<MetaState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    let target = normalize_query_target(
        &query,
        &["host", "url"],
        "host_or_url_required",
        "invalid_host",
    )?;
    let record = fetch_remote_record(&state, &target, None).await?;
    upsert_icon_record(&state.pool, &record).await?;
    Ok(Json(
        json!({"code": 200, "data": icon_response_data(&state, &record), "msg": "ok"}),
    ))
}

async fn delete_icon_cache(
    State(state): State<MetaState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, IconError> {
    sqlx::query("DELETE FROM icon_records WHERE host = ? AND source != 'seed'")
        .bind(
            normalize_query_target(
                &query,
                &["host", "url"],
                "host_or_url_required",
                "invalid_host",
            )?
            .host,
        )
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({"code": 200, "msg": "ok"})))
}

async fn not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(json!({"code": 404, "msg": "not found"})),
    )
        .into_response()
}

async fn get_or_fetch_record(
    state: &MetaState,
    target: &NormalizedSiteTarget,
) -> Result<IconRecord, IconError> {
    if let Some(record) = icon_record(&state.pool, &target.host).await? {
        let record = prepare_cached_record_quality(state, record).await?;
        if should_refresh_record(state, &record) {
            let local_icon_missing = record
                .icon
                .as_deref()
                .map(|icon| local_icon_reference_missing(state, icon))
                .unwrap_or(false);
            let low_quality_refresh = cached_record_is_low_quality(&record)
                && record.source != "seed"
                && quality_refresh_due(&record);
            let refreshed = fetch_remote_record(state, target, Some(&record)).await?;
            if low_quality_refresh
                && !local_icon_missing
                && refreshed.fetch_status != FETCH_STATUS_OK
            {
                let preserved = defer_cached_quality_refresh(state, record).await?;
                return Ok(preserved);
            }
            upsert_icon_record(&state.pool, &refreshed).await?;
            return Ok(refreshed);
        }
        return Ok(record);
    }
    let record = fetch_remote_record(state, target, None).await?;
    upsert_icon_record(&state.pool, &record).await?;
    Ok(record)
}

async fn fetch_remote_record(
    state: &MetaState,
    target: &NormalizedSiteTarget,
    previous: Option<&IconRecord>,
) -> Result<IconRecord, IconError> {
    let mut discovery_failure = None::<FetchFailure>;
    let microlink =
        match fetch_microlink_metadata(state, &target.site_url, &target.host, false).await {
            Ok(metadata) => Some(metadata),
            Err(err) => {
                tracing::debug!(
                host = %target.host,
                status = %err.status,
                error = %err.message,
                    "microlink metadata lookup failed"
                );
                if err.kind != "microlink_disabled" {
                    discovery_failure = Some(select_stronger_failure(discovery_failure, err));
                }
                None
            }
        };
    let html = match fetch_html_metadata(state, target).await {
        Ok(metadata) => Some(metadata),
        Err(err) => {
            tracing::debug!(
                host = %target.host,
                status = %err.status,
                error = %err.message,
                "direct HTML metadata lookup failed"
            );
            discovery_failure = Some(select_stronger_failure(discovery_failure, err));
            None
        }
    };
    let metadata = combined_metadata(target, microlink.as_ref(), html.as_ref());
    let mut candidates = Vec::new();
    if let Some(metadata) = microlink.as_ref() {
        extend_icon_candidates(&mut candidates, metadata.candidates.iter().cloned());
    }
    if let Some(metadata) = html.as_ref() {
        extend_icon_candidates(&mut candidates, metadata.candidates.iter().cloned());
    }
    extend_icon_candidates(&mut candidates, root_favicon_candidates(&target.site_url));

    let mut evaluation = evaluate_icon_candidates(state, candidates).await;
    if evaluation.best.as_ref().is_some_and(is_low_quality_icon)
        && microlink.is_some()
        && let Ok(force_metadata) =
            fetch_microlink_metadata(state, &target.site_url, &target.host, true).await
    {
        let force_evaluation = evaluate_icon_candidates(state, force_metadata.candidates).await;
        evaluation = choose_better_evaluation(evaluation, force_evaluation);
    }

    if let Some(best) = evaluation.best {
        let local_icon = match cache_downloaded_icon(state, &target.host, &best).await {
            Ok(icon) => icon,
            Err(failure) => {
                return Ok(failure_record(
                    target,
                    metadata.source,
                    metadata.title,
                    metadata.final_url,
                    metadata.description,
                    previous,
                    failure,
                ));
            }
        };
        let source = if best.candidate.source.starts_with("microlink") {
            "microlink"
        } else {
            "remote"
        };
        let icon_asset = downloaded_icon_asset_record(&local_icon, &best);
        return Ok(ok_record(
            &target.host,
            metadata.title,
            target.site_url.to_string(),
            metadata.final_url,
            metadata.description,
            source,
            Some(local_icon),
            Some(icon_asset),
        ));
    }

    let failure = match (evaluation.failure, discovery_failure) {
        (Some(candidate), current) => select_stronger_failure(current, candidate),
        (None, Some(failure)) => failure,
        (None, None) => {
            FetchFailure::no_icon("icon_candidates_empty", "no usable icon candidates found")
        }
    };
    Ok(failure_record(
        target,
        metadata.source,
        metadata.title,
        metadata.final_url,
        metadata.description,
        previous,
        failure,
    ))
}

async fn fetch_microlink_metadata(
    state: &MetaState,
    url: &Url,
    host: &str,
    force: bool,
) -> Result<RemoteMetadata, FetchFailure> {
    if state.microlink_api_url.trim().is_empty() {
        return Err(FetchFailure::temporary(
            "microlink_disabled",
            "microlink_disabled",
        ));
    }
    let mut request = state
        .http
        .get(state.microlink_api_url.as_str())
        .query(&[("url", url.as_str())]);
    if force {
        request = request.query(&[("force", "true")]);
    }
    let response = request
        .send()
        .await
        .map_err(|err| FetchFailure::temporary("microlink_fetch_failed", err.to_string()))?;
    if !response.status().is_success() {
        return Err(FetchFailure::temporary(
            "microlink_fetch_failed",
            "microlink_fetch_failed",
        ));
    }
    let payload = response
        .json::<Value>()
        .await
        .map_err(|err| FetchFailure::temporary("microlink_payload_invalid", err.to_string()))?;
    let data = microlink_data_payload(&payload)
        .ok_or_else(|| FetchFailure::temporary("microlink_payload_invalid", "invalid payload"))?;
    if microlink_failed(&payload) {
        return Err(FetchFailure::temporary(
            "microlink_status_failed",
            "microlink_status_failed",
        ));
    }
    let logo = data.get("logo").unwrap_or(&Value::Null);
    let mut candidates = Vec::new();
    if let Some(logo_url) = nested_string(data, &["logo", "url"])
        .filter(|candidate| parse_http_url(candidate).is_some())
    {
        candidates.push(IconCandidate {
            url: logo_url,
            source: if force {
                "microlink_force"
            } else {
                "microlink"
            },
            rel: "microlink-logo".to_string(),
            declared_type: string_value(logo, "type").unwrap_or_default(),
            declared_width: numeric_u32(logo.get("width")),
            declared_height: numeric_u32(logo.get("height")),
            sizes: String::new(),
            sort_order: 0,
        });
    }
    Ok(RemoteMetadata {
        title: string_value(data, "title").unwrap_or_else(|| host.to_string()),
        final_url: string_value(data, "url").unwrap_or_else(|| url.to_string()),
        description: string_value(data, "description").unwrap_or_default(),
        source: "microlink",
        candidates,
    })
}

async fn fetch_html_metadata(
    state: &MetaState,
    target: &NormalizedSiteTarget,
) -> Result<RemoteMetadata, FetchFailure> {
    let response = state
        .http
        .get(target.site_url.clone())
        .send()
        .await
        .map_err(|err| FetchFailure::temporary("site_fetch_failed", err.to_string()))?;
    let status = response.status();
    let headers = response.headers().clone();
    let final_url = response.url().to_string();
    let html = response
        .text()
        .await
        .map_err(|err| FetchFailure::temporary("site_body_read_failed", err.to_string()))?;
    if is_blocked_response(status, &headers, &html) {
        return Err(FetchFailure::blocked(
            "site_blocked",
            "site blocked by anti-bot challenge",
        ));
    }
    if !status.is_success() {
        return Err(classify_http_response("site", status, &headers, &html));
    }
    let page = Html::parse_document(&html);
    Ok(RemoteMetadata {
        title: select_text(&page, "title").unwrap_or_else(|| target.host.to_string()),
        final_url: final_url.clone(),
        description: select_meta(&page, "description")
            .or_else(|| select_meta(&page, "og:description"))
            .unwrap_or_default(),
        source: "remote",
        candidates: select_icon_candidates(&page, &final_url),
    })
}

fn combined_metadata(
    target: &NormalizedSiteTarget,
    microlink: Option<&RemoteMetadata>,
    html: Option<&RemoteMetadata>,
) -> RemoteMetadata {
    let primary = microlink.or(html);
    RemoteMetadata {
        title: primary
            .map(|metadata| metadata.title.clone())
            .filter(|title| !title.trim().is_empty())
            .or_else(|| html.map(|metadata| metadata.title.clone()))
            .unwrap_or_else(|| target.host.clone()),
        final_url: primary
            .map(|metadata| metadata.final_url.clone())
            .filter(|url| !url.trim().is_empty())
            .unwrap_or_else(|| target.site_url.to_string()),
        description: primary
            .map(|metadata| metadata.description.clone())
            .filter(|description| !description.trim().is_empty())
            .or_else(|| html.map(|metadata| metadata.description.clone()))
            .unwrap_or_default(),
        source: primary.map(|metadata| metadata.source).unwrap_or("remote"),
        candidates: Vec::new(),
    }
}

fn extend_icon_candidates(
    candidates: &mut Vec<IconCandidate>,
    incoming: impl IntoIterator<Item = IconCandidate>,
) {
    for mut candidate in incoming {
        candidate.sort_order = candidates.len();
        push_unique_icon_candidate(candidates, candidate);
    }
}

async fn evaluate_icon_candidates(
    state: &MetaState,
    candidates: Vec<IconCandidate>,
) -> CandidateEvaluation {
    let candidates = ordered_icon_candidates(candidates);
    if candidates.is_empty() {
        return CandidateEvaluation {
            best: None,
            failure: Some(FetchFailure::no_icon(
                "icon_candidates_empty",
                "no icon candidates found",
            )),
        };
    }

    let mut evaluation = CandidateEvaluation::default();
    for chunk in candidates.chunks(ICON_CANDIDATE_CONCURRENCY) {
        let mut handles = Vec::with_capacity(chunk.len());
        for candidate in chunk {
            let state = state.clone();
            let candidate = candidate.clone();
            handles.push(tokio::spawn(async move {
                fetch_icon_candidate(state, candidate).await
            }));
        }
        for handle in handles {
            match handle.await {
                Ok(Ok(downloaded)) => {
                    evaluation.best = Some(match evaluation.best.take() {
                        Some(existing)
                            if existing.quality_score > downloaded.quality_score
                                || (existing.quality_score == downloaded.quality_score
                                    && existing.candidate.sort_order
                                        <= downloaded.candidate.sort_order) =>
                        {
                            existing
                        }
                        _ => downloaded,
                    });
                }
                Ok(Err(err)) => {
                    tracing::debug!(
                        status = %err.status,
                        error = %err.message,
                        "failed to cache remote icon candidate"
                    );
                    evaluation.failure = Some(select_stronger_failure(evaluation.failure, err));
                }
                Err(err) => {
                    evaluation.failure = Some(select_stronger_failure(
                        evaluation.failure,
                        FetchFailure::temporary("icon_candidate_task_failed", err.to_string()),
                    ));
                }
            }
        }
    }
    evaluation
}

fn choose_better_evaluation(
    current: CandidateEvaluation,
    candidate: CandidateEvaluation,
) -> CandidateEvaluation {
    match (current.best, candidate.best) {
        (Some(current_best), Some(candidate_best)) => {
            let best = if candidate_best.quality_score > current_best.quality_score {
                candidate_best
            } else {
                current_best
            };
            CandidateEvaluation {
                best: Some(best),
                failure: current.failure.or(candidate.failure),
            }
        }
        (None, Some(best)) => CandidateEvaluation {
            best: Some(best),
            failure: current.failure.or(candidate.failure),
        },
        (best, None) => CandidateEvaluation {
            best,
            failure: current.failure.or(candidate.failure),
        },
    }
}

fn ordered_icon_candidates(mut candidates: Vec<IconCandidate>) -> Vec<IconCandidate> {
    candidates.sort_by(|left, right| {
        candidate_pre_score(right)
            .cmp(&candidate_pre_score(left))
            .then_with(|| left.sort_order.cmp(&right.sort_order))
    });
    candidates.truncate(MAX_ICON_CANDIDATES_TO_EVALUATE);
    candidates
}

async fn fetch_icon_candidate(
    state: MetaState,
    candidate: IconCandidate,
) -> Result<DownloadedIconCandidate, FetchFailure> {
    let icon_url = parse_http_url(&candidate.url)
        .ok_or_else(|| FetchFailure::no_icon("icon_not_found", "invalid icon url"))?;
    let response = fetch_icon_http_response(&state, icon_url).await?;
    if response.status.is_success() && is_text_html_content_type(&response.raw_content_type) {
        let body = String::from_utf8_lossy(&response.bytes);
        if !is_blocked_response(response.status, &response.headers, &body)
            && let Some(directory_candidate) =
                fallback_directory_icon_candidate(&candidate, &response.final_url, &body)
        {
            let directory_url = parse_http_url(&directory_candidate.url).ok_or_else(|| {
                FetchFailure::no_icon("icon_not_found", "invalid directory icon url")
            })?;
            let directory_response = fetch_icon_http_response(&state, directory_url).await?;
            return downloaded_icon_candidate_from_response(
                directory_candidate,
                directory_response,
            );
        }
    }
    downloaded_icon_candidate_from_response(candidate, response)
}

async fn fetch_icon_http_response(
    state: &MetaState,
    icon_url: Url,
) -> Result<IconHttpResponse, FetchFailure> {
    let response = state
        .http
        .get(icon_url)
        .send()
        .await
        .map_err(|err| FetchFailure::temporary("remote_icon_fetch_failed", err.to_string()))?;
    let status = response.status();
    let headers = response.headers().clone();
    let final_url = response.url().clone();
    let raw_content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| FetchFailure::temporary("remote_icon_body_read_failed", err.to_string()))?
        .to_vec();
    Ok(IconHttpResponse {
        status,
        headers,
        final_url,
        raw_content_type,
        bytes,
    })
}

fn downloaded_icon_candidate_from_response(
    candidate: IconCandidate,
    response: IconHttpResponse,
) -> Result<DownloadedIconCandidate, FetchFailure> {
    if !response.status.is_success() {
        let body = String::from_utf8_lossy(&response.bytes);
        return Err(classify_http_response(
            "remote_icon",
            response.status,
            &response.headers,
            &body,
        ));
    }
    if is_text_html_content_type(&response.raw_content_type) {
        let body = String::from_utf8_lossy(&response.bytes);
        if is_blocked_response(response.status, &response.headers, &body) {
            return Err(FetchFailure::blocked(
                "remote_icon_blocked",
                "icon blocked by anti-bot challenge",
            ));
        }
        return Err(FetchFailure::no_icon(
            "remote_icon_not_image",
            "icon candidate returned html",
        ));
    }
    let content_type = normalize_downloaded_icon_content_type(
        &response.raw_content_type,
        response.final_url.path(),
        &candidate.declared_type,
        &response.bytes,
    );
    if !is_supported_icon_content_type(&content_type) {
        return Err(FetchFailure::no_icon(
            "unsupported_icon_type",
            "icon candidate returned unsupported content type",
        ));
    }
    let (detected_width, detected_height) = detect_icon_dimensions(&content_type, &response.bytes);
    let quality_score = downloaded_icon_score(
        &candidate,
        &content_type,
        detected_width,
        detected_height,
        response.bytes.len(),
    );
    Ok(DownloadedIconCandidate {
        candidate,
        content_type,
        bytes: response.bytes,
        detected_width,
        detected_height,
        quality_score,
    })
}

async fn cache_downloaded_icon(
    state: &MetaState,
    host: &str,
    icon: &DownloadedIconCandidate,
) -> Result<String, FetchFailure> {
    let ext = extension_for_content_type(&icon.content_type).unwrap_or_else(|| {
        Path::new(&icon.candidate.url)
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| format!(".{value}"))
            .unwrap_or_else(|| ".ico".to_string())
    });
    let mut hasher = Sha256::new();
    hasher.update(host.as_bytes());
    hasher.update(&icon.bytes);
    let filename = format!("{:x}{ext}", hasher.finalize());
    let cache_dir = state.config.meta_server_data_dir.join("cache");
    fs::create_dir_all(&cache_dir)
        .await
        .map_err(|err| FetchFailure::temporary("cache_write_failed", err.to_string()))?;
    fs::write(cache_dir.join(&filename), &icon.bytes)
        .await
        .map_err(|err| FetchFailure::temporary("cache_write_failed", err.to_string()))?;
    Ok(format!("cache/{filename}"))
}

fn downloaded_icon_asset_record(url: &str, icon: &DownloadedIconCandidate) -> IconAssetRecord {
    let quality_refresh_after = if is_low_quality_icon(icon) {
        Utc::now().timestamp_millis() + QUALITY_REFRESH_RETRY_MS
    } else {
        0
    };
    IconAssetRecord {
        url: url.to_string(),
        content_type: icon.content_type.clone(),
        width: icon.detected_width.map(i64::from),
        height: icon.detected_height.map(i64::from),
        byte_size: icon.bytes.len() as i64,
        quality_score: i64::from(icon.quality_score),
        quality_checked_at: Utc::now().timestamp_millis(),
        quality_refresh_after,
    }
}

fn ok_record(
    host: &str,
    title: String,
    url: String,
    final_url: String,
    description: String,
    source: &str,
    icon: Option<String>,
    icon_asset: Option<IconAssetRecord>,
) -> IconRecord {
    IconRecord {
        host: host.to_string(),
        title,
        url,
        final_url,
        description,
        background_color: String::new(),
        icon,
        icon_asset,
        source: source.to_string(),
        fetch_status: FETCH_STATUS_OK.to_string(),
        failure_kind: String::new(),
        failure_count: 0,
        retry_after: 0,
        last_error: String::new(),
        fetched_at: Utc::now(),
    }
}

fn failure_record(
    target: &NormalizedSiteTarget,
    source: &str,
    title: String,
    final_url: String,
    description: String,
    previous: Option<&IconRecord>,
    failure: FetchFailure,
) -> IconRecord {
    let previous_count = previous
        .filter(|record| record.fetch_status == failure.status)
        .map(|record| record.failure_count)
        .unwrap_or(0);
    let failure_count = if failure.status == FETCH_STATUS_ERROR {
        previous_count + 1
    } else {
        0
    };
    IconRecord {
        host: target.host.clone(),
        title,
        url: target.site_url.to_string(),
        final_url,
        description,
        background_color: String::new(),
        icon: None,
        icon_asset: None,
        source: source.to_string(),
        fetch_status: failure.status.to_string(),
        failure_kind: failure.kind,
        failure_count,
        retry_after: retry_after_for_failure(failure.status, failure_count),
        last_error: failure.message,
        fetched_at: Utc::now(),
    }
}

fn retry_after_for_failure(status: &str, failure_count: i64) -> i64 {
    match status {
        FETCH_STATUS_NO_ICON => Utc::now().timestamp_millis() + NO_ICON_TTL_MS,
        FETCH_STATUS_ERROR => {
            let exponent = failure_count.saturating_sub(1).min(30) as u32;
            let ttl = ERROR_INITIAL_RETRY_MS
                .saturating_mul(2_i64.saturating_pow(exponent))
                .min(ERROR_MAX_RETRY_MS);
            Utc::now().timestamp_millis() + ttl
        }
        _ => 0,
    }
}

async fn prepare_cached_record_quality(
    state: &MetaState,
    record: IconRecord,
) -> Result<IconRecord, IconError> {
    if record.fetch_status != FETCH_STATUS_OK
        || record
            .icon_asset
            .as_ref()
            .is_some_and(|asset| asset.quality_checked_at > 0)
    {
        return Ok(record);
    }
    let Some(icon) = record.icon.clone() else {
        return Ok(record);
    };
    let Some(path) = resolve_local_icon(state, &icon) else {
        return Ok(record);
    };
    let mut updated = record;
    let asset = match fs::read(&path).await {
        Ok(bytes) => cached_icon_asset_record(&icon, &path, &bytes),
        Err(err) => {
            tracing::warn!(
                icon = %icon,
                path = %path.display(),
                error = %err,
                "failed to read cached icon for quality backfill"
            );
            IconAssetRecord {
                url: icon.to_string(),
                content_type: updated
                    .icon_asset
                    .as_ref()
                    .map(|asset| asset.content_type.clone())
                    .unwrap_or_default(),
                width: None,
                height: None,
                byte_size: 0,
                quality_score: 0,
                quality_checked_at: Utc::now().timestamp_millis(),
                quality_refresh_after: 0,
            }
        }
    };
    updated.icon_asset = Some(asset);
    upsert_icon_record(&state.pool, &updated).await?;
    Ok(updated)
}

fn cached_icon_asset_record(icon: &str, path: &Path, bytes: &[u8]) -> IconAssetRecord {
    let path_hint = path.to_string_lossy();
    let content_type =
        normalize_downloaded_icon_content_type("application/octet-stream", &path_hint, "", bytes);
    let (width, height) = detect_icon_dimensions(&content_type, bytes);
    let candidate = IconCandidate {
        url: icon.to_string(),
        source: "cached",
        rel: "cached-icon".to_string(),
        declared_type: content_type.clone(),
        declared_width: None,
        declared_height: None,
        sizes: String::new(),
        sort_order: 0,
    };
    let quality_score =
        downloaded_icon_score(&candidate, &content_type, width, height, bytes.len());
    IconAssetRecord {
        url: icon.to_string(),
        content_type,
        width: width.map(i64::from),
        height: height.map(i64::from),
        byte_size: bytes.len() as i64,
        quality_score: i64::from(quality_score),
        quality_checked_at: Utc::now().timestamp_millis(),
        quality_refresh_after: 0,
    }
}

async fn defer_cached_quality_refresh(
    state: &MetaState,
    mut record: IconRecord,
) -> Result<IconRecord, IconError> {
    if let Some(asset) = record.icon_asset.as_mut() {
        asset.quality_refresh_after = Utc::now().timestamp_millis() + QUALITY_REFRESH_RETRY_MS;
    }
    upsert_icon_record(&state.pool, &record).await?;
    Ok(record)
}

fn should_refresh_record(state: &MetaState, record: &IconRecord) -> bool {
    if record
        .icon
        .as_deref()
        .map(|icon| local_icon_reference_missing(state, icon))
        .unwrap_or(false)
    {
        return true;
    }
    match record.fetch_status.as_str() {
        FETCH_STATUS_OK => {
            if record.source == "seed" {
                return false;
            }
            if record.icon.is_none() {
                return true;
            }
            cached_record_is_low_quality(record) && quality_refresh_due(record)
        }
        FETCH_STATUS_BLOCKED => false,
        FETCH_STATUS_NO_ICON | FETCH_STATUS_ERROR => {
            record.retry_after <= 0 || Utc::now().timestamp_millis() >= record.retry_after
        }
        _ => true,
    }
}

fn cached_record_is_low_quality(record: &IconRecord) -> bool {
    let Some(asset) = record.icon_asset.as_ref() else {
        return false;
    };
    if asset.quality_checked_at <= 0 {
        return false;
    }
    if asset
        .width
        .zip(asset.height)
        .is_some_and(|(width, height)| width.min(height) < 32)
    {
        return true;
    }
    asset.quality_score < i64::from(ACCEPTABLE_ICON_QUALITY_SCORE)
}

fn quality_refresh_due(record: &IconRecord) -> bool {
    record
        .icon_asset
        .as_ref()
        .map(|asset| {
            asset.quality_refresh_after <= 0
                || Utc::now().timestamp_millis() >= asset.quality_refresh_after
        })
        .unwrap_or(false)
}

fn local_icon_reference_missing(state: &MetaState, icon: &str) -> bool {
    let trimmed = normalize_local_icon_reference(icon);
    is_local_icon_reference(&trimmed)
        && parse_http_url(&trimmed).is_none()
        && resolve_local_icon(state, icon).is_none()
}

fn icon_record_missing_error(record: &IconRecord) -> IconError {
    if record.fetch_status == FETCH_STATUS_ERROR {
        IconError::bad_gateway(if record.last_error.trim().is_empty() {
            "icon_fetch_failed"
        } else {
            record.last_error.as_str()
        })
    } else {
        IconError::not_found("icon_not_found")
    }
}

fn select_stronger_failure(current: Option<FetchFailure>, candidate: FetchFailure) -> FetchFailure {
    match current {
        Some(existing) if existing.priority() >= candidate.priority() => existing,
        _ => candidate,
    }
}

fn icon_response_data(state: &MetaState, record: &IconRecord) -> Value {
    let icon_url = public_site_icon_url(state, record);
    json!({
        "url": null_if_empty(&record.url),
        "finalUrl": null_if_empty(&record.final_url),
        "title": null_if_empty(&record.title),
        "name": null_if_empty(&record.title),
        "icon": icon_url.clone(),
        "iconUrl": icon_url,
        "description": null_if_empty(&record.description),
        "backgroundColor": null_if_empty(&record.background_color),
        "fetchedAt": record.fetched_at.to_rfc3339(),
        "fetchStatus": &record.fetch_status,
        "failureKind": null_if_empty(&record.failure_kind),
        "retryAfter": retry_after_json(record.retry_after)
    })
}

fn microlink_data_payload(payload: &Value) -> Option<&Value> {
    payload
        .get("data")
        .filter(|value| value.is_object())
        .or_else(|| payload.is_object().then_some(payload))
}

fn microlink_failed(payload: &Value) -> bool {
    if let Some(status) = payload.get("status").and_then(Value::as_str)
        && !status.eq_ignore_ascii_case("success")
    {
        return true;
    }
    payload
        .get("statusCode")
        .and_then(Value::as_i64)
        .map(|status| status >= 400)
        .unwrap_or(false)
}

fn classify_http_response(
    prefix: &str,
    status: StatusCode,
    headers: &reqwest::header::HeaderMap,
    body: &str,
) -> FetchFailure {
    if is_blocked_response(status, headers, body) {
        return FetchFailure::blocked(
            format!("{prefix}_blocked"),
            format!("{prefix} blocked by anti-bot challenge"),
        );
    }
    classify_http_status(prefix, status)
}

fn classify_http_status(prefix: &str, status: StatusCode) -> FetchFailure {
    let kind = format!("{prefix}_http_{}", status.as_u16());
    if matches!(status.as_u16(), 401 | 403 | 407 | 409 | 423 | 451) {
        return FetchFailure::blocked(kind, format!("{prefix}_blocked"));
    }
    if status.as_u16() == 404 || status.as_u16() == 410 {
        return FetchFailure::no_icon(kind, format!("{prefix}_not_found"));
    }
    if status.is_server_error() || matches!(status.as_u16(), 408 | 429) {
        return FetchFailure::temporary(kind, format!("{prefix}_temporary_failure"));
    }
    FetchFailure::no_icon(kind, format!("{prefix}_not_available"))
}

fn is_blocked_response(
    status: StatusCode,
    headers: &reqwest::header::HeaderMap,
    body: &str,
) -> bool {
    let cf_header = headers.contains_key("cf-ray")
        || headers.contains_key("cf-mitigated")
        || headers
            .get(header::SERVER)
            .and_then(|value| value.to_str().ok())
            .map(|value| value.to_ascii_lowercase().contains("cloudflare"))
            .unwrap_or(false);
    let body = body.to_ascii_lowercase();
    let challenge_body = body.contains("just a moment")
        || body.contains("/cdn-cgi/challenge-platform")
        || body.contains("cf-chl")
        || body.contains("turnstile")
        || body.contains("captcha");
    (cf_header && matches!(status.as_u16(), 403 | 429 | 503)) || challenge_body
}

fn is_text_html_content_type(content_type: &str) -> bool {
    content_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .eq_ignore_ascii_case("text/html")
}

fn is_supported_icon_content_type(content_type: &str) -> bool {
    let essence = content_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    essence.is_empty()
        || essence == "application/octet-stream"
        || essence == "binary/octet-stream"
        || essence.starts_with("image/")
}

fn normalize_downloaded_icon_content_type(
    raw_content_type: &str,
    path: &str,
    declared_type: &str,
    bytes: &[u8],
) -> String {
    let essence = raw_content_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    if essence.starts_with("image/") {
        return essence;
    }
    if let Some(sniffed) = sniff_icon_content_type(bytes) {
        return sniffed;
    }
    let declared = normalize_declared_icon_type(declared_type);
    if !declared.is_empty() {
        return declared;
    }
    mime_guess::from_path(path)
        .first_raw()
        .map(ToString::to_string)
        .unwrap_or_else(|| essence)
}

fn normalize_declared_icon_type(value: &str) -> String {
    let trimmed = value
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    if trimmed.is_empty() {
        String::new()
    } else if trimmed.contains('/') {
        trimmed
    } else {
        match trimmed.as_str() {
            "ico" => "image/x-icon".to_string(),
            "jpg" | "jpeg" => "image/jpeg".to_string(),
            "svg" => "image/svg+xml".to_string(),
            "png" | "webp" | "gif" => format!("image/{trimmed}"),
            _ => trimmed,
        }
    }
}

fn sniff_icon_content_type(bytes: &[u8]) -> Option<String> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some("image/png".to_string());
    }
    if bytes.starts_with(b"\0\0\x01\0") || bytes.starts_with(b"\0\0\x02\0") {
        return Some("image/x-icon".to_string());
    }
    if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        return Some("image/webp".to_string());
    }
    let prefix = String::from_utf8_lossy(bytes.get(..bytes.len().min(256)).unwrap_or_default())
        .to_ascii_lowercase();
    if prefix.contains("<svg") {
        return Some("image/svg+xml".to_string());
    }
    None
}

fn detect_icon_dimensions(content_type: &str, bytes: &[u8]) -> (Option<u32>, Option<u32>) {
    let essence = content_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    if essence == "image/png" {
        return detect_png_dimensions(bytes);
    }
    if matches!(
        essence.as_str(),
        "image/x-icon" | "image/vnd.microsoft.icon"
    ) {
        return detect_ico_dimensions(bytes);
    }
    if essence == "image/svg+xml" {
        return detect_svg_dimensions(bytes);
    }
    (None, None)
}

fn detect_png_dimensions(bytes: &[u8]) -> (Option<u32>, Option<u32>) {
    if bytes.len() < 24 || !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return (None, None);
    }
    let width = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
    let height = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);
    positive_dimensions(width, height)
}

fn detect_ico_dimensions(bytes: &[u8]) -> (Option<u32>, Option<u32>) {
    if bytes.len() < 8 || (!bytes.starts_with(b"\0\0\x01\0") && !bytes.starts_with(b"\0\0\x02\0")) {
        return (None, None);
    }
    let count = u16::from_le_bytes([bytes[4], bytes[5]]) as usize;
    if count == 0 || bytes.len() < 6 + count * 16 {
        return (None, None);
    }
    let mut best = (0_u32, 0_u32);
    for index in 0..count {
        let offset = 6 + index * 16;
        let width = if bytes[offset] == 0 {
            256
        } else {
            bytes[offset] as u32
        };
        let height = if bytes[offset + 1] == 0 {
            256
        } else {
            bytes[offset + 1] as u32
        };
        if width.saturating_mul(height) > best.0.saturating_mul(best.1) {
            best = (width, height);
        }
    }
    positive_dimensions(best.0, best.1)
}

fn detect_svg_dimensions(bytes: &[u8]) -> (Option<u32>, Option<u32>) {
    let Ok(text) = std::str::from_utf8(bytes) else {
        return (None, None);
    };
    let lower = text.to_ascii_lowercase();
    let Some(start) = lower.find("<svg") else {
        return (None, None);
    };
    let Some(end) = lower[start..].find('>').map(|offset| start + offset) else {
        return (None, None);
    };
    let tag = &text[start..=end];
    let width = svg_attr(tag, "width").and_then(parse_svg_dimension_value);
    let height = svg_attr(tag, "height").and_then(parse_svg_dimension_value);
    if width.is_some() && height.is_some() {
        return (width, height);
    }
    svg_attr(tag, "viewBox")
        .or_else(|| svg_attr(tag, "viewbox"))
        .and_then(|value| {
            let parts = value
                .split(|ch: char| ch.is_ascii_whitespace() || ch == ',')
                .filter(|part| !part.is_empty())
                .filter_map(|part| part.parse::<f32>().ok())
                .collect::<Vec<_>>();
            (parts.len() == 4).then(|| {
                (
                    positive_rounded_dimension(parts[2]),
                    positive_rounded_dimension(parts[3]),
                )
            })
        })
        .unwrap_or((width, height))
}

fn svg_attr<'a>(tag: &'a str, attr: &str) -> Option<&'a str> {
    for quote in ['"', '\''] {
        let pattern = format!("{attr}={quote}");
        if let Some(start) = tag.find(&pattern) {
            let value_start = start + pattern.len();
            if let Some(end) = tag[value_start..].find(quote) {
                return Some(&tag[value_start..value_start + end]);
            }
        }
    }
    None
}

fn parse_svg_dimension_value(value: &str) -> Option<u32> {
    let number = value
        .trim()
        .trim_end_matches("px")
        .split(|ch: char| ch.is_ascii_whitespace())
        .next()
        .unwrap_or_default()
        .parse::<f32>()
        .ok()?;
    positive_rounded_dimension(number)
}

fn positive_dimensions(width: u32, height: u32) -> (Option<u32>, Option<u32>) {
    ((width > 0).then_some(width), (height > 0).then_some(height))
}

fn positive_rounded_dimension(value: f32) -> Option<u32> {
    (value.is_finite() && value > 0.0).then(|| value.round() as u32)
}

fn numeric_u32(value: Option<&Value>) -> Option<u32> {
    match value {
        Some(Value::Number(number)) => number.as_u64().and_then(|value| u32::try_from(value).ok()),
        Some(Value::String(value)) => value.trim().parse::<u32>().ok(),
        _ => None,
    }
}

fn candidate_pre_score(candidate: &IconCandidate) -> i32 {
    let mut score = source_score(candidate.source)
        + rel_score(&candidate.rel)
        + content_type_score(&candidate.declared_type)
        + dimension_score(candidate.declared_width, candidate.declared_height);
    if candidate.url.to_ascii_lowercase().ends_with("/favicon.ico") {
        score -= 25;
    }
    score
}

fn downloaded_icon_score(
    candidate: &IconCandidate,
    content_type: &str,
    detected_width: Option<u32>,
    detected_height: Option<u32>,
    byte_size: usize,
) -> i32 {
    let width = detected_width.or(candidate.declared_width);
    let height = detected_height.or(candidate.declared_height);
    let mut score = candidate_pre_score(candidate)
        + content_type_score(content_type)
        + dimension_score(width, height);
    if byte_size > 0 {
        score += 5;
    }
    if is_icon_content_type(content_type) && width.zip(height).is_some_and(|(w, h)| w.min(h) < 32) {
        score -= 50;
    }
    score
}

fn is_low_quality_icon(icon: &DownloadedIconCandidate) -> bool {
    let width = icon.detected_width.or(icon.candidate.declared_width);
    let height = icon.detected_height.or(icon.candidate.declared_height);
    if width.zip(height).is_some_and(|(w, h)| w.min(h) < 32) {
        return true;
    }
    icon.quality_score < ACCEPTABLE_ICON_QUALITY_SCORE
}

fn source_score(source: &str) -> i32 {
    match source {
        "microlink" | "microlink_force" => 30,
        "html" => 20,
        "fallback" => 0,
        _ => 0,
    }
}

fn rel_score(rel: &str) -> i32 {
    let rel = rel.to_ascii_lowercase();
    if rel.contains("apple-touch-icon") {
        90
    } else if rel.contains("icon") {
        35
    } else {
        0
    }
}

fn content_type_score(content_type: &str) -> i32 {
    match normalize_declared_icon_type(content_type).as_str() {
        "image/svg+xml" => 70,
        "image/png" | "image/webp" => 55,
        "image/jpeg" | "image/gif" => 35,
        "image/x-icon" | "image/vnd.microsoft.icon" => 5,
        "" | "application/octet-stream" | "binary/octet-stream" => 0,
        value if value.starts_with("image/") => 25,
        _ => -50,
    }
}

fn dimension_score(width: Option<u32>, height: Option<u32>) -> i32 {
    let Some((width, height)) = width.zip(height) else {
        return 0;
    };
    let min = width.min(height);
    if min >= 128 {
        90
    } else if min >= 64 {
        70
    } else if min >= 32 {
        35
    } else if min > 0 {
        -120
    } else {
        0
    }
}

fn is_icon_content_type(content_type: &str) -> bool {
    matches!(
        normalize_declared_icon_type(content_type).as_str(),
        "image/x-icon" | "image/vnd.microsoft.icon"
    )
}

fn retry_after_json(value: i64) -> Value {
    if value <= 0 {
        return Value::Null;
    }
    chrono::DateTime::<Utc>::from_timestamp_millis(value)
        .map(|date| Value::String(date.to_rfc3339()))
        .unwrap_or(Value::Null)
}

fn string_value(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn nested_string(value: &Value, path: &[&str]) -> Option<String> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn normalize_query_target(
    query: &HashMap<String, String>,
    keys: &[&str],
    missing_error: &str,
    invalid_error: &str,
) -> Result<NormalizedSiteTarget, IconError> {
    let raw = keys
        .iter()
        .find_map(|key| query.get(*key))
        .ok_or_else(|| IconError::bad_request(missing_error))?;
    normalize_site_target(raw).ok_or_else(|| IconError::bad_request(invalid_error))
}

fn normalize_site_target(raw: &str) -> Option<NormalizedSiteTarget> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }

    let mut input_url = parse_http_url(raw).or_else(|| {
        if let Ok(parsed) = Url::parse(raw) {
            let scheme = parsed.scheme().to_ascii_lowercase();
            if raw.contains("://")
                || matches!(
                    scheme.as_str(),
                    "about" | "data" | "file" | "javascript" | "mailto"
                )
            {
                return None;
            }
        }
        let candidate = if raw.starts_with("//") {
            format!("https:{raw}")
        } else {
            format!("https://{raw}")
        };
        parse_http_url(&candidate)
    })?;
    input_url.set_fragment(None);
    let host = input_url.host_str()?.to_ascii_lowercase();
    let mut site_url = input_url.clone();
    site_url.set_path("/");
    site_url.set_query(None);
    site_url.set_fragment(None);
    Some(NormalizedSiteTarget {
        input_url,
        site_url,
        host,
    })
}

fn parse_http_url(raw: &str) -> Option<Url> {
    let url = Url::parse(raw.trim()).ok()?;
    if matches!(url.scheme(), "http" | "https") && url.host_str().is_some() {
        Some(url)
    } else {
        None
    }
}

fn select_text(page: &Html, selector: &str) -> Option<String> {
    let selector = Selector::parse(selector).ok()?;
    page.select(&selector)
        .next()
        .map(|node| node.text().collect::<String>().trim().to_string())
        .filter(|value| !value.is_empty())
}

fn select_meta(page: &Html, name: &str) -> Option<String> {
    for selector in [
        format!("meta[name=\"{name}\"]"),
        format!("meta[property=\"{name}\"]"),
    ] {
        let selector = Selector::parse(&selector).ok()?;
        if let Some(value) = page
            .select(&selector)
            .next()
            .and_then(|node| node.value().attr("content"))
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return Some(value.to_string());
        }
    }
    None
}

fn select_icon_candidates(page: &Html, final_url: &str) -> Vec<IconCandidate> {
    let mut candidates = Vec::new();
    let Some(base) = parse_http_url(final_url) else {
        return candidates;
    };
    let Ok(selector) = Selector::parse("link[rel]") else {
        return candidates;
    };
    for node in page.select(&selector) {
        let rel = node
            .value()
            .attr("rel")
            .unwrap_or_default()
            .to_ascii_lowercase();
        if !rel.contains("icon") {
            continue;
        }
        let Some(href) = node
            .value()
            .attr("href")
            .map(str::trim)
            .filter(|href| !href.is_empty())
        else {
            continue;
        };
        if let Ok(url) = base.join(href)
            && parse_http_url(url.as_str()).is_some()
        {
            let sort_order = candidates.len();
            let sizes = node
                .value()
                .attr("sizes")
                .map(str::trim)
                .unwrap_or_default()
                .to_string();
            let (declared_width, declared_height) = dimensions_from_sizes(&sizes);
            push_unique_icon_candidate(
                &mut candidates,
                IconCandidate {
                    url: url.to_string(),
                    source: "html",
                    rel,
                    declared_type: node
                        .value()
                        .attr("type")
                        .map(str::trim)
                        .unwrap_or_default()
                        .to_string(),
                    declared_width,
                    declared_height,
                    sizes,
                    sort_order,
                },
            );
        }
    }
    extend_icon_candidates(&mut candidates, root_favicon_candidates(&base));
    candidates
}

fn root_favicon_candidates(base: &Url) -> Vec<IconCandidate> {
    let Some(url) = base
        .join("/favicon.ico")
        .ok()
        .filter(|url| parse_http_url(url.as_str()).is_some())
    else {
        return Vec::new();
    };
    vec![IconCandidate {
        url: url.to_string(),
        source: "fallback",
        rel: "icon".to_string(),
        declared_type: "image/x-icon".to_string(),
        declared_width: None,
        declared_height: None,
        sizes: String::new(),
        sort_order: 0,
    }]
}

fn fallback_directory_icon_candidate(
    candidate: &IconCandidate,
    final_url: &Url,
    body: &str,
) -> Option<IconCandidate> {
    if candidate.source != "fallback" {
        return None;
    }
    let original_path = parse_http_url(&candidate.url)?
        .path()
        .trim_end_matches('/')
        .to_string();
    if !original_path.ends_with("/favicon.ico")
        || final_url.path().trim_end_matches('/') != original_path
    {
        return None;
    }
    let page = Html::parse_document(body);
    let selector = Selector::parse("a[href]").ok()?;
    for node in page.select(&selector) {
        let Some(href) = node.value().attr("href").map(str::trim) else {
            continue;
        };
        let Some(declared_type) = declared_icon_type_from_href(href) else {
            continue;
        };
        let Ok(url) = final_url.join(href) else {
            continue;
        };
        if parse_http_url(url.as_str()).is_none() {
            continue;
        }
        return Some(IconCandidate {
            url: url.to_string(),
            source: "fallback",
            rel: "icon".to_string(),
            declared_type: declared_type.to_string(),
            declared_width: None,
            declared_height: None,
            sizes: String::new(),
            sort_order: candidate.sort_order,
        });
    }
    None
}

fn declared_icon_type_from_href(href: &str) -> Option<&'static str> {
    let path = href
        .split(['?', '#'])
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    match Path::new(&path)
        .extension()
        .and_then(|value| value.to_str())
    {
        Some("ico") => Some("image/x-icon"),
        Some("png") => Some("image/png"),
        Some("svg") => Some("image/svg+xml"),
        Some("webp") => Some("image/webp"),
        Some("jpg" | "jpeg") => Some("image/jpeg"),
        Some("gif") => Some("image/gif"),
        _ => None,
    }
}

fn push_unique_icon_candidate(candidates: &mut Vec<IconCandidate>, candidate: IconCandidate) {
    if let Some(existing) = candidates.iter_mut().find(|icon| icon.url == candidate.url) {
        if candidate_pre_score(&candidate) > candidate_pre_score(existing) {
            let sort_order = existing.sort_order.min(candidate.sort_order);
            *existing = candidate;
            existing.sort_order = sort_order;
        } else {
            if existing.declared_width.is_none() {
                existing.declared_width = candidate.declared_width;
            }
            if existing.declared_height.is_none() {
                existing.declared_height = candidate.declared_height;
            }
            if existing.declared_type.is_empty() {
                existing.declared_type = candidate.declared_type;
            }
            if existing.sizes.is_empty() {
                existing.sizes = candidate.sizes;
            }
        }
    } else {
        candidates.push(candidate);
    }
}

fn dimensions_from_sizes(sizes: &str) -> (Option<u32>, Option<u32>) {
    sizes
        .split_whitespace()
        .find_map(|part| {
            let (width, height) = part.split_once('x').or_else(|| part.split_once('X'))?;
            Some((
                width.trim().parse::<u32>().ok(),
                height.trim().parse::<u32>().ok(),
            ))
        })
        .unwrap_or((None, None))
}

fn public_site_icon_url(state: &MetaState, record: &IconRecord) -> Option<String> {
    record.icon.as_deref()?;
    let site_url = normalize_site_target(&record.url)
        .or_else(|| normalize_site_target(&record.host))?
        .site_url
        .to_string();
    let parsed =
        Url::parse_with_params("http://startdeck.local/api/site/icon", [("url", site_url)]).ok()?;
    let icon = format!("/api/site/icon?{}", parsed.query()?);
    if state.public_meta_base_url.is_empty() {
        Some(icon)
    } else {
        Some(format!(
            "{}{}",
            state.public_meta_base_url.trim_end_matches('/'),
            icon
        ))
    }
}

fn resolve_local_icon(state: &MetaState, icon: &str) -> Option<PathBuf> {
    let trimmed = normalize_local_icon_reference(icon);
    if !is_local_icon_reference(&trimmed) {
        return None;
    }
    let candidates = if let Some(name) = trimmed.strip_prefix("icons/") {
        vec![
            state.config.meta_server_data_dir.join("icons").join(name),
            state
                .config
                .meta_server_resource_dir
                .join("icons")
                .join(name),
        ]
    } else if let Some(name) = trimmed.strip_prefix("cache/") {
        vec![state.config.meta_server_data_dir.join("cache").join(name)]
    } else if !trimmed.contains("://") {
        vec![
            state
                .config
                .meta_server_data_dir
                .join("icons")
                .join(&trimmed),
            state
                .config
                .meta_server_resource_dir
                .join("icons")
                .join(trimmed),
        ]
    } else {
        return None;
    };
    candidates.into_iter().find(|path| path.exists())
}

fn is_local_icon_reference(icon: &str) -> bool {
    let trimmed = icon.trim();
    if trimmed.is_empty()
        || trimmed.contains("://")
        || trimmed.contains(':')
        || trimmed.contains('\\')
    {
        return false;
    }
    let path = Path::new(trimmed);
    !path.is_absolute()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

fn normalize_local_icon_reference(icon: &str) -> String {
    let trimmed = icon.trim().trim_start_matches('/');
    if let Some(name) = trimmed.strip_prefix("data/icons/") {
        format!("icons/{name}")
    } else if let Some(name) = trimmed.strip_prefix("data/cache/") {
        format!("cache/{name}")
    } else {
        trimmed.to_string()
    }
}

fn bytes_response(bytes: Vec<u8>, content_type: &str) -> Response {
    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    response
}

fn extension_for_content_type(content_type: &str) -> Option<String> {
    match content_type.split(';').next().unwrap_or_default().trim() {
        "image/png" => Some(".png".to_string()),
        "image/jpeg" => Some(".jpg".to_string()),
        "image/gif" => Some(".gif".to_string()),
        "image/webp" => Some(".webp".to_string()),
        "image/svg+xml" => Some(".svg".to_string()),
        "image/x-icon" | "image/vnd.microsoft.icon" => Some(".ico".to_string()),
        _ => None,
    }
}

fn null_if_empty(value: &str) -> Value {
    if value.trim().is_empty() {
        Value::Null
    } else {
        Value::String(value.to_string())
    }
}

fn empty_to_null(value: &str) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

#[derive(Debug)]
pub struct IconError {
    status: StatusCode,
    message: String,
}

impl IconError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }

    fn bad_gateway(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            message: message.into(),
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: message.into(),
        }
    }
}

impl IntoResponse for IconError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({"code": self.status.as_u16(), "msg": self.message})),
        )
            .into_response()
    }
}

impl From<sqlx::Error> for IconError {
    fn from(value: sqlx::Error) -> Self {
        IconError::internal(value.to_string())
    }
}

impl From<anyhow::Error> for IconError {
    fn from(value: anyhow::Error) -> Self {
        IconError::internal(value.to_string())
    }
}

impl From<std::io::Error> for IconError {
    fn from(value: std::io::Error) -> Self {
        IconError::internal(value.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate_urls(candidates: &[IconCandidate]) -> Vec<String> {
        candidates
            .iter()
            .map(|candidate| candidate.url.clone())
            .collect()
    }

    fn test_candidate(
        source: &'static str,
        rel: &str,
        content_type: &str,
        width: Option<u32>,
        height: Option<u32>,
    ) -> IconCandidate {
        IconCandidate {
            url: format!("https://example.com/{source}.ico"),
            source,
            rel: rel.to_string(),
            declared_type: content_type.to_string(),
            declared_width: width,
            declared_height: height,
            sizes: String::new(),
            sort_order: 0,
        }
    }

    #[test]
    fn meta_server_timeout_uses_millisecond_configuration() {
        assert_eq!(
            meta_server_timeout_from_value(Some("5000".to_string())),
            Duration::from_millis(5_000)
        );
        assert_eq!(
            meta_server_timeout_from_value(Some("0".to_string())),
            Duration::from_millis(DEFAULT_META_SERVER_TIMEOUT_MS)
        );
        assert_eq!(
            meta_server_timeout_from_value(Some("invalid".to_string())),
            Duration::from_millis(DEFAULT_META_SERVER_TIMEOUT_MS)
        );
    }

    #[test]
    fn icon_candidates_skip_dynamic_placeholder_and_keep_fallback() {
        let page = Html::parse_document(
            r#"<html><head>
                <link rel="shortcut icon" type="image/png" href="about:blank">
            </head></html>"#,
        );

        let candidates = select_icon_candidates(&page, "https://example.com/tools/editor");
        assert_eq!(
            candidate_urls(&candidates),
            vec!["https://example.com/favicon.ico".to_string()]
        );
        assert_eq!(candidates[0].source, "fallback");
    }

    #[test]
    fn icon_candidates_keep_only_fetchable_http_urls() {
        let page = Html::parse_document(
            r#"<html><head>
                <link rel="icon" href="data:image/png;base64,AAAA">
                <link rel="icon" href="/assets/favicon.svg">
                <link rel="apple-touch-icon" href="https://cdn.example.com/touch.png">
                <link rel="icon" href="/assets/favicon.svg">
                <link rel="mask-icon" href="javascript:void(0)">
            </head></html>"#,
        );

        let candidates = select_icon_candidates(&page, "https://example.com/app/");
        assert_eq!(
            candidate_urls(&candidates),
            vec![
                "https://example.com/assets/favicon.svg".to_string(),
                "https://cdn.example.com/touch.png".to_string(),
                "https://example.com/favicon.ico".to_string(),
            ]
        );
        assert_eq!(candidates[1].rel, "apple-touch-icon");
    }

    #[test]
    fn apple_touch_candidate_preserves_metadata_and_scores_above_low_res_ico() {
        let page = Html::parse_document(
            r#"<html><head>
                <link rel="apple-touch-icon-precomposed" type="image/png" sizes="114x114" href="/touch.png">
                <link rel="icon" type="image/x-icon" sizes="16x16" href="/favicon.ico">
            </head></html>"#,
        );
        let candidates = select_icon_candidates(&page, "https://example.com/");
        let touch = candidates
            .iter()
            .find(|candidate| candidate.url.ends_with("/touch.png"))
            .unwrap();
        let ico = test_candidate("microlink", "microlink-logo", "ico", Some(16), Some(16));

        assert_eq!(touch.rel, "apple-touch-icon-precomposed");
        assert_eq!(touch.declared_type, "image/png");
        assert_eq!(touch.declared_width, Some(114));
        assert_eq!(touch.declared_height, Some(114));
        assert!(
            downloaded_icon_score(touch, "image/png", Some(114), Some(114), 4540)
                > downloaded_icon_score(&ico, "image/x-icon", Some(16), Some(16), 1150)
        );
    }

    #[test]
    fn high_quality_microlink_logo_is_not_low_quality() {
        let candidate = test_candidate("microlink", "microlink-logo", "png", Some(64), Some(64));
        let icon = DownloadedIconCandidate {
            quality_score: downloaded_icon_score(&candidate, "image/png", Some(64), Some(64), 4096),
            candidate,
            content_type: "image/png".to_string(),
            bytes: Vec::new(),
            detected_width: Some(64),
            detected_height: Some(64),
        };

        assert!(!is_low_quality_icon(&icon));
    }

    #[test]
    fn local_icon_references_reject_pseudo_schemes_and_path_escape() {
        assert!(is_local_icon_reference("icons/www.youtube.com.svg"));
        assert!(is_local_icon_reference(
            "Bilibili_A+哔哩哔哩+bilibili.com.png"
        ));
        assert!(!is_local_icon_reference("about:blank"));
        assert!(!is_local_icon_reference("data:image/png;base64,AAAA"));
        assert!(!is_local_icon_reference("../secret.svg"));
        assert!(!is_local_icon_reference("/icons/example.svg"));
    }

    #[test]
    fn microlink_payload_accepts_api_envelope_and_direct_object() {
        let envelope = json!({
            "status": "success",
            "data": {
                "title": "Envelope",
                "logo": {"url": "https://example.com/logo.png"}
            },
            "statusCode": 200
        });
        let direct = json!({
            "title": "Direct",
            "logo": {"url": "https://example.com/direct.png"}
        });

        assert_eq!(
            string_value(microlink_data_payload(&envelope).unwrap(), "title").as_deref(),
            Some("Envelope")
        );
        assert_eq!(
            nested_string(microlink_data_payload(&direct).unwrap(), &["logo", "url"]).as_deref(),
            Some("https://example.com/direct.png")
        );
        assert!(!microlink_failed(&envelope));
        assert!(microlink_failed(
            &json!({"status": "fail", "statusCode": 400})
        ));
    }

    #[test]
    fn site_target_normalization_uses_one_url_and_host_contract() {
        let full = normalize_site_target(" https://EIXEIX.com/#/dashboard ").unwrap();
        assert_eq!(full.host, "eixeix.com");
        assert_eq!(full.input_url.as_str(), "https://eixeix.com/");
        assert_eq!(full.site_url.as_str(), "https://eixeix.com/");

        let host_with_path = normalize_site_target("Example.com/docs?q=1#top").unwrap();
        assert_eq!(host_with_path.host, "example.com");
        assert_eq!(
            host_with_path.input_url.as_str(),
            "https://example.com/docs?q=1"
        );
        assert_eq!(host_with_path.site_url.as_str(), "https://example.com/");

        let protocol_relative = normalize_site_target("//Example.com/icon").unwrap();
        assert_eq!(protocol_relative.host, "example.com");
        assert_eq!(
            protocol_relative.input_url.as_str(),
            "https://example.com/icon"
        );
        assert_eq!(protocol_relative.site_url.as_str(), "https://example.com/");

        let local_with_port = normalize_site_target("http://127.0.0.1:31591/path?q=1").unwrap();
        assert_eq!(local_with_port.host, "127.0.0.1");
        assert_eq!(
            local_with_port.input_url.as_str(),
            "http://127.0.0.1:31591/path?q=1"
        );
        assert_eq!(local_with_port.site_url.as_str(), "http://127.0.0.1:31591/");

        assert!(normalize_site_target("mailto:test@example.com").is_none());
        assert!(normalize_site_target("about:blank").is_none());
    }
}
