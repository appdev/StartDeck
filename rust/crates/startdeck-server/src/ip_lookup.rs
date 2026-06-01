use std::collections::HashMap;
use std::net::IpAddr;

use axum::Json;
use axum::extract::{Query, State};
use axum::http::HeaderMap;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use sqlx::{Row, SqlitePool};

use crate::codelife::{
    CodelifeLocation, CodelifeLocationLookup, clean_ref, fetch_location, location_coordinates,
    public_ipv4, request_ip_from_headers,
};
use crate::tencent_map::{
    TencentMapIpLocation, lookup_ip_location as lookup_tencent_map_ip_location,
};
use crate::{ApiError, AppState};

const IP_CACHE_TTL_MS: i64 = 30 * 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IpLocationModel {
    success: bool,
    ip: String,
    lookup_ip: String,
    location: String,
    country: String,
    region: String,
    province: String,
    adm2: String,
    city: String,
    district: String,
    weather_location_id: String,
    weather_location_type: String,
    weather_fx_link: String,
    isp: String,
    network: String,
    latitude: String,
    longitude: String,
    coordinate_source: String,
    coordinate_accuracy: String,
    source: String,
    source_status: String,
}

struct CachedIpLocation {
    model: IpLocationModel,
    cached_at: i64,
    expires_at: i64,
}

pub(crate) async fn ip_info(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let query_ip = query
        .get("ip")
        .or_else(|| query.get("query"))
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if let Some(ip) = query_ip
        && !matches!(ip.parse::<IpAddr>(), Ok(IpAddr::V4(_)))
    {
        return Err(ApiError::bad_request("invalid_ipv4"));
    }
    let refresh = query
        .get("refresh")
        .map(String::as_str)
        .is_some_and(is_truthy);
    let username = crate::optional_username_from_headers(&headers, &state)?;
    let user_ip = if query_ip.is_none() {
        request_ip_from_headers(&headers).and_then(public_ipv4)
    } else {
        None
    };
    let response = resolve_ip_location_response(&state, &headers, query_ip, refresh).await;
    if let (Some(username), Some(ip)) = (username.as_deref(), user_ip)
        && let Err(error) = record_user_ip_location(&state.pool, username, ip).await
    {
        tracing::warn!(%error, %username, %ip, "failed to record user ip location marker");
    }
    Ok(Json(response))
}

pub(crate) async fn user_ip_history(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let username = crate::require_username(&headers, &state)?;
    let rows = sqlx::query(
        r#"SELECT u.ip, u.first_seen_at, u.last_seen_at, u.seen_count,
                  c.model_json, c.source, c.source_status, c.cached_at, c.expires_at
           FROM user_ip_locations u
           LEFT JOIN ip_location_cache c ON c.ip = u.ip
           WHERE u.username = ?
           ORDER BY u.last_seen_at DESC"#,
    )
    .bind(&username)
    .fetch_all(&state.pool)
    .await?;
    let now = Utc::now().timestamp_millis();
    let entries = rows
        .into_iter()
        .map(|row| user_ip_history_row_to_value(&row, now))
        .collect::<Vec<_>>();
    Ok(Json(json!({
        "success": true,
        "username": username,
        "data": entries
    })))
}

pub(crate) async fn resolve_ip_location_response(
    state: &AppState,
    headers: &HeaderMap,
    query_ip: Option<&str>,
    refresh: bool,
) -> Value {
    let client_ip = request_ip_from_headers(headers).unwrap_or("127.0.0.1");
    if !state.remote_widget_fetch_enabled {
        return local_ip_response(query_ip.unwrap_or(client_ip), client_ip);
    }

    let lookup_ip = query_ip
        .and_then(public_ipv4)
        .or_else(|| public_ipv4(client_ip));
    if let (Some(query_ip), None) = (query_ip, lookup_ip) {
        return local_ip_response(query_ip, client_ip);
    }
    let Some(lookup_ip) = lookup_ip else {
        return local_ip_response(query_ip.unwrap_or(client_ip), client_ip);
    };

    let now = Utc::now().timestamp_millis();
    if refresh && let Err(error) = delete_ip_cache(&state.pool, lookup_ip).await {
        tracing::warn!(%error, %lookup_ip, "failed to delete refreshed ip cache row");
    }
    if !refresh {
        match read_ip_cache(&state.pool, lookup_ip, now).await {
            Ok(Some(cached)) => {
                return model_to_response(
                    &cached.model,
                    query_ip,
                    client_ip,
                    true,
                    Some(cached.cached_at),
                    Some(cached.expires_at),
                );
            }
            Ok(None) => {}
            Err(error) => {
                tracing::warn!(%error, %lookup_ip, "failed to read ip location cache");
            }
        }
    }

    match fetch_provider_model(state, query_ip, client_ip, lookup_ip).await {
        Ok(model) => {
            let cached_at = Utc::now().timestamp_millis();
            let expires_at = cached_at + IP_CACHE_TTL_MS;
            if let Err(error) = write_ip_cache(&state.pool, &model, cached_at, expires_at).await {
                tracing::warn!(%error, %lookup_ip, "failed to write ip location cache");
            }
            model_to_response(
                &model,
                query_ip,
                client_ip,
                false,
                Some(cached_at),
                Some(expires_at),
            )
        }
        Err(error) => error_ip_response(query_ip.unwrap_or(client_ip), client_ip, error),
    }
}

pub(crate) async fn weather_location_from_request_ip(
    state: &AppState,
    headers: &HeaderMap,
    refresh: bool,
) -> Result<Value, String> {
    let response = resolve_ip_location_response(state, headers, None, refresh).await;
    if response.get("success").and_then(Value::as_bool) == Some(false) {
        return Err(value_str(&response, "error")
            .filter(|value| !value.is_empty())
            .unwrap_or("ip_location_unavailable")
            .to_string());
    }
    ip_response_to_weather_location(&response).ok_or_else(|| "missing_weather_location".to_string())
}

fn ip_response_to_weather_location(response: &Value) -> Option<Value> {
    let weather_location_id = value_str(response, "weatherLocationId")?;
    if weather_location_id.trim().is_empty() {
        return None;
    }
    let latitude = value_str(response, "latitude").unwrap_or_default();
    let longitude = value_str(response, "longitude").unwrap_or_default();
    let location = if latitude.is_empty() || longitude.is_empty() {
        String::new()
    } else {
        format!("{longitude},{latitude}")
    };
    Some(json!({
        "name": first_non_empty([
            value_str(response, "city").unwrap_or_default().to_string(),
            value_str(response, "district").unwrap_or_default().to_string(),
            value_str(response, "adm2").unwrap_or_default().to_string(),
            value_str(response, "region").unwrap_or_default().to_string(),
        ]),
        "id": weather_location_id,
        "lat": latitude,
        "lon": longitude,
        "adm2": value_str(response, "adm2").unwrap_or_default(),
        "adm1": value_str(response, "province")
            .or_else(|| value_str(response, "region"))
            .unwrap_or_default(),
        "country": value_str(response, "country").unwrap_or_default(),
        "tz": "",
        "utcOffset": "",
        "isDst": "",
        "type": value_str(response, "weatherLocationType").unwrap_or("city"),
        "rank": "",
        "fxLink": value_str(response, "weatherFxLink").unwrap_or_default(),
        "ip": value_str(response, "ip").unwrap_or_default(),
        "location": location,
        "label": value_str(response, "location").unwrap_or_default(),
        "sourceStatus": value_str(response, "sourceStatus").unwrap_or("ok")
    }))
}

async fn fetch_provider_model(
    state: &AppState,
    query_ip: Option<&str>,
    client_ip: &str,
    lookup_ip: &str,
) -> Result<IpLocationModel, String> {
    let mut errors = Vec::new();
    let mut primary_without_coordinates: Option<IpLocationModel> = None;

    match fetch_location(
        &state.http,
        CodelifeLocationLookup {
            coords: None,
            forwarded_ip: Some(lookup_ip),
        },
    )
    .await
    {
        Ok(location) => {
            let model = codelife_ip_model(&location, query_ip, client_ip, lookup_ip);
            if has_coordinates(&model) {
                return Ok(model);
            }
            primary_without_coordinates = Some(model);
        }
        Err(error) => errors.push(format!("codelife-getLocation: {error}")),
    }

    match lookup_tencent_map_ip_location(&state.http, &state.config, lookup_ip).await {
        Ok(location) => {
            let weather_location = if let Some(coords) = tencent_map_coordinate_pair(&location) {
                match fetch_location(
                    &state.http,
                    CodelifeLocationLookup {
                        coords: Some(&coords),
                        forwarded_ip: None,
                    },
                )
                .await
                {
                    Ok(weather_location) => Some(weather_location),
                    Err(error) => {
                        errors.push(format!("codelife-coordinates: {error}"));
                        None
                    }
                }
            } else {
                None
            };
            let model = tencent_map_ip_model(
                &location,
                query_ip,
                client_ip,
                lookup_ip,
                weather_location.as_ref(),
            );
            if has_coordinates(&model) {
                return Ok(model);
            }
            if primary_without_coordinates.is_none() {
                primary_without_coordinates = Some(model);
            }
        }
        Err(error) => {
            errors.push(format!("tencent-map-ip: {error}"));
        }
    }

    if let Some(model) = primary_without_coordinates {
        return Ok(model);
    }
    Err(errors.join("; "))
}

fn tencent_map_ip_model(
    data: &TencentMapIpLocation,
    query_ip: Option<&str>,
    client_ip: &str,
    lookup_ip: &str,
    weather_location: Option<&CodelifeLocation>,
) -> IpLocationModel {
    let country = clean_str_option(
        data.ad_info
            .as_ref()
            .and_then(|value| value.nation.as_ref()),
    );
    let province = clean_str_option(
        data.ad_info
            .as_ref()
            .and_then(|value| value.province.as_ref()),
    );
    let city = clean_str_option(data.ad_info.as_ref().and_then(|value| value.city.as_ref()));
    let district = clean_str_option(
        data.ad_info
            .as_ref()
            .and_then(|value| value.district.as_ref()),
    );
    let ip = clean_str_option(data.ip.as_ref());
    let (latitude, longitude) = data
        .location
        .as_ref()
        .map(|coordinate| {
            (
                format_coordinate(coordinate.lat),
                format_coordinate(coordinate.lng),
            )
        })
        .unwrap_or_default();
    IpLocationModel {
        success: true,
        ip: if ip.is_empty() {
            query_ip.unwrap_or(client_ip).to_string()
        } else {
            ip
        },
        lookup_ip: lookup_ip.to_string(),
        location: join_location_parts([
            country.as_str(),
            province.as_str(),
            city.as_str(),
            district.as_str(),
        ]),
        country,
        region: province.clone(),
        province,
        adm2: city.clone(),
        city,
        district,
        weather_location_id: weather_location
            .map(|location| clean_ref(&location.id))
            .unwrap_or_default(),
        weather_location_type: weather_location
            .map(|location| clean_ref(&location.kind))
            .unwrap_or_default(),
        weather_fx_link: weather_location
            .map(|location| clean_ref(&location.fx_link))
            .unwrap_or_default(),
        isp: String::new(),
        network: String::new(),
        latitude,
        longitude,
        coordinate_source: "tencent-map-ip".to_string(),
        coordinate_accuracy: "ip-geolocation".to_string(),
        source: "tencent-map-ip".to_string(),
        source_status: "ok".to_string(),
    }
}

fn codelife_ip_model(
    data: &CodelifeLocation,
    query_ip: Option<&str>,
    client_ip: &str,
    lookup_ip: &str,
) -> IpLocationModel {
    let country = clean_ref(&data.country);
    let province = clean_ref(&data.adm1);
    let adm2 = clean_ref(&data.adm2);
    let city = clean_ref(&data.name);
    let ip = clean_ref(&data.ip);
    let (latitude, longitude) = location_coordinates(data);
    IpLocationModel {
        success: true,
        ip: if ip.is_empty() {
            query_ip.unwrap_or(client_ip).to_string()
        } else {
            ip
        },
        lookup_ip: lookup_ip.to_string(),
        location: join_location_parts([
            country.as_str(),
            province.as_str(),
            adm2.as_str(),
            city.as_str(),
        ]),
        country,
        region: province.clone(),
        province,
        adm2,
        city: city.clone(),
        district: city,
        weather_location_id: clean_ref(&data.id),
        weather_location_type: clean_ref(&data.kind),
        weather_fx_link: clean_ref(&data.fx_link),
        isp: String::new(),
        network: String::new(),
        latitude,
        longitude,
        coordinate_source: "codelife-getLocation".to_string(),
        coordinate_accuracy: "ip-geolocation".to_string(),
        source: "codelife-getLocation".to_string(),
        source_status: "ok".to_string(),
    }
}

fn model_to_response(
    model: &IpLocationModel,
    query_ip: Option<&str>,
    client_ip: &str,
    cached: bool,
    cached_at: Option<i64>,
    expires_at: Option<i64>,
) -> Value {
    let mut value = serde_json::to_value(model).unwrap_or_else(|_| json!({}));
    if !value.is_object() {
        value = Value::Object(Map::new());
    }
    let object = value.as_object_mut().expect("ip model json object");
    let response_query_ip = query_ip.unwrap_or(if model.ip.is_empty() {
        client_ip
    } else {
        model.ip.as_str()
    });
    object.insert("queryIp".to_string(), json!(response_query_ip));
    object.insert("clientIp".to_string(), json!(client_ip));
    object.insert("clientIpSource".to_string(), json!("request-header"));
    object.insert("cached".to_string(), json!(cached));
    if let Some(cached_at) = cached_at {
        object.insert("cachedAt".to_string(), json!(cached_at));
    }
    if let Some(expires_at) = expires_at {
        object.insert("expiresAt".to_string(), json!(expires_at));
    }
    value
}

async fn read_ip_cache(
    pool: &SqlitePool,
    ip: &str,
    now: i64,
) -> Result<Option<CachedIpLocation>, String> {
    let row = sqlx::query(
        "SELECT model_json, cached_at, expires_at FROM ip_location_cache WHERE ip = ? LIMIT 1",
    )
    .bind(ip)
    .fetch_optional(pool)
    .await
    .map_err(|err| err.to_string())?;
    let Some(row) = row else {
        return Ok(None);
    };
    let expires_at = row.get::<i64, _>("expires_at");
    if expires_at <= now {
        delete_ip_cache(pool, ip).await?;
        return Ok(None);
    }
    let model_json = row.get::<String, _>("model_json");
    let model = match serde_json::from_str::<IpLocationModel>(&model_json) {
        Ok(model) => model,
        Err(error) => {
            delete_ip_cache(pool, ip).await?;
            return Err(format!("invalid_cached_ip_model: {error}"));
        }
    };
    Ok(Some(CachedIpLocation {
        model,
        cached_at: row.get::<i64, _>("cached_at"),
        expires_at,
    }))
}

async fn write_ip_cache(
    pool: &SqlitePool,
    model: &IpLocationModel,
    cached_at: i64,
    expires_at: i64,
) -> Result<(), String> {
    let model_json = serde_json::to_string(model).map_err(|err| err.to_string())?;
    sqlx::query(
        r#"INSERT INTO ip_location_cache(ip, model_json, source, source_status, cached_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(ip) DO UPDATE SET
             model_json=excluded.model_json,
             source=excluded.source,
             source_status=excluded.source_status,
             cached_at=excluded.cached_at,
             expires_at=excluded.expires_at"#,
    )
    .bind(&model.lookup_ip)
    .bind(model_json)
    .bind(&model.source)
    .bind(&model.source_status)
    .bind(cached_at)
    .bind(expires_at)
    .execute(pool)
    .await
    .map_err(|err| err.to_string())?;
    Ok(())
}

async fn record_user_ip_location(
    pool: &SqlitePool,
    username: &str,
    ip: &str,
) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();
    sqlx::query(
        r#"INSERT INTO user_ip_locations(username, ip, first_seen_at, last_seen_at, seen_count)
           VALUES (?, ?, ?, ?, 1)
           ON CONFLICT(username, ip) DO UPDATE SET
             last_seen_at=excluded.last_seen_at,
             seen_count=user_ip_locations.seen_count + 1"#,
    )
    .bind(username)
    .bind(ip)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|err| err.to_string())?;
    Ok(())
}

fn user_ip_history_row_to_value(row: &sqlx::sqlite::SqliteRow, now: i64) -> Value {
    let ip = row.get::<String, _>("ip");
    let first_seen_at = row.get::<i64, _>("first_seen_at");
    let last_seen_at = row.get::<i64, _>("last_seen_at");
    let seen_count = row.get::<i64, _>("seen_count");
    let mut value = json!({
        "ip": ip,
        "firstSeenAt": first_seen_at,
        "lastSeenAt": last_seen_at,
        "seenCount": seen_count,
        "cached": false,
        "sourceStatus": ""
    });
    let model_json = row.try_get::<String, _>("model_json").ok();
    let expires_at = row.try_get::<i64, _>("expires_at").ok();
    if let (Some(model_json), Some(expires_at)) = (model_json, expires_at)
        && let Ok(model) = serde_json::from_str::<IpLocationModel>(&model_json)
    {
        let cache_is_fresh = expires_at > now;
        value = model_to_response(
            &model,
            Some(ip.as_str()),
            ip.as_str(),
            cache_is_fresh,
            row.try_get::<i64, _>("cached_at").ok(),
            Some(expires_at),
        );
        if let Value::Object(ref mut object) = value {
            object.insert("firstSeenAt".to_string(), json!(first_seen_at));
            object.insert("lastSeenAt".to_string(), json!(last_seen_at));
            object.insert("seenCount".to_string(), json!(seen_count));
        }
    }
    value
}

async fn delete_ip_cache(pool: &SqlitePool, ip: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM ip_location_cache WHERE ip = ?")
        .bind(ip)
        .execute(pool)
        .await
        .map_err(|err| err.to_string())?;
    Ok(())
}

fn error_ip_response(query_ip: &str, client_ip: &str, error: String) -> Value {
    json!({
        "success": false,
        "error": format!("ip_location_unavailable: {error}"),
        "ip": query_ip,
        "queryIp": query_ip,
        "clientIp": client_ip,
        "clientIpSource": "request-header",
        "location": "本机 本地网络",
        "country": "本机",
        "region": "本地网络",
        "province": "本地网络",
        "adm2": "",
        "city": "本机",
        "district": "本机",
        "isp": "",
        "network": "",
        "latitude": "",
        "longitude": "",
        "coordinateSource": "",
        "coordinateAccuracy": "",
        "cached": false,
        "source": "rust-local-fallback",
        "sourceStatus": "error"
    })
}

fn local_ip_response(query_ip: &str, client_ip: &str) -> Value {
    json!({
        "success": true,
        "ip": query_ip,
        "queryIp": query_ip,
        "clientIp": client_ip,
        "clientIpSource": "request-header",
        "location": "本机 本地网络",
        "country": "本机",
        "region": "本地网络",
        "province": "本地网络",
        "adm2": "",
        "city": "本机",
        "district": "本机",
        "isp": "本地网络",
        "network": "本地网络",
        "latitude": "",
        "longitude": "",
        "coordinateSource": "",
        "coordinateAccuracy": "",
        "cached": false,
        "source": "rust-local",
        "sourceStatus": "ok"
    })
}

fn join_location_parts<'a>(parts: impl IntoIterator<Item = &'a str>) -> String {
    parts
        .into_iter()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn clean_str_option(value: Option<&String>) -> String {
    value
        .map(String::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn tencent_map_coordinate_pair(location: &TencentMapIpLocation) -> Option<String> {
    location.location.as_ref().map(|coordinate| {
        format!(
            "{},{}",
            format_coordinate(coordinate.lng),
            format_coordinate(coordinate.lat)
        )
    })
}

fn format_coordinate(value: f64) -> String {
    let text = format!("{value:.6}");
    text.trim_end_matches('0').trim_end_matches('.').to_string()
}

fn first_non_empty<const N: usize>(values: [String; N]) -> String {
    values
        .into_iter()
        .find(|value| !value.trim().is_empty())
        .unwrap_or_default()
}

fn value_str<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value.get(key).and_then(Value::as_str).map(str::trim)
}

fn has_coordinates(model: &IpLocationModel) -> bool {
    !model.latitude.trim().is_empty() && !model.longitude.trim().is_empty()
}

fn is_truthy(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use startdeck_core::{RuntimeConfig, connect_sqlite};

    fn sample_location() -> CodelifeLocation {
        CodelifeLocation {
            name: Some("拱墅".to_string()),
            id: Some("101210112".to_string()),
            lat: Some("30.31470".to_string()),
            lon: Some("120.15006".to_string()),
            adm2: Some("杭州".to_string()),
            adm1: Some("浙江省".to_string()),
            country: Some("中国".to_string()),
            tz: Some("Asia/Shanghai".to_string()),
            utc_offset: Some("+08:00".to_string()),
            is_dst: Some("0".to_string()),
            kind: Some("city".to_string()),
            rank: Some("35".to_string()),
            fx_link: Some("https://www.qweather.com/weather/gongshu-101210112.html".to_string()),
            ip: Some("121.43.181.220".to_string()),
            location: Some("120.155070,30.274084".to_string()),
            label: None,
        }
    }

    fn sample_model() -> IpLocationModel {
        codelife_ip_model(
            &sample_location(),
            Some("121.43.181.220"),
            "127.0.0.1",
            "121.43.181.220",
        )
    }

    fn sample_tencent_location() -> TencentMapIpLocation {
        TencentMapIpLocation {
            ip: Some("163.125.214.27".to_string()),
            location: Some(crate::tencent_map::TencentMapCoordinate {
                lat: 23.12908,
                lng: 113.26436,
            }),
            ad_info: Some(crate::tencent_map::TencentMapAdInfo {
                nation: Some("中国".to_string()),
                province: Some("广东省".to_string()),
                city: Some("广州市".to_string()),
                district: Some(String::new()),
            }),
        }
    }

    #[test]
    fn builds_ip_model_from_codelife_location_coordinates() {
        let model = sample_model();
        let body = model_to_response(
            &model,
            Some("121.43.181.220"),
            "127.0.0.1",
            false,
            None,
            None,
        );

        assert_eq!(body["source"], "codelife-getLocation");
        assert_eq!(body["ip"], "121.43.181.220");
        assert_eq!(body["location"], "中国 浙江省 杭州 拱墅");
        assert_eq!(body["latitude"], "30.274084");
        assert_eq!(body["longitude"], "120.155070");
        assert_eq!(body["coordinateSource"], "codelife-getLocation");
        assert_eq!(body["weatherLocationId"], "101210112");
        assert_eq!(body["cached"], false);
    }

    #[test]
    fn builds_ip_model_from_tencent_map_location_coordinates() {
        let weather_location = sample_location();
        let model = tencent_map_ip_model(
            &sample_tencent_location(),
            Some("163.125.214.27"),
            "127.0.0.1",
            "163.125.214.27",
            Some(&weather_location),
        );
        let body = model_to_response(
            &model,
            Some("163.125.214.27"),
            "127.0.0.1",
            false,
            None,
            None,
        );

        assert_eq!(body["source"], "tencent-map-ip");
        assert_eq!(body["ip"], "163.125.214.27");
        assert_eq!(body["location"], "中国 广东省 广州市");
        assert_eq!(body["latitude"], "23.12908");
        assert_eq!(body["longitude"], "113.26436");
        assert_eq!(body["coordinateSource"], "tencent-map-ip");
        assert_eq!(body["weatherLocationId"], "101210112");
    }

    #[test]
    fn builds_codelife_coordinate_pair_from_tencent_map_location() {
        let coords = tencent_map_coordinate_pair(&sample_tencent_location()).unwrap();

        assert_eq!(coords, "113.26436,23.12908");
    }

    #[test]
    fn maps_ip_model_to_weather_location_shape() {
        let body = model_to_response(
            &sample_model(),
            Some("121.43.181.220"),
            "127.0.0.1",
            false,
            None,
            None,
        );
        let weather_location = ip_response_to_weather_location(&body).unwrap();

        assert_eq!(weather_location["id"], "101210112");
        assert_eq!(weather_location["name"], "拱墅");
        assert_eq!(weather_location["lat"], "30.274084");
        assert_eq!(weather_location["lon"], "120.155070");
        assert_eq!(weather_location["location"], "120.155070,30.274084");
    }

    #[test]
    fn maps_cached_ip_model_to_weather_location_shape() {
        let body = model_to_response(
            &sample_model(),
            Some("121.43.181.220"),
            "127.0.0.1",
            true,
            Some(100),
            Some(200),
        );
        let weather_location = ip_response_to_weather_location(&body).unwrap();

        assert_eq!(body["cached"], true);
        assert_eq!(weather_location["id"], "101210112");
        assert_eq!(weather_location["name"], "拱墅");
        assert_eq!(weather_location["location"], "120.155070,30.274084");
    }

    #[test]
    fn falls_back_to_local_response_without_coordinates() {
        let body = local_ip_response("127.0.0.1", "127.0.0.1");

        assert_eq!(body["source"], "rust-local");
        assert_eq!(body["latitude"], "");
        assert_eq!(body["longitude"], "");
    }

    #[tokio::test]
    async fn deletes_expired_ip_cache_before_reuse() {
        let temp = tempfile::tempdir().unwrap();
        let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
        let pool = connect_sqlite(&config).await.unwrap();
        let model = sample_model();
        write_ip_cache(&pool, &model, 100, 200).await.unwrap();

        let cached = read_ip_cache(&pool, "121.43.181.220", 199)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(cached.model, model);

        let expired = read_ip_cache(&pool, "121.43.181.220", 200).await.unwrap();
        assert!(expired.is_none());
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM ip_location_cache WHERE ip = ?")
            .bind("121.43.181.220")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);
    }
}
