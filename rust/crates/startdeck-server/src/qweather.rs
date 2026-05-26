use chrono::Utc;
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use reqwest::Client;
use reqwest::header::{ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use startdeck_core::RuntimeConfig;

const QWEATHER_USER_AGENT: &str = "StartDeck/0.1 (+https://startdeck.local)";
const QWEATHER_JWT_TTL_SECONDS: i64 = 30 * 60;

#[derive(Debug, Deserialize)]
struct QWeatherNowEnvelope {
    code: String,
    #[serde(rename = "updateTime")]
    update_time: Option<String>,
    now: Option<QWeatherNow>,
}

#[derive(Debug, Deserialize)]
struct QWeatherHourlyEnvelope {
    code: String,
    #[serde(rename = "updateTime")]
    update_time: Option<String>,
    hourly: Option<Vec<QWeatherHourly>>,
}

#[derive(Debug, Deserialize)]
struct QWeatherDailyEnvelope {
    code: String,
    daily: Option<Vec<QWeatherDaily>>,
}

#[derive(Debug, Serialize)]
struct QWeatherJwtClaims {
    sub: String,
    iat: i64,
    exp: i64,
}

#[derive(Debug, Deserialize)]
struct QWeatherNow {
    temp: Option<String>,
    icon: Option<String>,
    text: Option<String>,
    #[serde(rename = "windDir")]
    wind_dir: Option<String>,
    #[serde(rename = "windScale")]
    wind_scale: Option<String>,
    humidity: Option<String>,
    precip: Option<String>,
    pressure: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QWeatherHourly {
    #[serde(rename = "fxTime")]
    fx_time: Option<String>,
    temp: Option<String>,
    icon: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QWeatherDaily {
    #[serde(rename = "fxDate")]
    fx_date: Option<String>,
    sunrise: Option<String>,
    sunset: Option<String>,
    #[serde(rename = "tempMax")]
    temp_max: Option<String>,
    #[serde(rename = "tempMin")]
    temp_min: Option<String>,
    #[serde(rename = "iconDay")]
    icon_day: Option<String>,
    #[serde(rename = "textDay")]
    text_day: Option<String>,
    #[serde(rename = "windScaleDay")]
    wind_scale_day: Option<String>,
}

pub(crate) async fn fetch_weather_bundle(
    client: &Client,
    config: &RuntimeConfig,
    location: &str,
) -> Result<Value, String> {
    let location = location.trim();
    if location.is_empty() {
        return Err("qweather_weather_location_empty".to_string());
    }
    let now = qweather_get::<QWeatherNowEnvelope>(
        client,
        config,
        "/v7/weather/now",
        &[("location", location), ("lang", "zh")],
    )
    .await?;
    let hourly = qweather_get::<QWeatherHourlyEnvelope>(
        client,
        config,
        "/v7/weather/24h",
        &[("location", location), ("lang", "zh")],
    )
    .await?;
    let daily = qweather_get::<QWeatherDailyEnvelope>(
        client,
        config,
        "/v7/weather/7d",
        &[("location", location), ("lang", "zh")],
    )
    .await?;
    weather_bundle_from_qweather(now, hourly, daily)
}

async fn qweather_get<T: DeserializeOwned>(
    client: &Client,
    config: &RuntimeConfig,
    path: &str,
    query: &[(&str, &str)],
) -> Result<T, String> {
    if !config.qweather_enabled() {
        return Err("qweather_not_configured".to_string());
    }
    let token = qweather_jwt(config)?;
    let api_host = config.qweather_api_host.trim_end_matches('/');
    if api_host.is_empty() {
        return Err("qweather_api_host_empty".to_string());
    }
    let response = client
        .get(format!("{api_host}{path}"))
        .query(query)
        .header(ACCEPT, "application/json")
        .header(USER_AGENT, QWEATHER_USER_AGENT)
        .header(AUTHORIZATION, format!("Bearer {token}"))
        .send()
        .await
        .map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("qweather_status_{status}"));
    }
    response.json::<T>().await.map_err(|err| err.to_string())
}

fn weather_bundle_from_qweather(
    now: QWeatherNowEnvelope,
    hourly: QWeatherHourlyEnvelope,
    daily: QWeatherDailyEnvelope,
) -> Result<Value, String> {
    require_qweather_code(&now.code, "weather_now")?;
    require_qweather_code(&hourly.code, "weather_hourly")?;
    require_qweather_code(&daily.code, "weather_daily")?;
    let now_data = now.now.ok_or_else(|| "qweather_now_empty".to_string())?;
    let (sunrise, sunset) = daily_forecast_sun(&daily);
    let daily_forecast = daily
        .daily
        .unwrap_or_default()
        .into_iter()
        .map(|day| {
            json!({
                "date": clean_option(day.fx_date),
                "cond_txt_d": clean_option(day.text_day),
                "cond_code_d": clean_option(day.icon_day),
                "wind_sc": clean_option(day.wind_scale_day),
                "tmp_max": clean_option(day.temp_max),
                "tmp_min": clean_option(day.temp_min)
            })
        })
        .collect::<Vec<_>>();
    let hourly_entries = hourly
        .hourly
        .unwrap_or_default()
        .into_iter()
        .map(|hour| {
            json!({
                "fxTime": clean_option(hour.fx_time),
                "icon": clean_option(hour.icon),
                "temp": clean_option(hour.temp)
            })
        })
        .collect::<Vec<_>>();
    Ok(json!({
        "sourceStatus": "ok",
        "provider": "qweather",
        "current": {
            "status": "ok",
            "rain": {"txt": ""},
            "now": {
                "cond_code": clean_option(now_data.icon),
                "cond_txt": clean_option(now_data.text),
                "hum": clean_option(now_data.humidity),
                "pcpn": clean_option(now_data.precip),
                "pres": clean_option(now_data.pressure),
                "tmp": clean_option(now_data.temp),
                "wind_dir": clean_option(now_data.wind_dir),
                "wind_sc": clean_option(now_data.wind_scale)
            },
            "air_now_city": {"qlty": "", "aqi": ""},
            "sun": {"rise": sunrise, "set": sunset},
            "daily_forecast": daily_forecast
        },
        "hourly": {
            "updateTime": hourly.update_time.or(now.update_time).unwrap_or_default(),
            "hourly": hourly_entries
        }
    }))
}

fn daily_forecast_sun(daily: &QWeatherDailyEnvelope) -> (String, String) {
    daily
        .daily
        .as_ref()
        .and_then(|items| items.first())
        .map(|day| {
            (
                clean_option(day.sunrise.clone()),
                clean_option(day.sunset.clone()),
            )
        })
        .unwrap_or_default()
}

fn require_qweather_code(code: &str, name: &str) -> Result<(), String> {
    if code == "200" {
        Ok(())
    } else {
        Err(format!("qweather_{name}_code_{code}"))
    }
}

fn clean_option(value: Option<String>) -> String {
    value.unwrap_or_default().trim().to_string()
}

fn qweather_jwt(config: &RuntimeConfig) -> Result<String, String> {
    if config.qweather_project_id.trim().is_empty() {
        return Err("qweather_project_id_empty".to_string());
    }
    if config.qweather_credential_id.trim().is_empty() {
        return Err("qweather_credential_id_empty".to_string());
    }
    let private_key = std::fs::read(&config.qweather_private_key_file)
        .map_err(|err| format!("qweather_private_key_unavailable: {err}"))?;
    let encoding_key = EncodingKey::from_ed_pem(&private_key)
        .map_err(|err| format!("qweather_private_key_invalid: {err}"))?;
    let now = Utc::now().timestamp();
    let claims = QWeatherJwtClaims {
        sub: config.qweather_project_id.trim().to_string(),
        iat: now,
        exp: now + QWEATHER_JWT_TTL_SECONDS,
    };
    let mut header = Header::new(Algorithm::EdDSA);
    header.kid = Some(config.qweather_credential_id.trim().to_string());
    encode(&header, &claims, &encoding_key).map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
    use serde::Deserialize;

    const TEST_PRIVATE_KEY: &str = "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIGrD/e7uKYqSY4twDEsRfMMuLSrODf14dpTiTK6K1YI0\n-----END PRIVATE KEY-----\n";
    const TEST_PUBLIC_KEY: &str = "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA2+Jj2UvNCvQiUPNYRgSi0cJSPiJI6Rs6D0UTeEpQVj8=\n-----END PUBLIC KEY-----\n";

    #[derive(Debug, Deserialize)]
    struct Claims {
        sub: String,
        iat: i64,
        exp: i64,
    }

    #[test]
    fn builds_qweather_eddsa_jwt_with_project_and_credential_ids() {
        let temp = tempfile::tempdir().unwrap();
        let base = temp.path().to_path_buf();
        std::fs::write(base.join("ed25519-private.pem"), TEST_PRIVATE_KEY).unwrap();
        let mut config = RuntimeConfig::from_base_dir(base.clone());
        config.qweather_api_host = "https://geoapi.qweather.test".to_string();
        config.qweather_project_id = "project-id".to_string();
        config.qweather_credential_id = "credential-id".to_string();
        config.qweather_private_key_file = base.join("ed25519-private.pem");
        assert!(config.qweather_enabled());

        let token = qweather_jwt(&config).unwrap();
        let header = jsonwebtoken::decode_header(&token).unwrap();
        assert_eq!(header.alg, Algorithm::EdDSA);
        assert_eq!(header.kid.as_deref(), Some("credential-id"));

        let claims = decode::<Claims>(
            &token,
            &DecodingKey::from_ed_pem(TEST_PUBLIC_KEY.as_bytes()).unwrap(),
            &Validation::new(Algorithm::EdDSA),
        )
        .unwrap()
        .claims;
        assert_eq!(claims.sub, "project-id");
        assert!(claims.exp > claims.iat);
        assert!(claims.exp - claims.iat <= QWEATHER_JWT_TTL_SECONDS);
    }

    #[test]
    fn qweather_backup_requires_complete_runtime_config() {
        let temp = tempfile::tempdir().unwrap();
        let base = temp.path().to_path_buf();
        std::fs::write(base.join("ed25519-private.pem"), TEST_PRIVATE_KEY).unwrap();
        let mut config = RuntimeConfig::from_base_dir(base.clone());

        config.qweather_api_host.clear();
        config.qweather_project_id = "project-id".to_string();
        config.qweather_credential_id = "credential-id".to_string();
        config.qweather_private_key_file = base.join("ed25519-private.pem");
        assert!(!config.qweather_enabled());

        config.qweather_api_host = "https://geoapi.qweather.test".to_string();
        config.qweather_project_id.clear();
        assert!(!config.qweather_enabled());

        config.qweather_project_id = "project-id".to_string();
        config.qweather_private_key_file = base.join("missing-private.pem");
        assert!(!config.qweather_enabled());
    }

    #[test]
    fn maps_qweather_weather_payloads_to_itab_weather_bundle() {
        let bundle = weather_bundle_from_qweather(
            QWeatherNowEnvelope {
                code: "200".to_string(),
                update_time: Some("2026-05-27T01:00+08:00".to_string()),
                now: Some(QWeatherNow {
                    temp: Some("27".to_string()),
                    icon: Some("104".to_string()),
                    text: Some("阴".to_string()),
                    wind_dir: Some("东风".to_string()),
                    wind_scale: Some("3".to_string()),
                    humidity: Some("78".to_string()),
                    precip: Some("0.0".to_string()),
                    pressure: Some("1004".to_string()),
                }),
            },
            QWeatherHourlyEnvelope {
                code: "200".to_string(),
                update_time: Some("2026-05-27T01:35+08:00".to_string()),
                hourly: Some(vec![QWeatherHourly {
                    fx_time: Some("2026-05-27T02:00+08:00".to_string()),
                    temp: Some("27".to_string()),
                    icon: Some("104".to_string()),
                }]),
            },
            QWeatherDailyEnvelope {
                code: "200".to_string(),
                daily: Some(vec![QWeatherDaily {
                    fx_date: Some("2026-05-27".to_string()),
                    sunrise: Some("05:40".to_string()),
                    sunset: Some("18:59".to_string()),
                    temp_max: Some("30".to_string()),
                    temp_min: Some("24".to_string()),
                    icon_day: Some("104".to_string()),
                    text_day: Some("阴".to_string()),
                    wind_scale_day: Some("3".to_string()),
                }]),
            },
        )
        .unwrap();

        assert_eq!(bundle["provider"], "qweather");
        assert_eq!(bundle["current"]["now"]["tmp"], "27");
        assert_eq!(bundle["current"]["now"]["cond_txt"], "阴");
        assert_eq!(bundle["current"]["sun"]["rise"], "05:40");
        assert_eq!(bundle["current"]["daily_forecast"][0]["tmp_max"], "30");
        assert_eq!(
            bundle["hourly"]["hourly"][0]["fxTime"],
            "2026-05-27T02:00+08:00"
        );
    }
}
