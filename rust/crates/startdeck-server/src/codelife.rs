use std::net::IpAddr;

use axum::http::HeaderMap;
use reqwest::Client;
use reqwest::header::{ACCEPT, USER_AGENT};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};

use crate::is_blocked_ip;
use crate::upstream_allowlist::CODELIFE_BASE_URL;

const CODELIFE_USER_AGENT: &str = "StartDeck/0.1 (+https://startdeck.local)";

#[derive(Debug, Deserialize)]
struct CodelifeEnvelope<T> {
    code: i64,
    data: Option<T>,
    msg: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CodelifeLocation {
    pub(crate) name: Option<String>,
    pub(crate) id: Option<String>,
    pub(crate) lat: Option<String>,
    pub(crate) lon: Option<String>,
    pub(crate) adm2: Option<String>,
    pub(crate) adm1: Option<String>,
    pub(crate) country: Option<String>,
    pub(crate) tz: Option<String>,
    #[serde(rename = "utcOffset")]
    pub(crate) utc_offset: Option<String>,
    #[serde(rename = "isDst")]
    pub(crate) is_dst: Option<String>,
    #[serde(rename = "type")]
    pub(crate) kind: Option<String>,
    pub(crate) rank: Option<String>,
    #[serde(rename = "fxLink")]
    pub(crate) fx_link: Option<String>,
    pub(crate) ip: Option<String>,
    pub(crate) location: Option<String>,
    pub(crate) label: Option<String>,
}

pub(crate) struct CodelifeLocationLookup<'a> {
    pub(crate) coords: Option<&'a str>,
    pub(crate) forwarded_ip: Option<&'a str>,
}

pub(crate) fn request_ip_from_headers(headers: &HeaderMap) -> Option<&str> {
    headers
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
}

pub(crate) fn public_ipv4(raw: &str) -> Option<&str> {
    if let Ok(ip @ IpAddr::V4(_)) = raw.parse::<IpAddr>()
        && !is_blocked_ip(ip)
    {
        return Some(raw);
    }
    None
}

pub(crate) async fn fetch_location(
    client: &Client,
    lookup: CodelifeLocationLookup<'_>,
) -> Result<CodelifeLocation, String> {
    let mut request = codelife_get(client, "/api/getLocation").query(&[("lang", "cn")]);
    if let Some(coords) = lookup
        .coords
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        request = request.query(&[("coords", coords)]);
    }
    if let Some(ip) = lookup
        .forwarded_ip
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        request = request.header("x-forwarded-for", ip);
    }
    let payload = send_envelope::<CodelifeLocation>(request).await?;
    require_payload(payload, "location")
}

pub(crate) async fn fetch_weather_current(
    client: &Client,
    location: &str,
    kind: &str,
) -> Result<Value, String> {
    let payload = send_envelope::<Value>(codelife_get(client, "/api/getWeather").query(&[
        ("lang", "cn"),
        ("location", location),
        ("type", kind),
    ]))
    .await?;
    let data = require_payload(payload, "weather")?;
    if data.get("status").and_then(Value::as_str) != Some("ok") {
        return Err("weather_status_not_ok".to_string());
    }
    Ok(data)
}

pub(crate) async fn fetch_weather_hourly(
    client: &Client,
    location: &str,
    kind: &str,
) -> Result<Value, String> {
    let payload = send_envelope::<Value>(codelife_get(client, "/api/weather/24").query(&[
        ("lang", "cn"),
        ("location", location),
        ("type", kind),
    ]))
    .await?;
    require_payload(payload, "weather_hourly")
}

pub(crate) async fn search_weather_city(
    client: &Client,
    location: &str,
) -> Result<Vec<CodelifeLocation>, String> {
    let payload = send_envelope::<Vec<CodelifeLocation>>(
        codelife_get(client, "/api/weather/city").query(&[("lang", "cn"), ("location", location)]),
    )
    .await?;
    Ok(payload.data.unwrap_or_default())
}

pub(crate) fn location_to_value(location: &CodelifeLocation, source_status: &str) -> Value {
    json!({
        "name": clean_ref(&location.name),
        "id": clean_ref(&location.id),
        "lat": clean_ref(&location.lat),
        "lon": clean_ref(&location.lon),
        "adm2": clean_ref(&location.adm2),
        "adm1": clean_ref(&location.adm1),
        "country": clean_ref(&location.country),
        "tz": clean_ref(&location.tz),
        "utcOffset": clean_ref(&location.utc_offset),
        "isDst": clean_ref(&location.is_dst),
        "type": clean_ref(&location.kind),
        "rank": clean_ref(&location.rank),
        "fxLink": clean_ref(&location.fx_link),
        "ip": clean_ref(&location.ip),
        "location": clean_ref(&location.location),
        "label": clean_ref(&location.label),
        "sourceStatus": source_status
    })
}

pub(crate) fn location_coordinates(location: &CodelifeLocation) -> (String, String) {
    let (pair_lon, pair_lat) = location
        .location
        .as_deref()
        .and_then(|value| value.split_once(','))
        .map(|(lon, lat)| (lon.trim().to_string(), lat.trim().to_string()))
        .unwrap_or_default();
    let latitude = first_non_empty([pair_lat, clean_ref(&location.lat)]);
    let longitude = first_non_empty([pair_lon, clean_ref(&location.lon)]);
    (latitude, longitude)
}

pub(crate) fn clean_ref(value: &Option<String>) -> String {
    value.as_deref().unwrap_or_default().trim().to_string()
}

fn codelife_get(client: &Client, path: &str) -> reqwest::RequestBuilder {
    client
        .get(format!("{CODELIFE_BASE_URL}{path}"))
        .header(ACCEPT, "application/json")
        .header(USER_AGENT, CODELIFE_USER_AGENT)
}

async fn send_envelope<T: DeserializeOwned>(
    request: reqwest::RequestBuilder,
) -> Result<CodelifeEnvelope<T>, String> {
    let response = request.send().await.map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("source_status_{status}"));
    }
    let payload = response
        .json::<CodelifeEnvelope<T>>()
        .await
        .map_err(|err| err.to_string())?;
    if payload.code != 200 {
        return Err(payload
            .msg
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| format!("source_code_{}", payload.code)));
    }
    Ok(payload)
}

fn require_payload<T>(payload: CodelifeEnvelope<T>, name: &str) -> Result<T, String> {
    payload.data.ok_or_else(|| format!("missing_{name}_data"))
}

fn first_non_empty<const N: usize>(values: [String; N]) -> String {
    values
        .into_iter()
        .find(|value| !value.trim().is_empty())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_coordinates_from_location_pair_when_fields_are_missing() {
        let location = CodelifeLocation {
            name: None,
            id: None,
            lat: None,
            lon: None,
            adm2: None,
            adm1: None,
            country: None,
            tz: None,
            utc_offset: None,
            is_dst: None,
            kind: None,
            rank: None,
            fx_link: None,
            ip: None,
            location: Some("120.155070,30.274084".to_string()),
            label: None,
        };

        assert_eq!(
            location_coordinates(&location),
            ("30.274084".to_string(), "120.155070".to_string())
        );
    }
}
