use std::path::Path;
use std::time::Duration;

use axum::Json;
use axum::extract::{Path as AxumPath, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use chrono::Utc;
use reqwest::Client;
use serde_json::{Value, json};
use startdeck_core::system_config;

use super::{ApiError, AppState, require_username};

const DEFAULT_DOCKER_SOCKET: &str = "/var/run/docker.sock";

struct DockerClient {
    client: Client,
    socket_path: String,
}

impl DockerClient {
    async fn connect() -> Result<Self, String> {
        let socket_path = docker_socket_path()?;
        if !Path::new(&socket_path).exists() {
            return Err(format!("docker_socket_missing: {socket_path}"));
        }

        let client = Client::builder()
            .timeout(Duration::from_secs(8))
            .unix_socket(socket_path.clone())
            .build()
            .map_err(|err| format!("docker_client_build_failed: {err}"))?;

        let this = Self {
            client,
            socket_path,
        };
        let ping = this.text(reqwest::Method::GET, "/_ping").await?;
        if ping.trim() != "OK" {
            return Err(format!("docker_ping_unexpected: {ping}"));
        }
        Ok(this)
    }

    async fn json(&self, method: reqwest::Method, path: &str) -> Result<Value, String> {
        let text = self.text(method, path).await?;
        serde_json::from_str(&text).map_err(|err| format!("docker_json_parse_failed: {err}"))
    }

    async fn bytes(&self, method: reqwest::Method, path: &str) -> Result<Vec<u8>, String> {
        let response = self
            .client
            .request(method, docker_url(path))
            .send()
            .await
            .map_err(|err| format!("docker_api_request_failed: {err}"))?;
        let status = response.status();
        let bytes = response
            .bytes()
            .await
            .map_err(|err| format!("docker_api_body_failed: {err}"))?;
        if !status.is_success() && status != StatusCode::NOT_MODIFIED {
            let body = String::from_utf8_lossy(&bytes);
            return Err(format!("docker_api_{}: {body}", status.as_u16()));
        }
        Ok(bytes.to_vec())
    }

    async fn text(&self, method: reqwest::Method, path: &str) -> Result<String, String> {
        let bytes = self.bytes(method, path).await?;
        Ok(String::from_utf8_lossy(&bytes).to_string())
    }
}

pub(super) async fn docker_status(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let config = system_config(&state.pool).await?;
    let docker = DockerClient::connect().await;
    let (available, socket_path, error) = match docker {
        Ok(client) => (true, client.socket_path, None),
        Err(err) => (
            false,
            docker_socket_path().unwrap_or_else(|_| DEFAULT_DOCKER_SOCKET.into()),
            Some(err),
        ),
    };
    let state_label = if !config.enable_docker {
        "disabled"
    } else if available {
        "ready"
    } else {
        "unavailable"
    };

    Ok(Json(json!({
        "available": available,
        "enabled": config.enable_docker,
        "state": state_label,
        "runtime": "rust",
        "socketPath": socket_path,
        "hasUpdate": false,
        "error": error,
    })))
}

pub(super) async fn docker_containers(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    if !system_config(&state.pool).await?.enable_docker {
        return Ok(Json(json!({
            "success": false,
            "state": "disabled",
            "error": "docker is disabled",
            "data": [],
            "containers": [],
        })));
    }

    let docker = match DockerClient::connect().await {
        Ok(client) => client,
        Err(err) => {
            return Ok(Json(docker_unavailable(err)));
        }
    };

    let raw = match docker
        .json(reqwest::Method::GET, "/containers/json?all=true")
        .await
    {
        Ok(value) => value,
        Err(err) => return Ok(Json(docker_unavailable(err))),
    };
    let mut containers = Vec::new();
    for item in raw.as_array().into_iter().flatten() {
        let mut normalized = normalize_container(item);
        if normalized.get("State").and_then(Value::as_str) == Some("running")
            && let Some(id) = normalized.get("Id").and_then(Value::as_str)
            && let Some(stats) = docker_container_stats(&docker, id).await
        {
            normalized["stats"] = stats;
        }
        containers.push(normalized);
    }

    Ok(Json(json!({
        "success": true,
        "state": "ready",
        "data": containers,
        "containers": containers,
        "updateStatus": default_update_status(0, containers.len()),
    })))
}

pub(super) async fn docker_info(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    if !system_config(&state.pool).await?.enable_docker {
        return Ok(Json(json!({
            "success": false,
            "state": "disabled",
            "error": "docker is disabled",
        })));
    }

    let docker = match DockerClient::connect().await {
        Ok(client) => client,
        Err(err) => return Ok(Json(docker_unavailable(err))),
    };
    let info = match docker.json(reqwest::Method::GET, "/info").await {
        Ok(value) => value,
        Err(err) => return Ok(Json(docker_unavailable(err))),
    };
    let version = docker
        .json(reqwest::Method::GET, "/version")
        .await
        .unwrap_or_else(|_| json!({}));

    Ok(Json(json!({
        "success": true,
        "state": "ready",
        "info": info,
        "version": version,
        "socketPath": docker.socket_path,
    })))
}

pub(super) async fn docker_check_updates(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    if !system_config(&state.pool).await?.enable_docker {
        return Ok(Json(json!({
            "success": false,
            "state": "disabled",
            "error": "docker is disabled",
        })));
    }

    let total = match DockerClient::connect().await {
        Ok(docker) => docker
            .json(reqwest::Method::GET, "/containers/json?all=true")
            .await
            .ok()
            .and_then(|value| value.as_array().map(Vec::len))
            .unwrap_or(0),
        Err(_) => 0,
    };

    Ok(Json(json!({
        "success": true,
        "state": "ready",
        "updateStatus": default_update_status(0, total),
    })))
}

pub(super) async fn docker_container_action(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath((id, action)): AxumPath<(String, String)>,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    if !system_config(&state.pool).await?.enable_docker {
        return Ok(Json(json!({
            "success": false,
            "state": "disabled",
            "error": "docker is disabled",
        })));
    }

    let method_path = match action.as_str() {
        "start" => Some((reqwest::Method::POST, format!("/containers/{id}/start"))),
        "stop" => Some((reqwest::Method::POST, format!("/containers/{id}/stop?t=10"))),
        "restart" => Some((
            reqwest::Method::POST,
            format!("/containers/{id}/restart?t=10"),
        )),
        "kill" => Some((reqwest::Method::POST, format!("/containers/{id}/kill"))),
        "pause" => Some((reqwest::Method::POST, format!("/containers/{id}/pause"))),
        "unpause" => Some((reqwest::Method::POST, format!("/containers/{id}/unpause"))),
        "update" => None,
        _ => {
            return Ok(Json(json!({
                "success": false,
                "state": "ready",
                "error": "unsupported_docker_action",
            })));
        }
    };

    if let Some((method, path)) = method_path {
        let docker = match DockerClient::connect().await {
            Ok(client) => client,
            Err(err) => return Ok(Json(docker_unavailable(err))),
        };
        if let Err(err) = docker.bytes(method, &path).await {
            return Ok(Json(json!({
                "success": false,
                "state": "unavailable",
                "error": err,
            })));
        }
    }

    Ok(Json(json!({
        "success": true,
        "state": "ready",
        "action": action,
    })))
}

pub(super) async fn docker_inspect(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    if !system_config(&state.pool).await?.enable_docker {
        return Ok(Json(json!({
            "success": false,
            "state": "disabled",
            "error": "docker is disabled",
        })));
    }

    let docker = match DockerClient::connect().await {
        Ok(client) => client,
        Err(err) => return Ok(Json(docker_unavailable(err))),
    };
    let inspect = match docker
        .json(reqwest::Method::GET, &format!("/containers/{id}/json"))
        .await
    {
        Ok(value) => value,
        Err(err) => {
            return Ok(Json(json!({
                "success": false,
                "state": "unavailable",
                "error": err,
            })));
        }
    };

    Ok(Json(json!({
        "success": true,
        "state": "ready",
        "data": inspect_lite(&inspect),
    })))
}

pub(super) async fn docker_logs(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    require_username(&headers, &state)?;
    if !system_config(&state.pool).await?.enable_docker {
        return Ok((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"success": false, "state": "disabled", "error": "docker is disabled"})),
        )
            .into_response());
    }

    let docker = match DockerClient::connect().await {
        Ok(client) => client,
        Err(err) => {
            return Ok((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(docker_unavailable(err)),
            )
                .into_response());
        }
    };
    let raw = match docker
        .json(reqwest::Method::GET, "/containers/json?all=true")
        .await
    {
        Ok(value) => value,
        Err(err) => {
            return Ok((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(docker_unavailable(err)),
            )
                .into_response());
        }
    };

    let mut entries = Vec::new();
    for item in raw.as_array().into_iter().flatten() {
        let id = item.get("Id").and_then(Value::as_str).unwrap_or_default();
        if id.is_empty() {
            continue;
        }
        let name = item
            .get("Names")
            .and_then(Value::as_array)
            .and_then(|names| names.first())
            .and_then(Value::as_str)
            .unwrap_or(id)
            .trim_start_matches('/');
        let path =
            format!("/containers/{id}/logs?stdout=true&stderr=true&tail=200&timestamps=true");
        let log = match docker.bytes(reqwest::Method::GET, &path).await {
            Ok(bytes) => String::from_utf8_lossy(&bytes).to_string(),
            Err(err) => err,
        };
        entries.push(json!({
            "id": id,
            "name": name,
            "image": item.get("Image").cloned().unwrap_or(Value::Null),
            "status": item.get("Status").cloned().unwrap_or(Value::Null),
            "log": log,
        }));
    }

    let payload = serde_json::to_vec_pretty(&json!({
        "success": true,
        "runtime": "rust",
        "exportedAt": Utc::now().to_rfc3339(),
        "containers": entries,
    }))?;

    Ok((
        [
            (header::CONTENT_TYPE, "application/json"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=\"docker-logs.json\"",
            ),
        ],
        payload,
    )
        .into_response())
}

fn docker_socket_path() -> Result<String, String> {
    let host = std::env::var("DOCKER_HOST").unwrap_or_default();
    let trimmed = host.trim();
    if trimmed.is_empty() {
        return Ok(DEFAULT_DOCKER_SOCKET.to_string());
    }
    if let Some(path) = trimmed.strip_prefix("unix://") {
        return Ok(path.to_string());
    }
    Err(format!("unsupported_docker_host: {trimmed}"))
}

fn docker_url(path: &str) -> String {
    format!("http://docker{path}")
}

fn docker_unavailable(error: String) -> Value {
    json!({
        "success": false,
        "state": "unavailable",
        "available": false,
        "enabled": true,
        "error": error,
        "data": [],
        "containers": [],
    })
}

fn normalize_container(item: &Value) -> Value {
    json!({
        "Id": item.get("Id").cloned().unwrap_or(Value::Null),
        "Names": item.get("Names").cloned().unwrap_or_else(|| json!([])),
        "Image": item.get("Image").cloned().unwrap_or(Value::Null),
        "ImageID": item.get("ImageID").cloned().unwrap_or(Value::Null),
        "Command": item.get("Command").cloned().unwrap_or(Value::Null),
        "Created": item.get("Created").cloned().unwrap_or(Value::Null),
        "State": item.get("State").cloned().unwrap_or(Value::Null),
        "Status": item.get("Status").cloned().unwrap_or(Value::Null),
        "Ports": item.get("Ports").cloned().unwrap_or_else(|| json!([])),
        "Labels": item.get("Labels").cloned().unwrap_or_else(|| json!({})),
    })
}

async fn docker_container_stats(docker: &DockerClient, id: &str) -> Option<Value> {
    let stats = docker
        .json(
            reqwest::Method::GET,
            &format!("/containers/{id}/stats?stream=false&one-shot=true"),
        )
        .await
        .ok()?;
    Some(normalize_stats(&stats))
}

fn normalize_stats(stats: &Value) -> Value {
    let cpu_total = value_u64(stats, &["cpu_stats", "cpu_usage", "total_usage"]);
    let pre_cpu_total = value_u64(stats, &["precpu_stats", "cpu_usage", "total_usage"]);
    let system_total = value_u64(stats, &["cpu_stats", "system_cpu_usage"]);
    let pre_system_total = value_u64(stats, &["precpu_stats", "system_cpu_usage"]);
    let online_cpus = value_u64(stats, &["cpu_stats", "online_cpus"]).max(1);
    let cpu_delta = cpu_total.saturating_sub(pre_cpu_total) as f64;
    let system_delta = system_total.saturating_sub(pre_system_total) as f64;
    let cpu_percent = if system_delta > 0.0 && cpu_delta > 0.0 {
        (cpu_delta / system_delta) * online_cpus as f64 * 100.0
    } else {
        0.0
    };

    let mem_usage = value_u64(stats, &["memory_stats", "usage"]);
    let mem_limit = value_u64(stats, &["memory_stats", "limit"]);
    let mem_percent = if mem_limit > 0 {
        (mem_usage as f64 / mem_limit as f64) * 100.0
    } else {
        0.0
    };

    let mut rx = 0_u64;
    let mut tx = 0_u64;
    if let Some(networks) = stats.get("networks").and_then(Value::as_object) {
        for network in networks.values() {
            rx = rx.saturating_add(network.get("rx_bytes").and_then(Value::as_u64).unwrap_or(0));
            tx = tx.saturating_add(network.get("tx_bytes").and_then(Value::as_u64).unwrap_or(0));
        }
    }

    let mut read = 0_u64;
    let mut write = 0_u64;
    if let Some(entries) = stats
        .get("blkio_stats")
        .and_then(|v| v.get("io_service_bytes_recursive"))
        .and_then(Value::as_array)
    {
        for entry in entries {
            let value = entry.get("value").and_then(Value::as_u64).unwrap_or(0);
            match entry.get("op").and_then(Value::as_str).unwrap_or_default() {
                "Read" => read = read.saturating_add(value),
                "Write" => write = write.saturating_add(value),
                _ => {}
            }
        }
    }

    json!({
        "cpuPercent": round1(cpu_percent),
        "memUsage": mem_usage,
        "memLimit": mem_limit,
        "memPercent": round1(mem_percent),
        "netIO": {"rx": rx, "tx": tx},
        "blockIO": {"read": read, "write": write},
    })
}

fn inspect_lite(inspect: &Value) -> Value {
    let network_mode = inspect
        .get("HostConfig")
        .and_then(|host| host.get("NetworkMode"))
        .and_then(Value::as_str)
        .unwrap_or("default");
    let mut ports = Vec::new();
    collect_port_keys(
        inspect
            .get("Config")
            .and_then(|config| config.get("ExposedPorts")),
        &mut ports,
    );
    collect_port_keys(
        inspect
            .get("NetworkSettings")
            .and_then(|settings| settings.get("Ports")),
        &mut ports,
    );
    ports.sort_unstable();
    ports.dedup();
    json!({
        "networkMode": network_mode,
        "ports": ports,
    })
}

fn collect_port_keys(value: Option<&Value>, ports: &mut Vec<u16>) {
    let Some(map) = value.and_then(Value::as_object) else {
        return;
    };
    for key in map.keys() {
        if let Some(raw_port) = key.split('/').next()
            && let Ok(port) = raw_port.parse::<u16>()
        {
            ports.push(port);
        }
    }
}

fn default_update_status(update_count: usize, total_count: usize) -> Value {
    json!({
        "lastCheck": Utc::now().timestamp_millis(),
        "isChecking": false,
        "lastError": null,
        "checkedCount": total_count,
        "totalCount": total_count,
        "updateCount": update_count,
        "failures": [],
    })
}

fn value_u64(value: &Value, path: &[&str]) -> u64 {
    let mut current = value;
    for segment in path {
        let Some(next) = current.get(segment) else {
            return 0;
        };
        current = next;
    }
    current.as_u64().unwrap_or(0)
}

fn round1(value: f64) -> f64 {
    if !value.is_finite() {
        return 0.0;
    }
    (value * 10.0).round() / 10.0
}
