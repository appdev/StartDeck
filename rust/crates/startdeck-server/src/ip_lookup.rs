use std::collections::HashMap;
use std::net::IpAddr;

use axum::Json;
use axum::extract::{Query, State};
use axum::http::HeaderMap;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{ApiError, AppState, is_blocked_ip};

#[derive(Debug, Deserialize)]
struct TimelessqIpRegionResponse {
    errno: i64,
    errmsg: String,
    data: Option<TimelessqIpRegionData>,
}

#[derive(Debug, Deserialize)]
struct TimelessqIpRegionData {
    ip: String,
    country: String,
    province: String,
    city: String,
    isp: String,
}

pub(crate) async fn ip_info(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .unwrap_or("127.0.0.1");
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
    if !state.remote_itab_fetch_enabled {
        return Ok(Json(local_ip_response(
            query_ip.unwrap_or(client_ip),
            client_ip,
        )));
    }

    let lookup_ip = query_ip.or_else(|| public_ipv4(client_ip));
    match fetch_ip_region(&state.http, lookup_ip).await {
        Ok(data) => Ok(Json(json!({
            "success": true,
            "ip": data.ip,
            "queryIp": data.ip,
            "clientIp": client_ip,
            "clientIpSource": "request-header",
            "location": join_location_parts([
                data.country.as_str(),
                data.province.as_str(),
                data.city.as_str(),
                data.isp.as_str(),
            ]),
            "country": data.country,
            "region": data.province,
            "province": data.province,
            "city": data.city,
            "isp": data.isp,
            "network": data.isp,
            "cached": false,
            "source": "timelessq-ip-to-region",
            "sourceStatus": "ok"
        }))),
        Err(error) => {
            let fallback_ip = query_ip.unwrap_or(client_ip);
            Ok(Json(json!({
                "success": false,
                "error": format!("ip_region_unavailable: {error}"),
                "ip": fallback_ip,
                "queryIp": fallback_ip,
                "clientIp": client_ip,
                "clientIpSource": "request-header",
                "location": "本机 本地网络",
                "country": "本机",
                "region": "本地网络",
                "province": "本地网络",
                "city": "本机",
                "isp": "本地网络",
                "network": "本地网络",
                "cached": false,
                "source": "rust-local-fallback",
                "sourceStatus": "error"
            })))
        }
    }
}

async fn fetch_ip_region(
    client: &Client,
    query_ip: Option<&str>,
) -> Result<TimelessqIpRegionData, String> {
    let mut request = client.get("https://api.timelessq.com/ip-to-region");
    if let Some(ip) = query_ip {
        request = request.query(&[("ip", ip)]);
    }
    let response = request.send().await.map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("source_status_{status}"));
    }
    let payload = response
        .json::<TimelessqIpRegionResponse>()
        .await
        .map_err(|err| err.to_string())?;
    if payload.errno != 0 {
        return Err(if payload.errmsg.is_empty() {
            format!("source_errno_{}", payload.errno)
        } else {
            payload.errmsg
        });
    }
    payload
        .data
        .ok_or_else(|| "missing_source_data".to_string())
}

fn join_location_parts<'a>(parts: impl IntoIterator<Item = &'a str>) -> String {
    parts
        .into_iter()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn public_ipv4(raw: &str) -> Option<&str> {
    if let Ok(ip @ IpAddr::V4(_)) = raw.parse::<IpAddr>()
        && !is_blocked_ip(ip)
    {
        return Some(raw);
    }
    None
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
        "city": "本机",
        "isp": "本地网络",
        "network": "本地网络",
        "cached": false,
        "source": "rust-local",
        "sourceStatus": "ok"
    })
}
