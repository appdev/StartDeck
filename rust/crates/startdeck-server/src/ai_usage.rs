use std::path::PathBuf;

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use axum::Json;
use axum::extract::{Path as AxumPath, State};
use axum::http::HeaderMap;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::Row;

use crate::{ApiError, AppState, require_username};

const OPENAI_PROVIDER_ID: &str = "openai";
const AI_USAGE_KEY_VERSION: i64 = 1;
const CHATGPT_BASE_URL_ENV: &str = "STARTDECK_AI_USAGE_OPENAI_BASE_URL";

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum AiUsageCredentialType {
    AccessToken,
    SessionCookie,
}

impl AiUsageCredentialType {
    fn as_str(self) -> &'static str {
        match self {
            Self::AccessToken => "access_token",
            Self::SessionCookie => "session_cookie",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum AiUsageCredentialStorage {
    Once,
    Browser,
    Server,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiUsageQueryRequest {
    widget_id: String,
    provider_id: String,
    credential_storage: AiUsageCredentialStorage,
    credential_type: Option<AiUsageCredentialType>,
    credential: Option<String>,
    account_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveCredentialRequest {
    credential_type: AiUsageCredentialType,
    credential: String,
    account_id: Option<String>,
    server_storage_acknowledged: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CredentialStatusResponse {
    has_server_credential: bool,
    provider_id: String,
    widget_id: String,
    credential_type: Option<&'static str>,
    account_id_hint: Option<String>,
    updated_at: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiUsageQueryResponse {
    status: &'static str,
    provider_id: String,
    primary_remaining_percent: Option<f64>,
    weekly_remaining_percent: Option<f64>,
    primary_reset_label: Option<String>,
    weekly_reset_label: Option<String>,
    last_synced_at: String,
    error_code: Option<&'static str>,
}

#[derive(Debug)]
struct CredentialMaterial {
    credential_type: AiUsageCredentialType,
    credential: String,
    account_id: Option<String>,
}

struct StoredCredential {
    credential_type: AiUsageCredentialType,
    encrypted_secret: String,
    encrypted_account_id: Option<String>,
    nonce: String,
    account_nonce: Option<String>,
    updated_at: i64,
}

#[derive(Debug)]
struct ProviderUsageSummary {
    primary_remaining_percent: Option<f64>,
    weekly_remaining_percent: Option<f64>,
    primary_reset_label: Option<String>,
    weekly_reset_label: Option<String>,
}

#[derive(Debug)]
struct ProviderUsageError {
    code: &'static str,
}

pub(crate) async fn query_usage(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AiUsageQueryRequest>,
) -> Result<Json<AiUsageQueryResponse>, ApiError> {
    let username = require_username(&headers, &state)?;
    let widget_id = sanitize_component_id(&body.widget_id, "invalid_widget_id")?;
    let provider_id = sanitize_component_id(&body.provider_id, "invalid_provider_id")?;
    if provider_id != OPENAI_PROVIDER_ID {
        return Ok(Json(error_response(provider_id, "provider_query_planned")));
    }

    let material = resolve_credential_material(&state, &username, &widget_id, body).await?;
    match fetch_openai_codex_usage(&state.http, material).await {
        Ok(summary) => Ok(Json(success_response(provider_id, summary))),
        Err(err) => Ok(Json(error_response(provider_id, err.code))),
    }
}

pub(crate) async fn get_credential(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath((widget_id, provider_id)): AxumPath<(String, String)>,
) -> Result<Json<CredentialStatusResponse>, ApiError> {
    let username = require_username(&headers, &state)?;
    let widget_id = sanitize_component_id(&widget_id, "invalid_widget_id")?;
    let provider_id = sanitize_component_id(&provider_id, "invalid_provider_id")?;
    let Some(stored) = load_stored_credential(&state, &username, &widget_id, &provider_id).await?
    else {
        return Ok(Json(CredentialStatusResponse {
            has_server_credential: false,
            provider_id,
            widget_id,
            credential_type: None,
            account_id_hint: None,
            updated_at: None,
        }));
    };
    let account_id_hint = match (&stored.encrypted_account_id, &stored.account_nonce) {
        (Some(encrypted), Some(nonce)) => decrypt_text(&state, encrypted, nonce)
            .await
            .ok()
            .and_then(|value| mask_secret(&value)),
        _ => None,
    };
    Ok(Json(CredentialStatusResponse {
        has_server_credential: true,
        provider_id,
        widget_id,
        credential_type: Some(stored.credential_type.as_str()),
        account_id_hint,
        updated_at: Some(stored.updated_at),
    }))
}

pub(crate) async fn save_credential(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath((widget_id, provider_id)): AxumPath<(String, String)>,
    Json(body): Json<SaveCredentialRequest>,
) -> Result<Json<CredentialStatusResponse>, ApiError> {
    let username = require_username(&headers, &state)?;
    let widget_id = sanitize_component_id(&widget_id, "invalid_widget_id")?;
    let provider_id = sanitize_component_id(&provider_id, "invalid_provider_id")?;
    if provider_id != OPENAI_PROVIDER_ID {
        return Err(ApiError::bad_request("provider_query_planned"));
    }
    if !body.server_storage_acknowledged {
        return Err(ApiError::bad_request(
            "server_storage_acknowledgement_required",
        ));
    }
    let credential = normalize_secret(body.credential, "credential_required")?;
    let (encrypted_secret, nonce) = encrypt_text(&state, &credential).await?;
    let (encrypted_account_id, account_nonce) = match body.account_id {
        Some(value) if !value.trim().is_empty() => {
            let (encrypted, nonce) = encrypt_text(&state, value.trim()).await?;
            (Some(encrypted), Some(nonce))
        }
        _ => (None, None),
    };
    let now = Utc::now().timestamp_millis();
    sqlx::query(
        r#"INSERT INTO ai_usage_credentials(
            username, widget_id, provider_id, credential_type, encrypted_secret,
            encrypted_account_id, nonce, account_nonce, key_version, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(username, widget_id, provider_id) DO UPDATE SET
            credential_type=excluded.credential_type,
            encrypted_secret=excluded.encrypted_secret,
            encrypted_account_id=excluded.encrypted_account_id,
            nonce=excluded.nonce,
            account_nonce=excluded.account_nonce,
            key_version=excluded.key_version,
            updated_at=excluded.updated_at"#,
    )
    .bind(&username)
    .bind(&widget_id)
    .bind(&provider_id)
    .bind(body.credential_type.as_str())
    .bind(encrypted_secret)
    .bind(encrypted_account_id)
    .bind(nonce)
    .bind(account_nonce)
    .bind(AI_USAGE_KEY_VERSION)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await?;

    get_credential(State(state), headers, AxumPath((widget_id, provider_id))).await
}

pub(crate) async fn delete_credential(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath((widget_id, provider_id)): AxumPath<(String, String)>,
) -> Result<Json<Value>, ApiError> {
    let username = require_username(&headers, &state)?;
    let widget_id = sanitize_component_id(&widget_id, "invalid_widget_id")?;
    let provider_id = sanitize_component_id(&provider_id, "invalid_provider_id")?;
    sqlx::query(
        "DELETE FROM ai_usage_credentials WHERE username = ? AND widget_id = ? AND provider_id = ?",
    )
    .bind(username)
    .bind(widget_id)
    .bind(provider_id)
    .execute(&state.pool)
    .await?;
    Ok(Json(serde_json::json!({"success": true})))
}

async fn resolve_credential_material(
    state: &AppState,
    username: &str,
    widget_id: &str,
    body: AiUsageQueryRequest,
) -> Result<CredentialMaterial, ApiError> {
    match body.credential_storage {
        AiUsageCredentialStorage::Server => {
            let stored =
                load_stored_credential(state, username, widget_id, &body.provider_id).await?;
            let stored =
                stored.ok_or_else(|| ApiError::bad_request("server_credential_missing"))?;
            let credential = decrypt_text(state, &stored.encrypted_secret, &stored.nonce).await?;
            let account_id = match (stored.encrypted_account_id, stored.account_nonce) {
                (Some(encrypted), Some(nonce)) => {
                    Some(decrypt_text(state, &encrypted, &nonce).await?)
                }
                _ => None,
            };
            Ok(CredentialMaterial {
                credential_type: stored.credential_type,
                credential,
                account_id,
            })
        }
        AiUsageCredentialStorage::Once | AiUsageCredentialStorage::Browser => {
            let credential_type = body
                .credential_type
                .ok_or_else(|| ApiError::bad_request("credential_type_required"))?;
            let credential =
                normalize_secret(body.credential.unwrap_or_default(), "credential_required")?;
            Ok(CredentialMaterial {
                credential_type,
                credential,
                account_id: body
                    .account_id
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty()),
            })
        }
    }
}

async fn load_stored_credential(
    state: &AppState,
    username: &str,
    widget_id: &str,
    provider_id: &str,
) -> Result<Option<StoredCredential>, ApiError> {
    let row = sqlx::query(
        r#"SELECT credential_type, encrypted_secret, encrypted_account_id, nonce, account_nonce, updated_at
           FROM ai_usage_credentials
           WHERE username = ? AND widget_id = ? AND provider_id = ?"#,
    )
    .bind(username)
    .bind(widget_id)
    .bind(provider_id)
    .fetch_optional(&state.pool)
    .await?;

    row.map(|row| {
        let credential_type = match row.get::<String, _>("credential_type").as_str() {
            "access_token" => Ok(AiUsageCredentialType::AccessToken),
            "session_cookie" => Ok(AiUsageCredentialType::SessionCookie),
            _ => Err(ApiError::internal("invalid_stored_credential_type")),
        }?;
        Ok(StoredCredential {
            credential_type,
            encrypted_secret: row.get("encrypted_secret"),
            encrypted_account_id: row.get("encrypted_account_id"),
            nonce: row.get("nonce"),
            account_nonce: row.get("account_nonce"),
            updated_at: row.get("updated_at"),
        })
    })
    .transpose()
}

async fn fetch_openai_codex_usage(
    client: &Client,
    material: CredentialMaterial,
) -> Result<ProviderUsageSummary, ProviderUsageError> {
    let base_url = chatgpt_base_url();
    fetch_openai_codex_usage_with_base(client, material, &base_url).await
}

async fn fetch_openai_codex_usage_with_base(
    client: &Client,
    material: CredentialMaterial,
    base_url: &str,
) -> Result<ProviderUsageSummary, ProviderUsageError> {
    let access_token = match material.credential_type {
        AiUsageCredentialType::AccessToken => material.credential,
        AiUsageCredentialType::SessionCookie => {
            exchange_chatgpt_session_cookie_with_base(client, &material.credential, base_url)
                .await?
        }
    };
    let usage_url = format!("{base_url}/backend-api/wham/usage");
    let mut request = client.get(usage_url).bearer_auth(access_token);
    if let Some(account_id) = material.account_id {
        request = request.header("ChatGPT-Account-Id", account_id);
    }
    let response = request.send().await.map_err(|_| ProviderUsageError {
        code: "upstream_unreachable",
    })?;
    if response.status().as_u16() == 401 {
        return Err(ProviderUsageError {
            code: "reauth_required",
        });
    }
    if response.status().as_u16() == 403 {
        return Err(ProviderUsageError {
            code: "upstream_forbidden",
        });
    }
    if response.status().as_u16() == 429 {
        return Err(ProviderUsageError {
            code: "upstream_rate_limited",
        });
    }
    if !response.status().is_success() {
        return Err(ProviderUsageError {
            code: "upstream_error",
        });
    }
    let payload = response
        .json::<Value>()
        .await
        .map_err(|_| ProviderUsageError {
            code: "source_shape_changed",
        })?;
    parse_openai_codex_usage(&payload)
}

async fn exchange_chatgpt_session_cookie_with_base(
    client: &Client,
    cookie: &str,
    base_url: &str,
) -> Result<String, ProviderUsageError> {
    let auth_url = format!("{base_url}/api/auth/session");
    let response = client
        .get(auth_url)
        .header("cookie", normalize_chatgpt_cookie_header(cookie))
        .send()
        .await
        .map_err(|_| ProviderUsageError {
            code: "upstream_unreachable",
        })?;
    if response.status().as_u16() == 401 {
        return Err(ProviderUsageError {
            code: "reauth_required",
        });
    }
    if response.status().as_u16() == 403 {
        return Err(ProviderUsageError {
            code: "upstream_forbidden",
        });
    }
    if !response.status().is_success() {
        return Err(ProviderUsageError {
            code: "upstream_error",
        });
    }
    let payload = response
        .json::<Value>()
        .await
        .map_err(|_| ProviderUsageError {
            code: "source_shape_changed",
        })?;
    payload
        .get("accessToken")
        .or_else(|| payload.get("access_token"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .ok_or(ProviderUsageError {
            code: "reauth_required",
        })
}

fn parse_openai_codex_usage(payload: &Value) -> Result<ProviderUsageSummary, ProviderUsageError> {
    let rate_limit = payload
        .pointer("/usage/rate_limit")
        .or_else(|| payload.get("rate_limit"))
        .ok_or(ProviderUsageError {
            code: "source_shape_changed",
        })?;
    let primary_window = rate_limit.get("primary_window");
    let secondary_window = rate_limit.get("secondary_window");
    if primary_window.is_none() && secondary_window.is_none() {
        return Err(ProviderUsageError {
            code: "source_shape_changed",
        });
    }
    Ok(ProviderUsageSummary {
        primary_remaining_percent: primary_window.and_then(remaining_percent),
        weekly_remaining_percent: secondary_window.and_then(remaining_percent),
        primary_reset_label: primary_window.and_then(reset_label),
        weekly_reset_label: secondary_window.and_then(reset_label),
    })
}

fn remaining_percent(window: &Value) -> Option<f64> {
    if window.is_null() {
        return None;
    }
    if let Some(value) = number_field(window, "remaining_percent") {
        return Some(clamp_percent(value));
    }
    if let Some(value) = number_field(window, "used_percent") {
        return Some(clamp_percent(100.0 - value));
    }
    if window
        .get("limit_reached")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return Some(0.0);
    }
    None
}

fn reset_label(window: &Value) -> Option<String> {
    if window.is_null() {
        return None;
    }
    if let Some(reset_at) = number_field(window, "reset_at") {
        let millis = if reset_at > 10_000_000_000.0 {
            reset_at as i64
        } else {
            (reset_at * 1000.0) as i64
        };
        if let Some(datetime) = chrono::DateTime::<Utc>::from_timestamp_millis(millis) {
            return Some(datetime.format("%Y-%m-%d %H:%M UTC").to_string());
        }
    }
    let seconds = number_field(window, "reset_after_seconds")?;
    let total_minutes = (seconds / 60.0).ceil().max(0.0) as i64;
    let hours = total_minutes / 60;
    let minutes = total_minutes % 60;
    if hours > 0 {
        Some(format!("约{hours}小时{minutes}分后"))
    } else {
        Some(format!("约{minutes}分钟后"))
    }
}

fn number_field(value: &Value, key: &str) -> Option<f64> {
    value.get(key).and_then(|item| {
        item.as_f64().or_else(|| {
            item.as_str()
                .and_then(|text| text.trim().parse::<f64>().ok())
        })
    })
}

fn normalize_chatgpt_cookie_header(raw: &str) -> String {
    let trimmed = raw.trim().trim_start_matches("Cookie:").trim();
    if trimmed.contains('=') {
        trimmed.to_string()
    } else {
        format!("__Secure-next-auth.session-token={trimmed}")
    }
}

fn chatgpt_base_url() -> String {
    std::env::var(CHATGPT_BASE_URL_ENV)
        .unwrap_or_else(|_| "https://chatgpt.com".to_string())
        .trim_end_matches('/')
        .to_string()
}

fn success_response(provider_id: String, summary: ProviderUsageSummary) -> AiUsageQueryResponse {
    AiUsageQueryResponse {
        status: "connected",
        provider_id,
        primary_remaining_percent: summary.primary_remaining_percent,
        weekly_remaining_percent: summary.weekly_remaining_percent,
        primary_reset_label: summary.primary_reset_label,
        weekly_reset_label: summary.weekly_reset_label,
        last_synced_at: Utc::now().to_rfc3339(),
        error_code: None,
    }
}

fn error_response(provider_id: String, code: &'static str) -> AiUsageQueryResponse {
    AiUsageQueryResponse {
        status: "error",
        provider_id,
        primary_remaining_percent: None,
        weekly_remaining_percent: None,
        primary_reset_label: None,
        weekly_reset_label: None,
        last_synced_at: Utc::now().to_rfc3339(),
        error_code: Some(code),
    }
}

async fn encrypt_text(state: &AppState, text: &str) -> Result<(String, String), ApiError> {
    let key = load_or_create_key(state).await?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| ApiError::internal("credential_key_invalid"))?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let encrypted = cipher
        .encrypt(&nonce, text.as_bytes())
        .map_err(|_| ApiError::internal("credential_encrypt_failed"))?;
    let nonce_bytes: &[u8] = nonce.as_ref();
    Ok((STANDARD.encode(encrypted), STANDARD.encode(nonce_bytes)))
}

async fn decrypt_text(state: &AppState, encrypted: &str, nonce: &str) -> Result<String, ApiError> {
    let key = load_or_create_key(state).await?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| ApiError::internal("credential_key_invalid"))?;
    let encrypted = STANDARD
        .decode(encrypted)
        .map_err(|_| ApiError::internal("credential_decrypt_failed"))?;
    let nonce = STANDARD
        .decode(nonce)
        .map_err(|_| ApiError::internal("credential_decrypt_failed"))?;
    let nonce: [u8; 12] = nonce
        .try_into()
        .map_err(|_| ApiError::internal("credential_decrypt_failed"))?;
    let nonce = Nonce::from(nonce);
    let plain = cipher
        .decrypt(&nonce, encrypted.as_ref())
        .map_err(|_| ApiError::internal("credential_decrypt_failed"))?;
    String::from_utf8(plain).map_err(|_| ApiError::internal("credential_decrypt_failed"))
}

async fn load_or_create_key(state: &AppState) -> Result<[u8; 32], ApiError> {
    let path = credential_key_path(state);
    match tokio::fs::read(&path).await {
        Ok(bytes) => decode_key_bytes(&bytes),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            let key = Aes256Gcm::generate_key(&mut OsRng);
            let parent = path
                .parent()
                .ok_or_else(|| ApiError::internal("credential_key_path_invalid"))?;
            tokio::fs::create_dir_all(parent).await?;
            let key_bytes: &[u8] = key.as_ref();
            let encoded = STANDARD.encode(key_bytes);
            tokio::fs::write(&path, &encoded).await?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;

                tokio::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).await?;
            }
            decode_key_bytes(encoded.as_bytes())
        }
        Err(err) => Err(ApiError::internal(err.to_string())),
    }
}

fn decode_key_bytes(bytes: &[u8]) -> Result<[u8; 32], ApiError> {
    let decoded = STANDARD
        .decode(String::from_utf8_lossy(bytes).trim())
        .map_err(|_| ApiError::internal("credential_key_invalid"))?;
    let mut out = [0_u8; 32];
    if decoded.len() != out.len() {
        return Err(ApiError::internal("credential_key_invalid"));
    }
    out.copy_from_slice(&decoded);
    Ok(out)
}

fn credential_key_path(state: &AppState) -> PathBuf {
    state
        .config
        .data_dir
        .join("secrets")
        .join("ai-usage-credential.key")
}

fn sanitize_component_id(raw: &str, error: &'static str) -> Result<String, ApiError> {
    let value = raw.trim();
    if value.is_empty()
        || value.len() > 128
        || !value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        return Err(ApiError::bad_request(error));
    }
    Ok(value.to_string())
}

fn normalize_secret(raw: String, error: &'static str) -> Result<String, ApiError> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(ApiError::bad_request(error));
    }
    if value.len() > 16 * 1024 {
        return Err(ApiError::bad_request("credential_too_large"));
    }
    Ok(value.to_string())
}

fn clamp_percent(value: f64) -> f64 {
    let clamped = value.clamp(0.0, 100.0);
    (clamped * 10.0).round() / 10.0
}

fn mask_secret(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    let chars = trimmed.chars().collect::<Vec<_>>();
    if chars.len() <= 4 {
        return Some("****".to_string());
    }
    let suffix = chars[chars.len().saturating_sub(4)..]
        .iter()
        .collect::<String>();
    Some(format!("****{suffix}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use axum::routing::get;
    use serde_json::json;

    #[test]
    fn parses_codex_usage_windows() {
        let summary = parse_openai_codex_usage(&json!({
            "usage": {
                "rate_limit": {
                    "primary_window": {
                        "used_percent": 15.2,
                        "limit_window_seconds": 18000,
                        "reset_after_seconds": 5400
                    },
                    "secondary_window": {
                        "used_percent": 60,
                        "limit_window_seconds": 604800,
                        "reset_after_seconds": 86400
                    }
                }
            }
        }))
        .unwrap();

        assert_eq!(summary.primary_remaining_percent, Some(84.8));
        assert_eq!(summary.weekly_remaining_percent, Some(40.0));
        assert_eq!(
            summary.primary_reset_label.as_deref(),
            Some("约1小时30分后")
        );
        assert_eq!(summary.weekly_reset_label.as_deref(), Some("约24小时0分后"));
    }

    #[test]
    fn normalizes_cookie_header_without_concatenating_shards() {
        assert_eq!(
            normalize_chatgpt_cookie_header("bare-token"),
            "__Secure-next-auth.session-token=bare-token"
        );
        assert_eq!(
            normalize_chatgpt_cookie_header(
                "Cookie: __Secure-next-auth.session-token.0=a; __Secure-next-auth.session-token.1=b"
            ),
            "__Secure-next-auth.session-token.0=a; __Secure-next-auth.session-token.1=b"
        );
    }

    #[tokio::test]
    async fn fetches_codex_usage_after_session_cookie_exchange() {
        let base_url = spawn_openai_usage_mock().await;
        let summary = fetch_openai_codex_usage_with_base(
            &Client::new(),
            CredentialMaterial {
                credential_type: AiUsageCredentialType::SessionCookie,
                credential: "valid-session".to_string(),
                account_id: Some("acct-test".to_string()),
            },
            &base_url,
        )
        .await
        .unwrap();

        assert_eq!(summary.primary_remaining_percent, Some(85.0));
        assert_eq!(summary.weekly_remaining_percent, Some(40.0));
    }

    #[tokio::test]
    async fn maps_codex_usage_upstream_failures_without_raw_payloads() {
        let base_url = spawn_openai_usage_mock().await;
        for (token, code) in [
            ("token-401", "reauth_required"),
            ("token-403", "upstream_forbidden"),
            ("token-429", "upstream_rate_limited"),
            ("token-shape", "source_shape_changed"),
        ] {
            let error = fetch_openai_codex_usage_with_base(
                &Client::new(),
                CredentialMaterial {
                    credential_type: AiUsageCredentialType::AccessToken,
                    credential: token.to_string(),
                    account_id: None,
                },
                &base_url,
            )
            .await
            .unwrap_err();

            assert_eq!(error.code, code);
        }
    }

    async fn spawn_openai_usage_mock() -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let app = axum::Router::new()
            .route("/api/auth/session", get(mock_auth_session))
            .route("/backend-api/wham/usage", get(mock_wham_usage));
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        format!("http://{addr}")
    }

    async fn mock_auth_session(headers: HeaderMap) -> (StatusCode, Json<Value>) {
        let cookie = headers
            .get("cookie")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        if cookie.contains("valid-session") {
            (
                StatusCode::OK,
                Json(json!({"accessToken": "token-from-session"})),
            )
        } else {
            (StatusCode::UNAUTHORIZED, Json(json!({"error": "expired"})))
        }
    }

    async fn mock_wham_usage(headers: HeaderMap) -> (StatusCode, Json<Value>) {
        let token = headers
            .get("authorization")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "))
            .unwrap_or("");
        match token {
            "token-401" => (StatusCode::UNAUTHORIZED, Json(json!({}))),
            "token-403" => (StatusCode::FORBIDDEN, Json(json!({}))),
            "token-429" => (StatusCode::TOO_MANY_REQUESTS, Json(json!({}))),
            "token-shape" => (StatusCode::OK, Json(json!({"usage": {}}))),
            "token-from-session" | "token-ok" => (
                StatusCode::OK,
                Json(json!({
                    "usage": {
                        "rate_limit": {
                            "primary_window": {
                                "remaining_percent": 85,
                                "reset_after_seconds": 3600
                            },
                            "secondary_window": {
                                "remaining_percent": 40,
                                "reset_after_seconds": 86400
                            }
                        }
                    }
                })),
            ),
            _ => (StatusCode::FORBIDDEN, Json(json!({}))),
        }
    }
}
