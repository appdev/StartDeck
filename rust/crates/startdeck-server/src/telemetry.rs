use axum::Json;
use axum::extract::State;
use axum::http::HeaderMap;
use chrono::Utc;
use serde_json::{Value, json};
use tokio::fs;
use tokio::process::Command;
use tokio::time::{Duration, Instant, sleep};

use super::{ApiError, AppState, require_username};

#[derive(Clone, Copy, Default)]
struct CpuSample {
    user: u64,
    nice: u64,
    system: u64,
    idle: u64,
    iowait: u64,
    irq: u64,
    softirq: u64,
    steal: u64,
}

impl CpuSample {
    fn total(self) -> u64 {
        self.user
            .saturating_add(self.nice)
            .saturating_add(self.system)
            .saturating_add(self.idle)
            .saturating_add(self.iowait)
            .saturating_add(self.irq)
            .saturating_add(self.softirq)
            .saturating_add(self.steal)
    }

    fn idle_total(self) -> u64 {
        self.idle.saturating_add(self.iowait)
    }
}

#[derive(Clone, Copy, Default)]
struct NetSample {
    rx: u64,
    tx: u64,
}

pub(super) async fn system_stats(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    require_username(&headers, &state)?;
    Ok(Json(json!({
        "success": true,
        "data": collect_system_stats().await,
    })))
}

async fn collect_system_stats() -> Value {
    let cpuinfo = fs::read_to_string("/proc/cpuinfo")
        .await
        .unwrap_or_default();
    let first_cpu = read_cpu_sample().await;
    let first_net = read_net_sample().await;
    let started = Instant::now();
    sleep(Duration::from_millis(160)).await;
    let elapsed = started.elapsed().as_secs_f64().max(0.001);
    let second_cpu = read_cpu_sample().await;
    let second_net = read_net_sample().await;

    json!({
        "runtime": "rust",
        "time": Utc::now().to_rfc3339(),
        "cpu": cpu_stats(first_cpu, second_cpu, &cpuinfo),
        "mem": memory_stats().await,
        "disk": disk_stats().await,
        "network": network_stats(first_net, second_net, elapsed),
        "temp": temperature_stats().await,
        "uptime": uptime().await,
        "os": os_info().await,
    })
}

async fn read_cpu_sample() -> CpuSample {
    let Ok(content) = fs::read_to_string("/proc/stat").await else {
        return CpuSample::default();
    };
    let Some(line) = content.lines().find(|line| line.starts_with("cpu ")) else {
        return CpuSample::default();
    };
    let values: Vec<u64> = line
        .split_whitespace()
        .skip(1)
        .filter_map(|value| value.parse::<u64>().ok())
        .collect();
    CpuSample {
        user: values.first().copied().unwrap_or(0),
        nice: values.get(1).copied().unwrap_or(0),
        system: values.get(2).copied().unwrap_or(0),
        idle: values.get(3).copied().unwrap_or(0),
        iowait: values.get(4).copied().unwrap_or(0),
        irq: values.get(5).copied().unwrap_or(0),
        softirq: values.get(6).copied().unwrap_or(0),
        steal: values.get(7).copied().unwrap_or(0),
    }
}

fn cpu_stats(first: CpuSample, second: CpuSample, cpuinfo: &str) -> Value {
    let total_delta = second.total().saturating_sub(first.total()) as f64;
    let idle_delta = second.idle_total().saturating_sub(first.idle_total()) as f64;
    let user_delta = second
        .user
        .saturating_add(second.nice)
        .saturating_sub(first.user.saturating_add(first.nice)) as f64;
    let system_delta = second
        .system
        .saturating_add(second.irq)
        .saturating_add(second.softirq)
        .saturating_sub(
            first
                .system
                .saturating_add(first.irq)
                .saturating_add(first.softirq),
        ) as f64;
    let current_load = if total_delta > 0.0 {
        ((total_delta - idle_delta) / total_delta) * 100.0
    } else {
        0.0
    };
    let user_load = if total_delta > 0.0 {
        (user_delta / total_delta) * 100.0
    } else {
        0.0
    };
    let system_load = if total_delta > 0.0 {
        (system_delta / total_delta) * 100.0
    } else {
        0.0
    };

    json!({
        "currentLoad": round1(current_load),
        "currentLoadUser": round1(user_load),
        "currentLoadSystem": round1(system_load),
        "manufacturer": "Linux",
        "brand": cpuinfo_value(cpuinfo, &["model name", "Hardware", "Processor"]).unwrap_or_else(|| "CPU".to_string()),
        "speed": cpuinfo_value(cpuinfo, &["cpu MHz"]).and_then(|value| value.parse::<f64>().ok()).map(|mhz| round1(mhz / 1000.0)).unwrap_or(0.0),
        "cores": cpuinfo.lines().filter(|line| line.starts_with("processor")).count().max(1),
    })
}

async fn memory_stats() -> Value {
    let content = fs::read_to_string("/proc/meminfo")
        .await
        .unwrap_or_default();
    let total = meminfo_kb(&content, "MemTotal").saturating_mul(1024);
    let available = meminfo_kb(&content, "MemAvailable").saturating_mul(1024);
    let active = meminfo_kb(&content, "Active").saturating_mul(1024);
    let used = total.saturating_sub(available);
    json!({
        "total": total,
        "used": used,
        "active": if active > 0 { active } else { used },
        "available": available,
    })
}

async fn disk_stats() -> Value {
    let Ok(output) = Command::new("df").args(["-B1", "-T", "-P"]).output().await else {
        return json!([]);
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let rows: Vec<Value> = text
        .lines()
        .skip(1)
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 7 {
                return None;
            }
            let size = parts.get(2)?.parse::<u64>().ok()?;
            let used = parts.get(3)?.parse::<u64>().ok()?;
            let use_percent = parts
                .get(5)
                .and_then(|value| value.trim_end_matches('%').parse::<f64>().ok())
                .unwrap_or_else(|| {
                    if size > 0 {
                        (used as f64 / size as f64) * 100.0
                    } else {
                        0.0
                    }
                });
            Some(json!({
                "fs": parts[0],
                "type": parts[1],
                "size": size,
                "used": used,
                "use": round1(use_percent),
                "mount": parts[6],
            }))
        })
        .collect();
    json!(rows)
}

async fn read_net_sample() -> Vec<(String, NetSample)> {
    let content = fs::read_to_string("/proc/net/dev")
        .await
        .unwrap_or_default();
    content
        .lines()
        .skip(2)
        .filter_map(|line| {
            let (iface, rest) = line.split_once(':')?;
            let values: Vec<u64> = rest
                .split_whitespace()
                .filter_map(|value| value.parse::<u64>().ok())
                .collect();
            Some((
                iface.trim().to_string(),
                NetSample {
                    rx: values.first().copied().unwrap_or(0),
                    tx: values.get(8).copied().unwrap_or(0),
                },
            ))
        })
        .collect()
}

fn network_stats(
    first: Vec<(String, NetSample)>,
    second: Vec<(String, NetSample)>,
    elapsed: f64,
) -> Value {
    let rows: Vec<Value> = second
        .into_iter()
        .map(|(iface, now)| {
            let previous = first
                .iter()
                .find(|(name, _)| name == &iface)
                .map(|(_, sample)| *sample)
                .unwrap_or_default();
            json!({
                "iface": iface,
                "rx_sec": ((now.rx.saturating_sub(previous.rx) as f64) / elapsed).round() as u64,
                "tx_sec": ((now.tx.saturating_sub(previous.tx) as f64) / elapsed).round() as u64,
            })
        })
        .collect();
    json!(rows)
}

async fn temperature_stats() -> Value {
    let mut cores = Vec::new();
    if let Ok(mut entries) = fs::read_dir("/sys/class/thermal").await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path().join("temp");
            let Ok(raw) = fs::read_to_string(path).await else {
                continue;
            };
            let Ok(mut value) = raw.trim().parse::<f64>() else {
                continue;
            };
            if value > 1000.0 {
                value /= 1000.0;
            }
            if value.is_finite() && value > 0.0 {
                cores.push(round1(value));
            }
        }
    }
    let main = cores.first().copied().unwrap_or(0.0);
    let max = cores
        .iter()
        .copied()
        .fold(main, |current, value| current.max(value));
    json!({
        "main": main,
        "cores": cores,
        "max": max,
    })
}

async fn uptime() -> u64 {
    fs::read_to_string("/proc/uptime")
        .await
        .ok()
        .and_then(|content| {
            content
                .split_whitespace()
                .next()
                .and_then(|value| value.parse::<f64>().ok())
        })
        .map(|value| value.max(0.0).round() as u64)
        .unwrap_or(0)
}

async fn os_info() -> Value {
    let os_release = fs::read_to_string("/etc/os-release")
        .await
        .unwrap_or_default();
    let kernel = Command::new("uname")
        .arg("-r")
        .output()
        .await
        .ok()
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_default();
    let hostname = fs::read_to_string("/proc/sys/kernel/hostname")
        .await
        .unwrap_or_default()
        .trim()
        .to_string();
    json!({
        "distro": os_release_value(&os_release, "PRETTY_NAME")
            .or_else(|| os_release_value(&os_release, "NAME"))
            .unwrap_or_else(|| "Linux".to_string()),
        "release": os_release_value(&os_release, "VERSION_ID").unwrap_or_default(),
        "codename": os_release_value(&os_release, "VERSION_CODENAME").unwrap_or_default(),
        "kernel": kernel,
        "arch": std::env::consts::ARCH,
        "hostname": hostname,
    })
}

fn cpuinfo_value(content: &str, keys: &[&str]) -> Option<String> {
    for key in keys {
        for line in content.lines() {
            let Some((raw_key, raw_value)) = line.split_once(':') else {
                continue;
            };
            if raw_key.trim().eq_ignore_ascii_case(key) {
                let value = raw_value.trim();
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
        }
    }
    None
}

fn meminfo_kb(content: &str, key: &str) -> u64 {
    content
        .lines()
        .find_map(|line| {
            let (raw_key, rest) = line.split_once(':')?;
            if raw_key != key {
                return None;
            }
            rest.split_whitespace()
                .next()
                .and_then(|value| value.parse::<u64>().ok())
        })
        .unwrap_or(0)
}

fn os_release_value(content: &str, key: &str) -> Option<String> {
    content.lines().find_map(|line| {
        let (raw_key, raw_value) = line.split_once('=')?;
        if raw_key != key {
            return None;
        }
        Some(raw_value.trim_matches('"').to_string())
    })
}

fn round1(value: f64) -> f64 {
    if !value.is_finite() {
        return 0.0;
    }
    (value * 10.0).round() / 10.0
}
