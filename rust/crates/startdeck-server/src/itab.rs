use std::collections::HashMap;

use axum::Json;
use axum::body::Body;
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::{HeaderValue, header};
use axum::response::Response;
use chrono::{Datelike, Duration as ChronoDuration, NaiveDate, Utc};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::Row;
use uuid::Uuid;

use crate::{
    ApiError, AppState, copy_response_header, is_blocked_host, parse_json, validate_remote_url,
};

const ITAB_BING_WALLPAPER_KIND: &str = "itab_bing_wallpaper";
const ITAB_BING_WALLPAPER_CACHE_TTL_MS: i64 = 6 * 60 * 60 * 1000;
const ITAB_BING_WALLPAPER_DEFAULT_PAGE_SIZE: usize = 24;
const ITAB_BING_WALLPAPER_MAX_PAGE_SIZE: usize = 24;
const ITAB_BING_WALLPAPER_DEFAULT_SIZE: &str = "large";
const ITAB_DAILY_ENGLISH_KIND: &str = "itab_daily_english";
const ITAB_MOVIE_CALENDAR_KIND: &str = "itab_movie_calendar";
const ITAB_POEM_KIND: &str = "itab_poem";
const ITAB_WEATHER_KIND: &str = "itab_weather";
const ITAB_DAILY_WIDGET_CACHE_TTL_MS: i64 = 12 * 60 * 60 * 1000;
const ITAB_POEM_CACHE_TTL_MS: i64 = 2 * 60 * 60 * 1000;
const ITAB_MEDIA_PROXY_MAX_BYTES: usize = 12 * 1024 * 1024;

#[derive(Debug, Deserialize)]
struct TimelessqBingListResponse {
    errno: i64,
    errmsg: String,
    data: Option<TimelessqBingListData>,
}

#[derive(Debug, Deserialize)]
struct TimelessqBingListData {
    count: usize,
    #[serde(rename = "totalPages")]
    total_pages: usize,
    #[serde(rename = "pageSize")]
    page_size: usize,
    #[serde(rename = "currentPage")]
    current_page: usize,
    #[serde(default)]
    data: Vec<TimelessqBingImage>,
}

#[derive(Debug, Deserialize)]
struct TimelessqBingImage {
    #[serde(rename = "_id")]
    id: String,
    copyright: String,
    time: String,
    title: String,
    url: String,
    urlbase: String,
}

#[derive(Debug, Deserialize)]
struct TimelessqDailyEnglishResponse {
    errno: i64,
    errmsg: String,
    data: Option<TimelessqDailyEnglishData>,
}

#[derive(Debug, Deserialize)]
struct TimelessqDailyEnglishData {
    #[serde(rename = "_id")]
    id: Option<String>,
    date: Option<String>,
    content: Option<String>,
    note: Option<String>,
    #[serde(rename = "sharePicture")]
    share_picture: Option<String>,
    picture: Option<String>,
    #[serde(rename = "smallPicture")]
    small_picture: Option<String>,
    #[serde(rename = "middlePicture")]
    middle_picture: Option<String>,
    #[serde(rename = "largePicture")]
    large_picture: Option<String>,
    tts: Option<String>,
    translation: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CodelifeMovieResponse {
    code: i64,
    data: Option<CodelifeMovieData>,
    msg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CodelifeMovieData {
    date: Option<String>,
    mov_area: Option<String>,
    mov_director: Option<String>,
    mov_intro: Option<String>,
    mov_link: Option<String>,
    mov_pic: Option<String>,
    poster_url: Option<String>,
    mov_rating: Option<String>,
    mov_text: Option<String>,
    mov_title: Option<String>,
    mov_type: Option<Vec<String>>,
    mov_year: Option<String>,
    #[serde(rename = "bgColor")]
    bg_color: Option<String>,
    color: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JinrishiciResponse {
    status: String,
    data: Option<JinrishiciData>,
    warning: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JinrishiciData {
    id: Option<String>,
    content: Option<String>,
    popularity: Option<i64>,
    origin: Option<JinrishiciOrigin>,
    #[serde(rename = "cacheAt")]
    cache_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JinrishiciOrigin {
    title: Option<String>,
    dynasty: Option<String>,
    author: Option<String>,
    content: Option<Vec<String>>,
    translate: Option<Value>,
}

struct CachedWidgetRow {
    data: Value,
    source_status: String,
    expires_at: Option<i64>,
}

pub(crate) async fn cached_widget_data(
    State(state): State<AppState>,
    uri: axum::http::Uri,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let path = uri.path();
    if path.starts_with("/api/itab/weather/") {
        return Ok(Json(weather_widget_response(path, &query)));
    }

    let kind = widget_kind_from_path(path);
    if kind == ITAB_BING_WALLPAPER_KIND {
        return bing_wallpaper_data(&state, &query).await;
    }

    let refresh = query_bool(&query, "refresh");
    let now = Utc::now().timestamp_millis();
    let cached = latest_cached_widget(&state, kind).await?;
    if let Some(row) = cached.as_ref() {
        let cache_is_current = row.expires_at.map(|value| value > now).unwrap_or(true);
        if !refresh
            && cache_is_current
            && (row.source_status == "ok" || !state.remote_itab_fetch_enabled)
        {
            return Ok(Json(cached_widget_response(
                row.data.clone(),
                &row.source_status,
            )));
        }
    }

    if state.remote_itab_fetch_enabled {
        match fetch_and_store_live_widget_data(&state, kind, now).await {
            Ok(data) => return Ok(Json(cached_widget_response(data, "ok"))),
            Err(source_error) => {
                if let Some(row) = cached {
                    let status = if row.source_status == "ok" {
                        "stale"
                    } else {
                        row.source_status.as_str()
                    };
                    return Ok(Json(cached_widget_response(row.data, status)));
                }
                if let Some((cache_key, data, status)) = fallback_widget_cache(kind) {
                    cache_widget_payload(&state, kind, cache_key, &data, None, status, now).await?;
                    return Ok(Json(cached_widget_response(data, status)));
                }
                return Err(ApiError::bad_gateway(format!(
                    "widget_source_unavailable: {source_error}"
                )));
            }
        }
    }

    if let Some(row) = cached {
        return Ok(Json(cached_widget_response(row.data, &row.source_status)));
    }
    if let Some((cache_key, data, status)) = fallback_widget_cache(kind) {
        cache_widget_payload(&state, kind, cache_key, &data, None, status, now).await?;
        return Ok(Json(cached_widget_response(data, status)));
    }
    Err(ApiError::bad_gateway("cache_miss"))
}

fn query_bool(query: &HashMap<String, String>, key: &str) -> bool {
    query
        .get(key)
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

async fn latest_cached_widget(
    state: &AppState,
    kind: &str,
) -> Result<Option<CachedWidgetRow>, ApiError> {
    let row = sqlx::query(
        "SELECT value_json, source_status, expires_at FROM runtime_cache WHERE kind = ? ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(kind)
    .fetch_optional(&state.pool)
    .await?;
    Ok(row.map(|row| CachedWidgetRow {
        data: parse_json(row.get::<String, _>("value_json")),
        source_status: row.get::<String, _>("source_status"),
        expires_at: row.get::<Option<i64>, _>("expires_at"),
    }))
}

async fn cache_widget_payload(
    state: &AppState,
    kind: &str,
    cache_key: &str,
    data: &Value,
    expires_at: Option<i64>,
    source_status: &str,
    updated_at: i64,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"INSERT OR REPLACE INTO runtime_cache(kind, cache_key, value_json, expires_at, source_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)"#,
    )
    .bind(kind)
    .bind(cache_key)
    .bind(data.to_string())
    .bind(expires_at)
    .bind(source_status)
    .bind(updated_at)
    .execute(&state.pool)
    .await?;
    Ok(())
}

async fn fetch_and_store_live_widget_data(
    state: &AppState,
    kind: &str,
    now: i64,
) -> Result<Value, String> {
    let data = fetch_live_widget_data(&state.http, kind).await?;
    let cache_key = live_widget_cache_key(kind, &data);
    cache_widget_payload(
        state,
        kind,
        &cache_key,
        &data,
        Some(now + live_widget_cache_ttl_ms(kind)),
        "ok",
        now,
    )
    .await
    .map_err(ApiError::into_message)?;
    Ok(data)
}

fn live_widget_cache_ttl_ms(kind: &str) -> i64 {
    match kind {
        ITAB_POEM_KIND => ITAB_POEM_CACHE_TTL_MS,
        _ => ITAB_DAILY_WIDGET_CACHE_TTL_MS,
    }
}

fn live_widget_cache_key(kind: &str, data: &Value) -> String {
    match kind {
        ITAB_DAILY_ENGLISH_KIND => format!(
            "timelessq:{}:{}",
            string_field(data, "dateline").unwrap_or_else(|| "today".to_string()),
            short_hash(&data.to_string())
        ),
        ITAB_MOVIE_CALENDAR_KIND => format!(
            "codelife:{}",
            string_field(data, "date").unwrap_or_else(|| "today".to_string())
        ),
        ITAB_POEM_KIND => "jinrishici:default".to_string(),
        _ => "default".to_string(),
    }
}

async fn fetch_live_widget_data(client: &Client, kind: &str) -> Result<Value, String> {
    match kind {
        ITAB_DAILY_ENGLISH_KIND => fetch_daily_english(client).await,
        ITAB_MOVIE_CALENDAR_KIND => fetch_movie_calendar(client).await,
        ITAB_POEM_KIND => fetch_poem(client).await,
        _ => Err("unsupported_widget_kind".to_string()),
    }
}

async fn bing_wallpaper_data(
    state: &AppState,
    query: &HashMap<String, String>,
) -> Result<Json<Value>, ApiError> {
    let page = query_usize(query, "page", 1, 1, usize::MAX);
    let page_size = query_usize(
        query,
        "pageSize",
        ITAB_BING_WALLPAPER_DEFAULT_PAGE_SIZE,
        1,
        ITAB_BING_WALLPAPER_MAX_PAGE_SIZE,
    );
    let size = sanitize_bing_image_size(
        query
            .get("size")
            .map(String::as_str)
            .unwrap_or(ITAB_BING_WALLPAPER_DEFAULT_SIZE),
    );
    let refresh = query
        .get("refresh")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let cache_key = format!("timelessq:{size}:page:{page}:pageSize:{page_size}:v1");
    let now = Utc::now().timestamp_millis();
    let cached = sqlx::query(
        "SELECT value_json, source_status, expires_at FROM runtime_cache WHERE kind = ? AND cache_key = ?",
    )
    .bind(ITAB_BING_WALLPAPER_KIND)
    .bind(&cache_key)
    .fetch_optional(&state.pool)
    .await?;

    if let Some(row) = cached.as_ref() {
        let expires_at = row.get::<Option<i64>, _>("expires_at");
        if !refresh && expires_at.map(|value| value > now).unwrap_or(true) {
            let data = parse_json(row.get::<String, _>("value_json"));
            let status = row.get::<String, _>("source_status");
            return Ok(Json(bing_wallpaper_response(data, &status)));
        }
    }

    match fetch_bing_wallpaper_page(&state.http, page, page_size, &size).await {
        Ok(data) => {
            sqlx::query(
                r#"INSERT OR REPLACE INTO runtime_cache(kind, cache_key, value_json, expires_at, source_status, updated_at)
                   VALUES (?, ?, ?, ?, 'ok', ?)"#,
            )
            .bind(ITAB_BING_WALLPAPER_KIND)
            .bind(&cache_key)
            .bind(data.to_string())
            .bind(now + ITAB_BING_WALLPAPER_CACHE_TTL_MS)
            .bind(now)
            .execute(&state.pool)
            .await?;
            Ok(Json(bing_wallpaper_response(data, "ok")))
        }
        Err(source_error) => {
            if let Some(row) = cached {
                let data = parse_json(row.get::<String, _>("value_json"));
                return Ok(Json(bing_wallpaper_response(data, "stale")));
            }
            Err(ApiError::bad_gateway(format!(
                "bing_wallpaper_source_unavailable: {source_error}"
            )))
        }
    }
}

fn query_usize(
    query: &HashMap<String, String>,
    key: &str,
    fallback: usize,
    min: usize,
    max: usize,
) -> usize {
    query
        .get(key)
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(fallback)
        .clamp(min, max)
}

fn sanitize_bing_image_size(value: &str) -> String {
    let trimmed = value.trim();
    match trimmed {
        "default" | "mini" | "small" | "middle" | "large" | "mobile-mini" | "mobile-small"
        | "mobile-middle" | "mobile-default" => trimmed.to_string(),
        _ => ITAB_BING_WALLPAPER_DEFAULT_SIZE.to_string(),
    }
}

async fn fetch_bing_wallpaper_page(
    client: &Client,
    page: usize,
    page_size: usize,
    size: &str,
) -> Result<Value, String> {
    let response = client
        .get("https://api.timelessq.com/bing/list")
        .query(&[
            ("page", page.to_string()),
            ("pageSize", page_size.to_string()),
            ("size", size.to_string()),
        ])
        .send()
        .await
        .map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("source_status_{status}"));
    }
    let payload = response
        .json::<TimelessqBingListResponse>()
        .await
        .map_err(|err| err.to_string())?;
    if payload.errno != 0 {
        return Err(if payload.errmsg.is_empty() {
            format!("source_errno_{}", payload.errno)
        } else {
            payload.errmsg
        });
    }
    let Some(data) = payload.data else {
        return Err("missing_source_data".to_string());
    };
    let entries: Vec<Value> = data
        .data
        .into_iter()
        .map(normalize_bing_wallpaper_entry)
        .collect();

    Ok(json!({
        "entries": entries,
        "updatedAt": Utc::now().to_rfc3339(),
        "count": data.count,
        "totalPages": data.total_pages.max(1),
        "pageSize": data.page_size,
        "currentPage": data.current_page,
        "sourceStatus": "ok"
    }))
}

async fn fetch_daily_english(client: &Client) -> Result<Value, String> {
    let response = client
        .get("https://api.timelessq.com/english-sentence")
        .send()
        .await
        .map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("source_status_{status}"));
    }
    let payload = response
        .json::<TimelessqDailyEnglishResponse>()
        .await
        .map_err(|err| err.to_string())?;
    if payload.errno != 0 {
        return Err(if payload.errmsg.is_empty() {
            format!("source_errno_{}", payload.errno)
        } else {
            payload.errmsg
        });
    }
    let Some(data) = payload.data else {
        return Err("missing_source_data".to_string());
    };

    let id = clean_optional(data.id);
    let dateline = clean_optional(data.date);
    let sentence = clean_optional(data.content);
    if sentence.is_empty() {
        return Err("missing_content".to_string());
    }
    let note = clean_optional(data.note);
    let translation = if note.is_empty() {
        clean_optional(data.translation)
    } else {
        note
    };
    let image_source_url = first_non_empty_owned([
        data.large_picture,
        data.middle_picture,
        data.picture,
        data.small_picture,
        data.share_picture,
    ]);
    let audio_source_url = clean_optional(data.tts);
    let date = if dateline.is_empty() {
        local_date_parts().0
    } else {
        dateline
    };
    let version = short_hash(&format!(
        "{id}:{date}:{sentence}:{image_source_url}:{audio_source_url}"
    ));
    let image_url = if image_source_url.is_empty() {
        String::new()
    } else {
        format!("/api/itab/today-english/media/image?date={date}&v={version}")
    };
    let audio_url = if audio_source_url.is_empty() {
        String::new()
    } else {
        format!("/api/itab/today-english/media/audio?date={date}&v={version}")
    };

    Ok(json!({
        "id": id,
        "mode": "跟读",
        "sentence": sentence,
        "translation": translation,
        "progressLabel": "00:00",
        "imageUrl": image_url,
        "audioUrl": audio_url,
        "imageSourceUrl": image_source_url,
        "audioSourceUrl": audio_source_url,
        "dateline": date,
        "provider": "timelessq",
        "updatedAt": Utc::now().to_rfc3339(),
        "sourceStatus": "ok"
    }))
}

async fn fetch_movie_calendar(client: &Client) -> Result<Value, String> {
    let response = client
        .get("https://api.codelife.cc/itab/todayMovie")
        .query(&[("version", "v2")])
        .send()
        .await
        .map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("source_status_{status}"));
    }
    let payload = response
        .json::<CodelifeMovieResponse>()
        .await
        .map_err(|err| err.to_string())?;
    if payload.code != 200 {
        return Err(payload
            .msg
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| format!("source_code_{}", payload.code)));
    }
    let Some(data) = payload.data else {
        return Err("missing_source_data".to_string());
    };

    let (date, day, month_label, weekday) = movie_date_parts(&clean_optional(data.date));
    let movie_title = clean_optional(data.mov_title);
    if movie_title.is_empty() {
        return Err("missing_movie_title".to_string());
    }
    let quote = clean_optional(data.mov_text);
    let intro = clean_optional(data.mov_intro);
    let poster_source_url = clean_optional(data.poster_url);
    let cover_source_url = clean_optional(data.mov_pic);
    let version = short_hash(&format!(
        "{date}:{movie_title}:{poster_source_url}:{cover_source_url}"
    ));
    let poster_url = if poster_source_url.is_empty() {
        String::new()
    } else {
        format!("/api/itab/movie-calendar/image/poster?date={date}&v={version}")
    };
    let cover_url = if cover_source_url.is_empty() {
        String::new()
    } else {
        format!("/api/itab/movie-calendar/image/cover?date={date}&v={version}")
    };
    let genres = data
        .mov_type
        .unwrap_or_default()
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();

    Ok(json!({
        "date": date,
        "day": day,
        "monthLabel": month_label,
        "weekday": weekday,
        "movieTitle": movie_title,
        "rating": clean_optional(data.mov_rating),
        "quote": if quote.is_empty() { intro.clone() } else { quote },
        "posterUrl": poster_url,
        "coverUrl": cover_url,
        "posterSourceUrl": poster_source_url,
        "coverSourceUrl": cover_source_url,
        "sourceUrl": clean_optional(data.mov_link),
        "year": clean_optional(data.mov_year),
        "area": clean_optional(data.mov_area),
        "director": clean_optional(data.mov_director),
        "intro": intro,
        "genres": genres,
        "bgColor": clean_color(data.bg_color, "3a444c"),
        "textColor": clean_color(data.color, "f4f7f9"),
        "provider": "codelife",
        "updatedAt": Utc::now().to_rfc3339(),
        "sourceStatus": "ok"
    }))
}

async fn fetch_poem(client: &Client) -> Result<Value, String> {
    let response = client
        .get("https://v2.jinrishici.com/one.json")
        .send()
        .await
        .map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("source_status_{status}"));
    }
    let payload = response
        .json::<JinrishiciResponse>()
        .await
        .map_err(|err| err.to_string())?;
    if payload.status != "success" {
        return Err(payload
            .warning
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| format!("source_status_{}", payload.status)));
    }
    let Some(data) = payload.data else {
        return Err("missing_source_data".to_string());
    };
    let Some(origin) = data.origin else {
        return Err("missing_origin".to_string());
    };

    let sentence = clean_optional(data.content);
    let poem_title = clean_optional(origin.title);
    let author = clean_optional(origin.author);
    let dynasty = clean_optional(origin.dynasty);
    if sentence.is_empty() || poem_title.is_empty() || author.is_empty() || dynasty.is_empty() {
        return Err("missing_required_poem_fields".to_string());
    }
    let full_text = clean_string_vec(origin.content).unwrap_or_else(|| vec![sentence.clone()]);

    Ok(json!({
        "id": clean_optional(data.id),
        "sentence": sentence,
        "poemTitle": poem_title,
        "author": author,
        "dynasty": dynasty,
        "fullText": full_text,
        "translation": strings_from_value(origin.translate),
        "annotations": [],
        "preface": [],
        "popularity": data.popularity,
        "cacheAt": clean_optional(data.cache_at),
        "provider": "jinrishici",
        "sourceStatus": "ok"
    }))
}

fn normalize_bing_wallpaper_entry(image: TimelessqBingImage) -> Value {
    let download_url = absolute_bing_url(image.url.trim());
    let thumbnail_url = thumbnail_bing_url(&download_url);
    let (location, credit) = split_bing_copyright(&image.copyright);
    let id_seed = if image.id.trim().is_empty() {
        image.urlbase.trim()
    } else {
        image.id.trim()
    };

    json!({
        "id": format!("bing-{}", sanitize_wallpaper_id(id_seed)),
        "title": image.title.trim(),
        "location": location,
        "credit": if credit.is_empty() { "Bing".to_string() } else { credit },
        "thumbnailUrl": thumbnail_url,
        "downloadUrl": download_url,
        "sourceUrl": absolute_bing_url(image.urlbase.trim()),
        "bingTitle": image.title.trim(),
        "startDate": image.time,
        "copyrightText": image.copyright
    })
}

fn absolute_bing_url(raw: &str) -> String {
    if raw.starts_with("http://") || raw.starts_with("https://") {
        raw.to_string()
    } else if raw.starts_with('/') {
        format!("https://www.bing.com{raw}")
    } else {
        format!("https://www.bing.com/{raw}")
    }
}

fn thumbnail_bing_url(download_url: &str) -> String {
    let separator = if download_url.contains('?') { '&' } else { '?' };
    format!("{download_url}{separator}w=360&h=202")
}

fn split_bing_copyright(copyright: &str) -> (String, String) {
    if let Some((location, rest)) = copyright.split_once(" (© ") {
        let credit = rest.trim_end_matches(')').trim().to_string();
        (location.trim().to_string(), credit)
    } else {
        (copyright.trim().to_string(), "Bing".to_string())
    }
}

fn clean_optional(value: Option<String>) -> String {
    value.unwrap_or_default().trim().to_string()
}

fn first_non_empty_owned<const N: usize>(values: [Option<String>; N]) -> String {
    values
        .into_iter()
        .map(clean_optional)
        .find(|value| !value.is_empty())
        .unwrap_or_default()
}

fn clean_string_vec(value: Option<Vec<String>>) -> Option<Vec<String>> {
    let values = value?
        .into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect::<Vec<_>>();
    if values.is_empty() {
        None
    } else {
        Some(values)
    }
}

fn strings_from_value(value: Option<Value>) -> Vec<String> {
    match value {
        Some(Value::String(text)) => {
            let text = text.trim();
            if text.is_empty() {
                Vec::new()
            } else {
                vec![text.to_string()]
            }
        }
        Some(Value::Array(items)) => items
            .into_iter()
            .filter_map(|item| match item {
                Value::String(text) => {
                    let text = text.trim().to_string();
                    if text.is_empty() { None } else { Some(text) }
                }
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn clean_color(value: Option<String>, fallback: &str) -> String {
    let color = clean_optional(value).trim_start_matches('#').to_string();
    if color.len() == 6 && color.chars().all(|ch| ch.is_ascii_hexdigit()) {
        color
    } else {
        fallback.to_string()
    }
}

fn movie_date_parts(raw: &str) -> (String, String, String, String) {
    let parsed = NaiveDate::parse_from_str(raw, "%Y%m%d")
        .or_else(|_| NaiveDate::parse_from_str(raw, "%Y-%m-%d"))
        .ok()
        .unwrap_or_else(today_naive_date);
    date_parts(parsed)
}

fn today_naive_date() -> NaiveDate {
    let local = Utc::now() + ChronoDuration::hours(8);
    NaiveDate::from_ymd_opt(local.year(), local.month(), local.day())
        .expect("current date must be valid")
}

fn date_parts(date: NaiveDate) -> (String, String, String, String) {
    let weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    (
        date.format("%Y-%m-%d").to_string(),
        date.day().to_string(),
        format!("{}月", date.month()),
        weekdays[date.weekday().num_days_from_monday() as usize].to_string(),
    )
}

fn short_hash(seed: &str) -> String {
    format!("{:x}", Sha256::digest(seed.as_bytes()))
        .chars()
        .take(12)
        .collect()
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn sanitize_wallpaper_id(seed: &str) -> String {
    let sanitized: String = seed
        .chars()
        .filter_map(|character| {
            if character.is_ascii_alphanumeric() {
                Some(character.to_ascii_lowercase())
            } else if character == '-' || character == '_' {
                Some('-')
            } else {
                None
            }
        })
        .collect();
    if sanitized.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        sanitized
    }
}

fn bing_wallpaper_response(mut data: Value, status: &str) -> Value {
    if let Value::Object(ref mut object) = data {
        object.insert("sourceStatus".to_string(), json!(status));
    }
    cached_widget_response(data, status)
}

fn cached_widget_response(mut data: Value, status: &str) -> Value {
    if let Value::Object(ref mut object) = data {
        object.insert("sourceStatus".to_string(), json!(status));
    }
    json!({"success": true, "data": data, "sourceStatus": status})
}

fn weather_widget_response(path: &str, query: &HashMap<String, String>) -> Value {
    let data = match path {
        "/api/itab/weather/location" => fallback_weather_location(),
        "/api/itab/weather/search" => {
            let keyword = query
                .get("keyword")
                .map(String::as_str)
                .unwrap_or_default()
                .trim();
            fallback_weather_search(keyword)
        }
        "/api/itab/weather/current" => fallback_weather_current_bundle(),
        _ => json!({"sourceStatus": "fallback"}),
    };
    json!({"success": true, "data": data, "sourceStatus": "fallback"})
}

fn fallback_weather_location() -> Value {
    json!({
        "id": "101280608",
        "name": "龙华",
        "adm1": "广东省",
        "adm2": "深圳",
        "country": "中国",
        "type": "city",
        "location": "114.04,22.65",
        "ip": "127.0.0.1",
        "sourceStatus": "fallback"
    })
}

fn fallback_weather_search(keyword: &str) -> Value {
    let cities = vec![
        json!({"id": "101280608", "name": "龙华", "adm1": "广东省", "adm2": "深圳", "country": "中国", "type": "city", "location": "114.04,22.65"}),
        json!({"id": "101280601", "name": "深圳", "adm1": "广东省", "adm2": "深圳", "country": "中国", "type": "city", "location": "114.05,22.55"}),
        json!({"id": "101280101", "name": "广州", "adm1": "广东省", "adm2": "广州", "country": "中国", "type": "city", "location": "113.26,23.13"}),
        json!({"id": "101010100", "name": "北京", "adm1": "北京市", "adm2": "北京", "country": "中国", "type": "city", "location": "116.41,39.90"}),
        json!({"id": "101020100", "name": "上海", "adm1": "上海市", "adm2": "上海", "country": "中国", "type": "city", "location": "121.47,31.23"}),
    ];
    if keyword.is_empty() {
        return Value::Array(cities);
    }
    let filtered: Vec<Value> = cities
        .iter()
        .filter(|city| {
            ["name", "adm1", "adm2"]
                .iter()
                .filter_map(|key| city.get(key).and_then(Value::as_str))
                .any(|value| value.contains(keyword))
        })
        .cloned()
        .collect();
    Value::Array(if filtered.is_empty() {
        cities
    } else {
        filtered
    })
}

fn fallback_weather_current_bundle() -> Value {
    json!({
        "sourceStatus": "fallback",
        "current": {
            "status": "ok",
            "rain": {"txt": "各类人群可多参加户外活动，多呼吸一下清新的空气。"},
            "now": {
                "cond_code": "104",
                "cond_txt": "阴",
                "hum": "88",
                "pcpn": "22.5",
                "pres": "1003",
                "tmp": "27",
                "wind_dir": "北风",
                "wind_sc": "0"
            },
            "air_now_city": {"qlty": "优", "aqi": "34"},
            "sun": {"rise": "05:40", "set": "18:59"},
            "daily_forecast": [
                {"date": "2026-05-21", "cond_txt_d": "阴", "cond_code_d": "104", "wind_sc": "<3", "tmp_max": "29", "tmp_min": "25"},
                {"date": "2026-05-22", "cond_txt_d": "晴", "cond_code_d": "100", "wind_sc": "3-4", "tmp_max": "30", "tmp_min": "26"},
                {"date": "2026-05-23", "cond_txt_d": "晴", "cond_code_d": "100", "wind_sc": "3-4转<3", "tmp_max": "30", "tmp_min": "26"},
                {"date": "2026-05-24", "cond_txt_d": "多云", "cond_code_d": "104", "wind_sc": "3-4转<3", "tmp_max": "33", "tmp_min": "26"},
                {"date": "2026-05-25", "cond_txt_d": "多云", "cond_code_d": "104", "wind_sc": "3-4转<3", "tmp_max": "33", "tmp_min": "27"},
                {"date": "2026-05-26", "cond_txt_d": "多云", "cond_code_d": "104", "wind_sc": "3-4转<3", "tmp_max": "33", "tmp_min": "27"},
                {"date": "2026-05-27", "cond_txt_d": "小雨转多云", "cond_code_d": "104", "wind_sc": "<3", "tmp_max": "33", "tmp_min": "26"}
            ]
        },
        "hourly": {
            "updateTime": "2026-05-21T21:35+08:00",
            "hourly": [
                {"fxTime": "2026-05-21T22:00+08:00", "icon": "151", "temp": "26"},
                {"fxTime": "2026-05-21T23:00+08:00", "icon": "302", "temp": "26"},
                {"fxTime": "2026-05-22T00:00+08:00", "icon": "302", "temp": "26"},
                {"fxTime": "2026-05-22T01:00+08:00", "icon": "302", "temp": "26"},
                {"fxTime": "2026-05-22T02:00+08:00", "icon": "302", "temp": "26"},
                {"fxTime": "2026-05-22T03:00+08:00", "icon": "104", "temp": "26"},
                {"fxTime": "2026-05-22T04:00+08:00", "icon": "302", "temp": "26"},
                {"fxTime": "2026-05-22T05:00+08:00", "icon": "302", "temp": "26"},
                {"fxTime": "2026-05-22T06:00+08:00", "icon": "101", "temp": "27"},
                {"fxTime": "2026-05-22T07:00+08:00", "icon": "101", "temp": "28"},
                {"fxTime": "2026-05-22T08:00+08:00", "icon": "302", "temp": "28"},
                {"fxTime": "2026-05-22T09:00+08:00", "icon": "101", "temp": "29"},
                {"fxTime": "2026-05-22T10:00+08:00", "icon": "101", "temp": "29"},
                {"fxTime": "2026-05-22T11:00+08:00", "icon": "100", "temp": "30"},
                {"fxTime": "2026-05-22T12:00+08:00", "icon": "100", "temp": "30"},
                {"fxTime": "2026-05-22T13:00+08:00", "icon": "100", "temp": "30"},
                {"fxTime": "2026-05-22T14:00+08:00", "icon": "100", "temp": "31"},
                {"fxTime": "2026-05-22T15:00+08:00", "icon": "100", "temp": "30"},
                {"fxTime": "2026-05-22T16:00+08:00", "icon": "100", "temp": "30"},
                {"fxTime": "2026-05-22T17:00+08:00", "icon": "100", "temp": "29"},
                {"fxTime": "2026-05-22T18:00+08:00", "icon": "100", "temp": "29"},
                {"fxTime": "2026-05-22T19:00+08:00", "icon": "100", "temp": "28"},
                {"fxTime": "2026-05-22T20:00+08:00", "icon": "150", "temp": "28"},
                {"fxTime": "2026-05-22T21:00+08:00", "icon": "150", "temp": "27"}
            ]
        }
    })
}

fn fallback_widget_cache(kind: &str) -> Option<(&'static str, Value, &'static str)> {
    match kind {
        "itab_daily_english" => Some((
            "fallback",
            json!({
                "mode": "跟读",
                "sentence": "Light stretches longer, painting walls gold.",
                "translation": "日光拉得更长，把墙壁染成金色。",
                "progressLabel": "00:00",
                "imageUrl": "",
                "audioUrl": "",
                "dateline": local_date_parts().0,
                "sourceStatus": "fallback"
            }),
            "fallback",
        )),
        "itab_movie_calendar" => {
            let (date, day, month_label, weekday) = local_date_parts();
            Some((
                "today:v2",
                json!({
                    "date": date,
                    "day": day,
                    "monthLabel": month_label,
                    "weekday": weekday,
                    "movieTitle": "雌雄莫辨",
                    "rating": "7.4",
                    "quote": "你不需要成为任何人，只需做你自己。",
                    "posterUrl": "",
                    "coverUrl": "",
                    "sourceUrl": "https://movie.douban.com/subject/4712730/",
                    "year": "2011",
                    "area": "英国 爱尔兰",
                    "director": "罗德里戈·加西亚",
                    "intro": "阿尔伯特穿上男侍制服，靠谨慎与坚韧在陌生城市里寻找属于自己的生活。",
                    "genres": ["剧情"],
                    "bgColor": "3a444c",
                    "textColor": "f4f7f9",
                    "sourceStatus": "fallback"
                }),
                "fallback",
            ))
        }
        "itab_poem" => Some((
            "fallback:v1",
            json!({
                "id": "fallback-ouyangxiu-langtaosha",
                "sentence": "垂杨紫陌洛城东，总是当时携手处，游遍芳丛。",
                "poemTitle": "浪淘沙",
                "author": "欧阳修",
                "dynasty": "宋",
                "fullText": [
                    "把酒祝东风，且共从容。",
                    "垂杨紫陌洛城东，总是当时携手处，游遍芳丛。",
                    "聚散苦匆匆，此恨无穷。",
                    "今年花胜去年红，可惜明年花更好，知与谁同？"
                ],
                "translation": [
                    "端起酒杯向东方祈祷，请你再留些时日不要一去匆匆。",
                    "洛阳城东垂柳婆娑的郊野小道，就是我们去年携手同游的地方。",
                    "欢聚和离散都是这样匆促，心中的遗恨却无尽无穷。"
                ],
                "annotations": [
                    "把酒：端着酒杯。",
                    "从容：留恋，不舍。",
                    "紫陌：指洛阳的道路。",
                    "匆匆：形容时间匆促。"
                ],
                "preface": [
                    "此词为春日与友人在洛阳城东旧地同游，有感而作。",
                    "上片叙事，回忆昔日洛城游春赏花之欢聚；下片写聚散无常之感。"
                ],
                "sourceStatus": "fallback"
            }),
            "fallback",
        )),
        _ => None,
    }
}

fn local_date_parts() -> (String, String, String, String) {
    let local = Utc::now() + ChronoDuration::hours(8);
    let weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    (
        local.format("%Y-%m-%d").to_string(),
        local.day().to_string(),
        format!("{}月", local.month()),
        weekdays[local.weekday().num_days_from_monday() as usize].to_string(),
    )
}

pub(crate) async fn cached_today_english_media(
    State(state): State<AppState>,
    AxumPath(kind): AxumPath<String>,
) -> Result<Response, ApiError> {
    match kind.as_str() {
        "image" => {
            cached_widget_media(
                &state,
                ITAB_DAILY_ENGLISH_KIND,
                &["imageSourceUrl"],
                "daily_english_image",
            )
            .await
        }
        "audio" => {
            cached_widget_media(
                &state,
                ITAB_DAILY_ENGLISH_KIND,
                &["audioSourceUrl"],
                "daily_english_audio",
            )
            .await
        }
        _ => Err(ApiError::not_found("media_not_cached")),
    }
}

pub(crate) async fn cached_movie_calendar_image(
    State(state): State<AppState>,
    AxumPath(kind): AxumPath<String>,
) -> Result<Response, ApiError> {
    match kind.as_str() {
        "poster" => {
            cached_widget_media(
                &state,
                ITAB_MOVIE_CALENDAR_KIND,
                &["posterSourceUrl"],
                "movie_calendar_poster",
            )
            .await
        }
        "cover" => {
            cached_widget_media(
                &state,
                ITAB_MOVIE_CALENDAR_KIND,
                &["coverSourceUrl"],
                "movie_calendar_cover",
            )
            .await
        }
        _ => Err(ApiError::not_found("media_not_cached")),
    }
}

async fn cached_widget_media(
    state: &AppState,
    widget_kind: &str,
    source_keys: &[&str],
    media_name: &str,
) -> Result<Response, ApiError> {
    let payload = latest_cached_widget(state, widget_kind)
        .await?
        .map(|row| row.data);
    let mut source_url = payload
        .as_ref()
        .and_then(|data| first_string_field(data, source_keys));

    if source_url.is_none() && state.remote_itab_fetch_enabled {
        let now = Utc::now().timestamp_millis();
        match fetch_and_store_live_widget_data(state, widget_kind, now).await {
            Ok(data) => {
                source_url = first_string_field(&data, source_keys);
            }
            Err(source_error) => {
                if payload.is_none() {
                    return Err(ApiError::bad_gateway(format!(
                        "widget_source_unavailable: {source_error}"
                    )));
                }
            }
        }
    }

    let Some(source_url) = source_url else {
        return Err(ApiError::not_found("media_not_cached"));
    };
    proxy_remote_media(state, &source_url, media_name).await
}

fn first_string_field(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| string_field(value, key))
}

async fn proxy_remote_media(
    state: &AppState,
    source_url: &str,
    media_name: &str,
) -> Result<Response, ApiError> {
    let parsed = validate_remote_url(source_url).await?;
    if is_blocked_host(parsed.host_str().unwrap_or_default()).await? {
        return Err(ApiError::forbidden("blocked_host"));
    }
    let response = state
        .http
        .get(parsed)
        .send()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    let status = response.status();
    if !status.is_success() {
        return Err(ApiError::bad_gateway(format!(
            "media_source_status_{status}"
        )));
    }
    if response
        .content_length()
        .map(|length| length as usize > ITAB_MEDIA_PROXY_MAX_BYTES)
        .unwrap_or(false)
    {
        return Err(ApiError::bad_gateway("media_too_large"));
    }
    let headers_in = response.headers().clone();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    if bytes.len() > ITAB_MEDIA_PROXY_MAX_BYTES {
        return Err(ApiError::bad_gateway("media_too_large"));
    }
    let mut out = Response::new(Body::from(bytes));
    copy_response_header(&headers_in, out.headers_mut(), header::CONTENT_TYPE);
    copy_response_header(&headers_in, out.headers_mut(), header::CACHE_CONTROL);
    copy_response_header(&headers_in, out.headers_mut(), header::ETAG);
    if !out.headers().contains_key(header::CONTENT_TYPE) {
        out.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/octet-stream"),
        );
    }
    if !out.headers().contains_key(header::CACHE_CONTROL) {
        out.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=21600"),
        );
    }
    if let Ok(value) = HeaderValue::from_str(media_name) {
        out.headers_mut().insert("x-startdeck-media", value);
    }
    Ok(out)
}

fn widget_kind_from_path(path: &str) -> &'static str {
    match path {
        "/api/itab/today-english" => ITAB_DAILY_ENGLISH_KIND,
        "/api/itab/movie-calendar" => ITAB_MOVIE_CALENDAR_KIND,
        "/api/itab/bing-wallpapers" => ITAB_BING_WALLPAPER_KIND,
        "/api/itab/weather/location" | "/api/itab/weather/search" | "/api/itab/weather/current" => {
            ITAB_WEATHER_KIND
        }
        "/api/itab/poem" => ITAB_POEM_KIND,
        _ => "unknown",
    }
}
