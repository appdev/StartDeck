use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SystemConfig {
    #[serde(default)]
    pub enable_docker: bool,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRecord {
    pub username: String,
    pub role: String,
    pub app_config: Value,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavGroup {
    pub id: String,
    pub title: String,
    pub sort_order: i64,
    pub settings: Value,
    pub items: Vec<NavItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavItem {
    pub id: String,
    pub title: String,
    pub url: String,
    pub icon: String,
    pub is_public: bool,
    pub sort_order: i64,
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidgetRecord {
    pub id: String,
    #[serde(rename = "type")]
    pub widget_type: String,
    pub enabled: bool,
    pub is_public: bool,
    pub data: Value,
    pub layout: Value,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSnapshot {
    pub username: String,
    pub user: UserRecord,
    pub system_config: SystemConfig,
    pub groups: Vec<NavGroup>,
    pub widgets: Vec<WidgetRecord>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IconAssetRecord {
    pub url: String,
    pub content_type: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub byte_size: i64,
    pub quality_score: i64,
    pub quality_checked_at: i64,
    pub quality_refresh_after: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IconRecord {
    pub host: String,
    pub title: String,
    pub url: String,
    pub final_url: String,
    pub description: String,
    pub background_color: String,
    pub icon: Option<String>,
    pub icon_asset: Option<IconAssetRecord>,
    pub source: String,
    pub fetch_status: String,
    pub failure_kind: String,
    pub failure_count: i64,
    pub retry_after: i64,
    pub last_error: String,
    pub fetched_at: DateTime<Utc>,
}
