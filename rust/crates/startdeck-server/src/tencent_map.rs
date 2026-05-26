use reqwest::Client;
use reqwest::header::{ACCEPT, USER_AGENT};
use serde::Deserialize;
use startdeck_core::RuntimeConfig;

const TENCENT_MAP_USER_AGENT: &str = "StartDeck/0.1 (+https://startdeck.local)";

#[derive(Debug, Deserialize)]
struct TencentMapIpEnvelope {
    status: i64,
    message: String,
    result: Option<TencentMapIpLocation>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct TencentMapIpLocation {
    pub(crate) ip: Option<String>,
    pub(crate) location: Option<TencentMapCoordinate>,
    #[serde(rename = "ad_info")]
    pub(crate) ad_info: Option<TencentMapAdInfo>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct TencentMapCoordinate {
    pub(crate) lat: f64,
    pub(crate) lng: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct TencentMapAdInfo {
    pub(crate) nation: Option<String>,
    pub(crate) province: Option<String>,
    pub(crate) city: Option<String>,
    pub(crate) district: Option<String>,
}

pub(crate) async fn lookup_ip_location(
    client: &Client,
    config: &RuntimeConfig,
    ip: &str,
) -> Result<TencentMapIpLocation, String> {
    let ip = ip.trim();
    if ip.is_empty() {
        return Err("tencent_map_ip_empty".to_string());
    }
    let api_host = config.tencent_map_api_host.trim_end_matches('/');
    if api_host.is_empty() {
        return Err("tencent_map_api_host_empty".to_string());
    }
    let key = config.tencent_map_key.trim();
    if key.is_empty() {
        return Err("tencent_map_key_empty".to_string());
    }
    let response = client
        .get(format!("{api_host}/ws/location/v1/ip"))
        .query(&[("ip", ip), ("key", key)])
        .header(ACCEPT, "application/json")
        .header(USER_AGENT, TENCENT_MAP_USER_AGENT)
        .send()
        .await
        .map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("tencent_map_http_status_{status}"));
    }
    let payload = response
        .json::<TencentMapIpEnvelope>()
        .await
        .map_err(|err| err.to_string())?;
    if payload.status != 0 {
        return Err(format!(
            "tencent_map_status_{}: {}",
            payload.status, payload.message
        ));
    }
    payload
        .result
        .ok_or_else(|| "tencent_map_result_empty".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tencent_map_ip_location_response() {
        let payload = serde_json::from_str::<TencentMapIpEnvelope>(
            r#"{
              "status": 0,
              "message": "query ok",
              "result": {
                "ip": "163.125.214.27",
                "location": { "lat": 23.12908, "lng": 113.26436 },
                "ad_info": {
                  "nation": "中国",
                  "province": "广东省",
                  "city": "广州市",
                  "district": "",
                  "adcode": 440100
                }
              }
            }"#,
        )
        .unwrap();
        let result = payload.result.unwrap();

        assert_eq!(payload.status, 0);
        assert_eq!(result.ip.as_deref(), Some("163.125.214.27"));
        assert_eq!(result.ad_info.unwrap().city.as_deref(), Some("广州市"));
        let coordinate = result.location.unwrap();
        assert_eq!(coordinate.lat.to_string(), "23.12908");
        assert_eq!(coordinate.lng.to_string(), "113.26436");
    }
}
