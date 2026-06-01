use std::collections::HashMap;

use axum::Json;
use axum::body::Body;
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::{HeaderMap, HeaderValue, header};
use axum::response::Response;
use chrono::{Datelike, Duration as ChronoDuration, NaiveDate, Utc};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::Row;
use uuid::Uuid;

use crate::codelife::{
    CodelifeLocationLookup, fetch_location, fetch_weather_current, fetch_weather_hourly,
    location_to_value, request_ip_from_headers, search_weather_city,
};
use crate::qweather::fetch_weather_bundle as fetch_qweather_weather_bundle;
use crate::upstream_allowlist::CODELIFE_TODAY_MOVIE_URL;
use crate::{
    ApiError, AppState, copy_response_header, is_blocked_host, parse_json, validate_remote_url,
};

const SD_BING_WALLPAPER_KIND: &str = "sd_bing_wallpaper";
const SD_BING_WALLPAPER_CACHE_TTL_MS: i64 = 6 * 60 * 60 * 1000;
const SD_BING_WALLPAPER_DEFAULT_PAGE_SIZE: usize = 24;
const SD_BING_WALLPAPER_MAX_PAGE_SIZE: usize = 24;
const SD_BING_WALLPAPER_DEFAULT_SIZE: &str = "large";
const SD_DAILY_ENGLISH_KIND: &str = "sd_daily_english";
const SD_MOVIE_CALENDAR_KIND: &str = "sd_movie_calendar";
const SD_POEM_KIND: &str = "sd_poem";
const SD_WEATHER_KIND: &str = "sd_weather";
const SD_WEATHER_CURRENT_CACHE_TTL_MS: i64 = 5 * 60 * 1000;
const SD_DAILY_WIDGET_CACHE_TTL_MS: i64 = 12 * 60 * 60 * 1000;
const SD_POEM_CACHE_TTL_MS: i64 = 2 * 60 * 60 * 1000;
const SD_MEDIA_PROXY_MAX_BYTES: usize = 12 * 1024 * 1024;

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
    headers: HeaderMap,
    uri: axum::http::Uri,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let path = uri.path();
    if path.starts_with("/api/weather/") {
        return weather_widget_response(&state, &headers, path, &query)
            .await
            .map(Json);
    }

    let kind = widget_kind_from_path(path);
    if kind == SD_BING_WALLPAPER_KIND {
        return bing_wallpaper_data(&state, &query).await;
    }

    let refresh = query_bool(&query, "refresh");
    let now = Utc::now().timestamp_millis();
    let cached = latest_cached_widget(&state, kind).await?;
    if let Some(row) = cached.as_ref() {
        let cache_is_current = cache_is_current(row.expires_at, now);
        if !refresh
            && cache_is_current
            && (row.source_status == "ok" || !state.remote_widget_fetch_enabled)
        {
            return Ok(Json(cached_widget_response(
                row.data.clone(),
                &row.source_status,
            )));
        }
    }

    if state.remote_widget_fetch_enabled {
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
                return Err(ApiError::bad_gateway(format!(
                    "widget_source_unavailable: {source_error}"
                )));
            }
        }
    }

    if let Some(row) = cached {
        return Ok(Json(cached_widget_response(row.data, &row.source_status)));
    }
    Err(ApiError::bad_gateway("cache_miss"))
}

fn query_bool(query: &HashMap<String, String>, key: &str) -> bool {
    query
        .get(key)
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn has_query_value(query: &HashMap<String, String>, key: &str) -> bool {
    query
        .get(key)
        .map(String::as_str)
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
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

async fn cached_widget_by_key(
    state: &AppState,
    kind: &str,
    cache_key: &str,
) -> Result<Option<CachedWidgetRow>, ApiError> {
    let row = sqlx::query(
        "SELECT value_json, source_status, expires_at FROM runtime_cache WHERE kind = ? AND cache_key = ? LIMIT 1",
    )
    .bind(kind)
    .bind(cache_key)
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
        SD_POEM_KIND => SD_POEM_CACHE_TTL_MS,
        _ => SD_DAILY_WIDGET_CACHE_TTL_MS,
    }
}

fn live_widget_cache_key(kind: &str, data: &Value) -> String {
    match kind {
        SD_DAILY_ENGLISH_KIND => format!(
            "timelessq:{}:{}",
            string_field(data, "dateline").unwrap_or_else(|| "today".to_string()),
            short_hash(&data.to_string())
        ),
        SD_MOVIE_CALENDAR_KIND => format!(
            "codelife:{}",
            string_field(data, "date").unwrap_or_else(|| "today".to_string())
        ),
        SD_POEM_KIND => "jinrishici:default".to_string(),
        _ => "default".to_string(),
    }
}

async fn fetch_live_widget_data(client: &Client, kind: &str) -> Result<Value, String> {
    match kind {
        SD_DAILY_ENGLISH_KIND => fetch_daily_english(client).await,
        SD_MOVIE_CALENDAR_KIND => fetch_movie_calendar(client).await,
        SD_POEM_KIND => fetch_poem(client).await,
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
        SD_BING_WALLPAPER_DEFAULT_PAGE_SIZE,
        1,
        SD_BING_WALLPAPER_MAX_PAGE_SIZE,
    );
    let size = sanitize_bing_image_size(
        query
            .get("size")
            .map(String::as_str)
            .unwrap_or(SD_BING_WALLPAPER_DEFAULT_SIZE),
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
    .bind(SD_BING_WALLPAPER_KIND)
    .bind(&cache_key)
    .fetch_optional(&state.pool)
    .await?;

    if let Some(row) = cached.as_ref() {
        let expires_at = row.get::<Option<i64>, _>("expires_at");
        if !refresh && (cache_is_current(expires_at, now) || !state.remote_widget_fetch_enabled) {
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
            .bind(SD_BING_WALLPAPER_KIND)
            .bind(&cache_key)
            .bind(data.to_string())
            .bind(now + SD_BING_WALLPAPER_CACHE_TTL_MS)
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
        _ => SD_BING_WALLPAPER_DEFAULT_SIZE.to_string(),
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
        format!("/api/today-english/media/image?date={date}&v={version}")
    };
    let audio_url = if audio_source_url.is_empty() {
        String::new()
    } else {
        format!("/api/today-english/media/audio?date={date}&v={version}")
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
        .get(CODELIFE_TODAY_MOVIE_URL)
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
        format!("/api/movie-calendar/image/poster?date={date}&v={version}")
    };
    let cover_url = if cover_source_url.is_empty() {
        String::new()
    } else {
        format!("/api/movie-calendar/image/cover?date={date}&v={version}")
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

fn cache_is_current(expires_at: Option<i64>, now: i64) -> bool {
    expires_at.is_some_and(|value| value > now)
}

async fn weather_widget_response(
    state: &AppState,
    headers: &HeaderMap,
    path: &str,
    query: &HashMap<String, String>,
) -> Result<Value, ApiError> {
    if !state.remote_widget_fetch_enabled {
        return Err(ApiError::bad_gateway("weather_source_unavailable"));
    }

    if path == "/api/weather/current" {
        return weather_current_response(state, headers, query).await;
    }

    match fetch_live_weather_widget_data(state, headers, path, query).await {
        Ok(data) => Ok(cached_widget_response(data, "ok")),
        Err(source_error) => Err(ApiError::bad_gateway(format!(
            "weather_source_unavailable: {source_error}"
        ))),
    }
}

async fn weather_current_response(
    state: &AppState,
    headers: &HeaderMap,
    query: &HashMap<String, String>,
) -> Result<Value, ApiError> {
    let cache_key = weather_current_cache_key(headers, query);
    let now = Utc::now().timestamp_millis();
    let cached = match cached_widget_by_key(state, SD_WEATHER_KIND, &cache_key).await {
        Ok(row) => row,
        Err(error) => {
            tracing::warn!(?error, %cache_key, "failed to read weather current cache");
            None
        }
    };
    if let Some(row) = cached.as_ref()
        && cache_is_current(row.expires_at, now)
    {
        return Ok(cached_widget_response(row.data.clone(), &row.source_status));
    }

    match fetch_live_weather_widget_data(state, headers, "/api/weather/current", query).await {
        Ok(data) => {
            if let Err(error) = cache_widget_payload(
                state,
                SD_WEATHER_KIND,
                &cache_key,
                &data,
                Some(now + SD_WEATHER_CURRENT_CACHE_TTL_MS),
                "ok",
                now,
            )
            .await
            {
                tracing::warn!(?error, %cache_key, "failed to write weather current cache");
            }
            Ok(cached_widget_response(data, "ok"))
        }
        Err(source_error) => {
            if let Some(row) = cached {
                return Ok(cached_widget_response(row.data, "stale"));
            }
            Err(ApiError::bad_gateway(format!(
                "weather_source_unavailable: {source_error}"
            )))
        }
    }
}

fn weather_current_cache_key(headers: &HeaderMap, query: &HashMap<String, String>) -> String {
    let kind = query
        .get("type")
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("city");
    if let Some(location) = query
        .get("location")
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return format!("current:{kind}:location:{location}");
    }
    if let Some(coords) = query
        .get("coords")
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return format!("current:{kind}:coords:{coords}");
    }
    let client_ip = request_ip_from_headers(headers).unwrap_or("127.0.0.1");
    format!("current:{kind}:ip:{}", client_ip.trim())
}

async fn fetch_live_weather_widget_data(
    state: &AppState,
    headers: &HeaderMap,
    path: &str,
    query: &HashMap<String, String>,
) -> Result<Value, String> {
    match path {
        "/api/weather/location" => {
            let location = if has_query_value(query, "coords") {
                let location = fetch_location(
                    &state.http,
                    CodelifeLocationLookup {
                        coords: query.get("coords").map(String::as_str),
                        forwarded_ip: None,
                    },
                )
                .await?;
                location_to_value(&location, "ok")
            } else {
                crate::ip_lookup::weather_location_from_request_ip(
                    state,
                    headers,
                    query_bool(query, "refresh"),
                )
                .await?
            };
            Ok(location)
        }
        "/api/weather/search" => {
            let keyword = query
                .get("keyword")
                .or_else(|| query.get("location"))
                .map(String::as_str)
                .unwrap_or_default()
                .trim();
            if keyword.is_empty() {
                return Ok(Value::Array(Vec::new()));
            }
            let cities = search_weather_city(&state.http, keyword).await?;
            Ok(Value::Array(
                cities
                    .iter()
                    .map(|location| location_to_value(location, "ok"))
                    .collect(),
            ))
        }
        "/api/weather/current" => {
            let kind = query
                .get("type")
                .map(String::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("city");
            let location_id = if let Some(location) = query
                .get("location")
                .map(String::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                location.to_string()
            } else if !has_query_value(query, "coords") {
                let location = crate::ip_lookup::weather_location_from_request_ip(
                    state,
                    headers,
                    query_bool(query, "refresh"),
                )
                .await?;
                clean_optional(
                    location
                        .get("id")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                )
            } else {
                let location = fetch_location(
                    &state.http,
                    CodelifeLocationLookup {
                        coords: query.get("coords").map(String::as_str),
                        forwarded_ip: None,
                    },
                )
                .await?;
                clean_optional(location.id)
            };
            if location_id.is_empty() {
                return Err("missing_weather_location".to_string());
            }
            fetch_weather_current_bundle(state, &location_id, kind).await
        }
        _ => Err("unsupported_weather_path".to_string()),
    }
}

async fn fetch_weather_current_bundle(
    state: &AppState,
    location_id: &str,
    kind: &str,
) -> Result<Value, String> {
    match fetch_codelife_weather_current_bundle(&state.http, location_id, kind).await {
        Ok(bundle) => Ok(bundle),
        Err(codelife_error) => {
            if state.config.qweather_enabled() {
                match fetch_qweather_weather_bundle(&state.http, &state.config, location_id).await {
                    Ok(bundle) => return Ok(bundle),
                    Err(qweather_error) => {
                        return Err(format!(
                            "codelife-weather: {codelife_error}; qweather-weather: {qweather_error}"
                        ));
                    }
                }
            }
            Err(format!("codelife-weather: {codelife_error}"))
        }
    }
}

async fn fetch_codelife_weather_current_bundle(
    client: &Client,
    location_id: &str,
    kind: &str,
) -> Result<Value, String> {
    let current = fetch_weather_current(client, location_id, kind).await?;
    let hourly = fetch_weather_hourly(client, location_id, kind).await?;
    Ok(json!({
        "sourceStatus": "ok",
        "provider": "codelife",
        "current": current,
        "hourly": hourly
    }))
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
                SD_DAILY_ENGLISH_KIND,
                &["imageSourceUrl"],
                "daily_english_image",
            )
            .await
        }
        "audio" => {
            cached_widget_media(
                &state,
                SD_DAILY_ENGLISH_KIND,
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
                SD_MOVIE_CALENDAR_KIND,
                &["posterSourceUrl"],
                "movie_calendar_poster",
            )
            .await
        }
        "cover" => {
            cached_widget_media(
                &state,
                SD_MOVIE_CALENDAR_KIND,
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

    if source_url.is_none() && state.remote_widget_fetch_enabled {
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
        .map(|length| length as usize > SD_MEDIA_PROXY_MAX_BYTES)
        .unwrap_or(false)
    {
        return Err(ApiError::bad_gateway("media_too_large"));
    }
    let headers_in = response.headers().clone();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| ApiError::bad_gateway(err.to_string()))?;
    if bytes.len() > SD_MEDIA_PROXY_MAX_BYTES {
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
        "/api/today-english" => SD_DAILY_ENGLISH_KIND,
        "/api/movie-calendar" => SD_MOVIE_CALENDAR_KIND,
        "/api/bing-wallpapers" => SD_BING_WALLPAPER_KIND,
        "/api/weather/location" | "/api/weather/search" | "/api/weather/current" => SD_WEATHER_KIND,
        "/api/poem" => SD_POEM_KIND,
        _ => "unknown",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_weather_current_cache_key_from_location_coords_or_ip() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", HeaderValue::from_static("8.8.8.8"));

        let mut location_query = HashMap::new();
        location_query.insert("location".to_string(), "101280608".to_string());
        location_query.insert("type".to_string(), "city".to_string());
        assert_eq!(
            weather_current_cache_key(&headers, &location_query),
            "current:city:location:101280608"
        );

        let mut coords_query = HashMap::new();
        coords_query.insert("coords".to_string(), "114.04,22.65".to_string());
        assert_eq!(
            weather_current_cache_key(&headers, &coords_query),
            "current:city:coords:114.04,22.65"
        );

        assert_eq!(
            weather_current_cache_key(&headers, &HashMap::new()),
            "current:city:ip:8.8.8.8"
        );
    }

    #[test]
    fn missing_cache_expiry_is_not_current_for_dynamic_widgets() {
        assert!(!cache_is_current(None, 1000));
        assert!(!cache_is_current(Some(999), 1000));
        assert!(cache_is_current(Some(1001), 1000));
    }
}
