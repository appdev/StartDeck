use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use bcrypt::{DEFAULT_COST, hash};
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;
use walkdir::WalkDir;

use crate::RuntimeConfig;
use crate::models::{
    AppSnapshot, IconRecord, NavGroup, NavItem, SystemConfig, UserRecord, WidgetRecord,
};

const CURRENT_SCHEMA_VERSION: i64 = 2;

pub async fn connect_sqlite(config: &RuntimeConfig) -> Result<SqlitePool> {
    config.ensure_dirs().context("create runtime directories")?;
    let options = SqliteConnectOptions::new()
        .filename(&config.sqlite_file)
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_secs(5));
    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(options)
        .await?;
    ensure_schema(&pool).await?;
    Ok(pool)
}

pub async fn ensure_schema(pool: &SqlitePool) -> Result<()> {
    if schema_needs_destructive_reset(pool).await? {
        tracing::warn!("incompatible sqlite schema detected; dropping runtime tables");
        destructive_reset_schema(pool).await?;
    }

    let statements = [
        r#"CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS system_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            auth_mode TEXT NOT NULL,
            enable_docker INTEGER NOT NULL,
            config_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            app_config_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS nav_groups (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            settings_json TEXT NOT NULL,
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
        r#"CREATE TABLE IF NOT EXISTS nav_items (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            icon TEXT NOT NULL,
            is_public INTEGER NOT NULL,
            sort_order INTEGER NOT NULL,
            metadata_json TEXT NOT NULL,
            FOREIGN KEY(group_id) REFERENCES nav_groups(id) ON DELETE CASCADE,
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_nav_items_group_order ON nav_items(group_id, sort_order)"#,
        r#"CREATE TABLE IF NOT EXISTS widgets (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            widget_type TEXT NOT NULL,
            enabled INTEGER NOT NULL,
            is_public INTEGER NOT NULL,
            data_json TEXT NOT NULL,
            layout_json TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_widgets_username_order ON widgets(username, sort_order)"#,
        r#"CREATE TABLE IF NOT EXISTS memos (
            widget_id TEXT NOT NULL,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            mode TEXT NOT NULL,
            server_ts INTEGER NOT NULL,
            PRIMARY KEY(widget_id, username),
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
        r#"CREATE TABLE IF NOT EXISTS runtime_cache (
            kind TEXT NOT NULL,
            cache_key TEXT NOT NULL,
            value_json TEXT NOT NULL,
            expires_at INTEGER,
            source_status TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY(kind, cache_key)
        )"#,
        r#"CREATE TABLE IF NOT EXISTS ip_location_cache (
            ip TEXT PRIMARY KEY,
            model_json TEXT NOT NULL,
            source TEXT NOT NULL,
            source_status TEXT NOT NULL,
            cached_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_ip_location_cache_expires_at
           ON ip_location_cache(expires_at)"#,
        r#"CREATE TABLE IF NOT EXISTS user_ip_locations (
            username TEXT NOT NULL,
            ip TEXT NOT NULL,
            first_seen_at INTEGER NOT NULL,
            last_seen_at INTEGER NOT NULL,
            seen_count INTEGER NOT NULL,
            PRIMARY KEY(username, ip),
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_user_ip_locations_username_last_seen
           ON user_ip_locations(username, last_seen_at DESC)"#,
        r#"CREATE TABLE IF NOT EXISTS config_versions (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS visitor_stats (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            total_visitors INTEGER NOT NULL,
            today_visitors INTEGER NOT NULL,
            last_visit_date TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS icon_records (
            host TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            final_url TEXT NOT NULL,
            description TEXT NOT NULL,
            background_color TEXT NOT NULL,
            source TEXT NOT NULL,
            fetched_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS icon_assets (
            host TEXT NOT NULL,
            asset_kind TEXT NOT NULL,
            url TEXT NOT NULL,
            is_local INTEGER NOT NULL,
            sort_order INTEGER NOT NULL,
            PRIMARY KEY(host, asset_kind, url),
            FOREIGN KEY(host) REFERENCES icon_records(host) ON DELETE CASCADE
        )"#,
        r#"INSERT OR IGNORE INTO schema_migrations(version, applied_at)
           VALUES (2, CAST(strftime('%s','now') AS INTEGER) * 1000)"#,
    ];
    for statement in statements {
        sqlx::query(statement).execute(pool).await?;
    }
    Ok(())
}

async fn schema_needs_destructive_reset(pool: &SqlitePool) -> Result<bool> {
    if !table_exists(pool, "schema_migrations").await? {
        return any_runtime_table_exists(pool).await;
    }

    let row = sqlx::query("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
        .fetch_one(pool)
        .await?;
    if row.get::<i64, _>("version") < CURRENT_SCHEMA_VERSION {
        return Ok(true);
    }

    runtime_cache_needs_destructive_reset(pool).await
}

async fn any_runtime_table_exists(pool: &SqlitePool) -> Result<bool> {
    for table in [
        "system_config",
        "users",
        "nav_groups",
        "nav_items",
        "widgets",
        "memos",
        "runtime_cache",
        "ip_location_cache",
        "user_ip_locations",
        "config_versions",
        "visitor_stats",
        "icon_records",
        "icon_assets",
    ] {
        if table_exists(pool, table).await? {
            return Ok(true);
        }
    }
    Ok(false)
}

async fn runtime_cache_needs_destructive_reset(pool: &SqlitePool) -> Result<bool> {
    if !table_exists(pool, "runtime_cache").await? {
        return Ok(false);
    }

    let rows = sqlx::query("PRAGMA table_info(runtime_cache)")
        .fetch_all(pool)
        .await?;
    let columns = rows
        .iter()
        .map(|row| row.get::<String, _>("name"))
        .collect::<Vec<_>>();
    let required_columns = [
        "kind",
        "cache_key",
        "value_json",
        "expires_at",
        "source_status",
        "updated_at",
    ];
    Ok(required_columns
        .iter()
        .any(|column| !columns.iter().any(|existing| existing == column)))
}

async fn table_exists(pool: &SqlitePool, table: &str) -> Result<bool> {
    let row = sqlx::query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
        .bind(table)
        .fetch_optional(pool)
        .await?;
    Ok(row.is_some())
}

async fn destructive_reset_schema(pool: &SqlitePool) -> Result<()> {
    let statements = [
        "DROP TABLE IF EXISTS integration_accounts",
        "DROP TABLE IF EXISTS widget_runtime_state",
        "DROP TABLE IF EXISTS json_documents",
        "DROP TABLE IF EXISTS storage_meta",
        "DROP TABLE IF EXISTS usage_snapshots",
        "DROP TABLE IF EXISTS icon_assets",
        "DROP TABLE IF EXISTS nav_items",
        "DROP TABLE IF EXISTS widgets",
        "DROP TABLE IF EXISTS memos",
        "DROP TABLE IF EXISTS runtime_cache",
        "DROP TABLE IF EXISTS user_ip_locations",
        "DROP TABLE IF EXISTS ip_location_cache",
        "DROP TABLE IF EXISTS config_versions",
        "DROP TABLE IF EXISTS visitor_stats",
        "DROP TABLE IF EXISTS icon_records",
        "DROP TABLE IF EXISTS nav_groups",
        "DROP TABLE IF EXISTS users",
        "DROP TABLE IF EXISTS system_config",
        "DROP TABLE IF EXISTS schema_migrations",
    ];
    for statement in statements {
        sqlx::query(statement).execute(pool).await?;
    }
    Ok(())
}

pub async fn import_legacy_data(pool: &SqlitePool, config: &RuntimeConfig) -> Result<()> {
    import_legacy_app_data(pool, config).await?;
    import_icon_service_data(pool, config).await?;
    Ok(())
}

pub async fn import_legacy_app_data(pool: &SqlitePool, config: &RuntimeConfig) -> Result<()> {
    if user_data_exists(pool).await? {
        tracing::info!("sqlite user data already exists; skipping legacy app-data import");
    } else {
        import_system_config(pool, &config.data_dir.join("system.json")).await?;
        let auth_mode = system_config(pool).await?.auth_mode;
        let admin_source = if auth_mode == "single" {
            first_existing_path([
                config.data_dir.join("data.json"),
                config.default_template_file.clone(),
            ])
        } else {
            config.users_dir.join("admin.json")
        };
        import_user_document(pool, "admin", &admin_source, &config.admin_password).await?;
        import_user_dir(pool, &config.users_dir, &config.admin_password).await?;
    }
    import_widget_cache(pool, &config.data_dir.join("widget_cache.json")).await?;
    Ok(())
}

pub async fn import_icon_service_data(pool: &SqlitePool, config: &RuntimeConfig) -> Result<()> {
    import_icon_seed_file(
        pool,
        &config.icon_service_resource_dir.join("seed-data.json"),
        "seed",
    )
    .await?;
    import_icon_cache_file(pool, &config.icon_service_data_dir.join("cache.json")).await?;
    Ok(())
}

async fn user_data_exists(pool: &SqlitePool) -> Result<bool> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;
    Ok(count > 0)
}

pub async fn system_config(pool: &SqlitePool) -> Result<SystemConfig> {
    let row =
        sqlx::query("SELECT auth_mode, enable_docker, config_json FROM system_config WHERE id = 1")
            .fetch_optional(pool)
            .await?;
    if let Some(row) = row {
        let mut extra: serde_json::Map<String, Value> =
            serde_json::from_str(row.get::<String, _>("config_json").as_str()).unwrap_or_default();
        let auth_mode = row.get::<String, _>("auth_mode");
        let enable_docker = row.get::<i64, _>("enable_docker") != 0;
        extra.remove("authMode");
        extra.remove("enableDocker");
        Ok(SystemConfig {
            auth_mode,
            enable_docker,
            extra,
        })
    } else {
        Ok(SystemConfig::default())
    }
}

pub async fn user_password_hash(pool: &SqlitePool, username: &str) -> Result<Option<String>> {
    Ok(
        sqlx::query("SELECT password_hash FROM users WHERE username = ?")
            .bind(username)
            .fetch_optional(pool)
            .await?
            .map(|row| row.get::<String, _>("password_hash")),
    )
}

pub async fn app_snapshot(pool: &SqlitePool, username: &str) -> Result<AppSnapshot> {
    let system_config = system_config(pool).await?;
    let user_row = sqlx::query(
        "SELECT username, role, app_config_json, updated_at FROM users WHERE username = ?",
    )
    .bind(username)
    .fetch_one(pool)
    .await?;
    let user = UserRecord {
        username: user_row.get("username"),
        role: user_row.get("role"),
        app_config: parse_json_column(&user_row, "app_config_json", json!({})),
        updated_at: millis_to_datetime(user_row.get::<i64, _>("updated_at")),
    };
    let groups = load_groups(pool, username).await?;
    let widgets = load_widgets(pool, username).await?;
    let version = [user.updated_at.timestamp_millis()]
        .into_iter()
        .chain(groups.iter().map(|group| group.sort_order))
        .chain(widgets.iter().map(|widget| widget.sort_order))
        .max()
        .unwrap_or_else(now_ms);
    Ok(AppSnapshot {
        username: username.to_string(),
        user,
        system_config,
        groups,
        widgets,
        version,
    })
}

pub async fn save_snapshot(pool: &SqlitePool, snapshot: &AppSnapshot) -> Result<()> {
    let now = now_ms();
    let mut tx = pool.begin().await?;
    let password = user_password_hash(pool, &snapshot.username)
        .await?
        .unwrap_or_else(|| {
            "$2b$10$6H8MgmfQbzQjFYgsvP4vveLKTptHYNm3LYenZAa/OCmQvDFpAAv5m".to_string()
        });
    sqlx::query(
        r#"INSERT INTO users(username, password_hash, role, app_config_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(username) DO UPDATE SET
             role=excluded.role,
             app_config_json=excluded.app_config_json,
             updated_at=excluded.updated_at"#,
    )
    .bind(&snapshot.username)
    .bind(password)
    .bind(&snapshot.user.role)
    .bind(snapshot.user.app_config.to_string())
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    sqlx::query("DELETE FROM nav_items WHERE username = ?")
        .bind(&snapshot.username)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM nav_groups WHERE username = ?")
        .bind(&snapshot.username)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM widgets WHERE username = ?")
        .bind(&snapshot.username)
        .execute(&mut *tx)
        .await?;
    for group in &snapshot.groups {
        insert_group(&mut tx, &snapshot.username, group).await?;
    }
    for widget in &snapshot.widgets {
        insert_widget(&mut tx, &snapshot.username, widget).await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn icon_record(pool: &SqlitePool, host: &str) -> Result<Option<IconRecord>> {
    let Some(row) = sqlx::query(
        "SELECT host, title, url, final_url, description, background_color, source, fetched_at FROM icon_records WHERE host = ?",
    )
    .bind(host)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let icon = sqlx::query(
        "SELECT url FROM icon_assets WHERE host = ? ORDER BY is_local DESC, sort_order ASC LIMIT 1",
    )
    .bind(host)
    .fetch_optional(pool)
    .await?
    .map(|asset| asset.get::<String, _>("url"));
    Ok(Some(IconRecord {
        host: row.get("host"),
        title: row.get("title"),
        url: row.get("url"),
        final_url: row.get("final_url"),
        description: row.get("description"),
        background_color: row.get("background_color"),
        icon,
        source: row.get("source"),
        fetched_at: millis_to_datetime(row.get::<i64, _>("fetched_at")),
    }))
}

pub async fn upsert_icon_record(pool: &SqlitePool, record: &IconRecord) -> Result<()> {
    let now = now_ms();
    sqlx::query(
        r#"INSERT INTO icon_records(host, title, url, final_url, description, background_color, source, fetched_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(host) DO UPDATE SET
             title=excluded.title,
             url=excluded.url,
             final_url=excluded.final_url,
             description=excluded.description,
             background_color=excluded.background_color,
             source=excluded.source,
             fetched_at=excluded.fetched_at,
             updated_at=excluded.updated_at"#,
    )
    .bind(&record.host)
    .bind(&record.title)
    .bind(&record.url)
    .bind(&record.final_url)
    .bind(&record.description)
    .bind(&record.background_color)
    .bind(&record.source)
    .bind(record.fetched_at.timestamp_millis())
    .bind(now)
    .execute(pool)
    .await?;
    if let Some(icon) = &record.icon {
        sqlx::query(
            r#"INSERT OR REPLACE INTO icon_assets(host, asset_kind, url, is_local, sort_order)
               VALUES (?, 'primary', ?, ?, 0)"#,
        )
        .bind(&record.host)
        .bind(icon)
        .bind(is_local_icon(icon) as i64)
        .execute(pool)
        .await?;
    }
    Ok(())
}

async fn import_system_config(pool: &SqlitePool, path: &Path) -> Result<()> {
    let value = read_json_or(path, json!({"authMode":"single","enableDocker":false}))?;
    let auth_mode = value
        .get("authMode")
        .and_then(Value::as_str)
        .unwrap_or("single")
        .to_string();
    let enable_docker = value
        .get("enableDocker")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    sqlx::query(
        r#"INSERT INTO system_config(id, auth_mode, enable_docker, config_json, updated_at)
           VALUES (1, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET auth_mode=excluded.auth_mode,
             enable_docker=excluded.enable_docker,
             config_json=excluded.config_json,
             updated_at=excluded.updated_at"#,
    )
    .bind(auth_mode)
    .bind(enable_docker as i64)
    .bind(value.to_string())
    .bind(now_ms())
    .execute(pool)
    .await?;
    Ok(())
}

async fn import_user_dir(
    pool: &SqlitePool,
    users_dir: &Path,
    default_password: &str,
) -> Result<()> {
    if !users_dir.exists() {
        return Ok(());
    }
    for entry in WalkDir::new(users_dir).max_depth(1) {
        let entry = entry?;
        if !entry.file_type().is_file()
            || entry.path().extension().and_then(|value| value.to_str()) != Some("json")
        {
            continue;
        }
        let username = entry
            .path()
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("user");
        import_user_document(pool, username, entry.path(), default_password).await?;
    }
    Ok(())
}

async fn import_user_document(
    pool: &SqlitePool,
    fallback_username: &str,
    path: &Path,
    default_password: &str,
) -> Result<()> {
    let value = read_json_or(path, json!({}))?;
    let username = value
        .get("username")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback_username);
    let password_hash = normalize_password_hash(value.get("password"), default_password)?;
    let app_config = value.get("appConfig").cloned().unwrap_or_else(|| json!({}));
    let now = now_ms();
    sqlx::query(
        r#"INSERT INTO users(username, password_hash, role, app_config_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(username) DO UPDATE SET
             password_hash=excluded.password_hash,
             app_config_json=excluded.app_config_json,
             updated_at=excluded.updated_at"#,
    )
    .bind(username)
    .bind(password_hash)
    .bind(if username == "admin" { "admin" } else { "user" })
    .bind(app_config.to_string())
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;
    sqlx::query("DELETE FROM nav_items WHERE username = ?")
        .bind(username)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM nav_groups WHERE username = ?")
        .bind(username)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM widgets WHERE username = ?")
        .bind(username)
        .execute(pool)
        .await?;
    if let Some(groups) = value.get("groups").and_then(Value::as_array) {
        for (index, group) in groups.iter().enumerate() {
            insert_legacy_group(pool, username, group, index as i64).await?;
        }
    }
    if let Some(widgets) = value.get("widgets").and_then(Value::as_array) {
        for (index, widget) in widgets.iter().enumerate() {
            insert_legacy_widget(pool, username, widget, index as i64).await?;
        }
    }
    Ok(())
}

async fn insert_legacy_group(
    pool: &SqlitePool,
    username: &str,
    group: &Value,
    sort_order: i64,
) -> Result<()> {
    let id = string_field(group, "id").unwrap_or_else(|| Uuid::new_v4().to_string());
    let title = string_field(group, "title").unwrap_or_else(|| "Group".to_string());
    let mut settings = group.clone();
    if let Some(map) = settings.as_object_mut() {
        map.remove("items");
    }
    sqlx::query(
        r#"INSERT INTO nav_groups(id, username, title, sort_order, settings_json)
           VALUES (?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(username)
    .bind(title)
    .bind(sort_order)
    .bind(settings.to_string())
    .execute(pool)
    .await?;
    if let Some(items) = group.get("items").and_then(Value::as_array) {
        for (index, item) in items.iter().enumerate() {
            insert_legacy_item(pool, username, &id, item, index as i64).await?;
        }
    }
    Ok(())
}

async fn insert_legacy_item(
    pool: &SqlitePool,
    username: &str,
    group_id: &str,
    item: &Value,
    sort_order: i64,
) -> Result<()> {
    let id = string_field(item, "id").unwrap_or_else(|| Uuid::new_v4().to_string());
    sqlx::query(
        r#"INSERT INTO nav_items(id, group_id, username, title, url, icon, is_public, sort_order, metadata_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(id)
    .bind(group_id)
    .bind(username)
    .bind(string_field(item, "title").unwrap_or_default())
    .bind(string_field(item, "url").unwrap_or_default())
    .bind(string_field(item, "icon").unwrap_or_default())
    .bind(item.get("isPublic").and_then(Value::as_bool).unwrap_or(true) as i64)
    .bind(sort_order)
    .bind(item.to_string())
    .execute(pool)
    .await?;
    Ok(())
}

async fn insert_legacy_widget(
    pool: &SqlitePool,
    username: &str,
    widget: &Value,
    sort_order: i64,
) -> Result<()> {
    let id = string_field(widget, "id").unwrap_or_else(|| Uuid::new_v4().to_string());
    let layout = widget
        .get("layouts")
        .cloned()
        .or_else(|| widget.get("layout").cloned())
        .unwrap_or_else(|| json!({}));
    sqlx::query(
        r#"INSERT INTO widgets(id, username, widget_type, enabled, is_public, data_json, layout_json, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(id)
    .bind(username)
    .bind(string_field(widget, "type").unwrap_or_else(|| "custom".to_string()))
    .bind(widget.get("enable").and_then(Value::as_bool).unwrap_or(true) as i64)
    .bind(widget.get("isPublic").and_then(Value::as_bool).unwrap_or(true) as i64)
    .bind(widget.get("data").cloned().unwrap_or_else(|| json!({})).to_string())
    .bind(layout.to_string())
    .bind(sort_order)
    .execute(pool)
    .await?;
    Ok(())
}

async fn insert_group(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    username: &str,
    group: &NavGroup,
) -> Result<()> {
    sqlx::query(
        r#"INSERT INTO nav_groups(id, username, title, sort_order, settings_json)
           VALUES (?, ?, ?, ?, ?)"#,
    )
    .bind(&group.id)
    .bind(username)
    .bind(&group.title)
    .bind(group.sort_order)
    .bind(group.settings.to_string())
    .execute(&mut **tx)
    .await?;
    for item in &group.items {
        sqlx::query(
            r#"INSERT INTO nav_items(id, group_id, username, title, url, icon, is_public, sort_order, metadata_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&item.id)
        .bind(&group.id)
        .bind(username)
        .bind(&item.title)
        .bind(&item.url)
        .bind(&item.icon)
        .bind(item.is_public as i64)
        .bind(item.sort_order)
        .bind(item.metadata.to_string())
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

async fn insert_widget(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    username: &str,
    widget: &WidgetRecord,
) -> Result<()> {
    sqlx::query(
        r#"INSERT INTO widgets(id, username, widget_type, enabled, is_public, data_json, layout_json, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&widget.id)
    .bind(username)
    .bind(&widget.widget_type)
    .bind(widget.enabled as i64)
    .bind(widget.is_public as i64)
    .bind(widget.data.to_string())
    .bind(widget.layout.to_string())
    .bind(widget.sort_order)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn load_groups(pool: &SqlitePool, username: &str) -> Result<Vec<NavGroup>> {
    let rows = sqlx::query(
        "SELECT id, title, sort_order, settings_json FROM nav_groups WHERE username = ? ORDER BY sort_order ASC, title ASC",
    )
    .bind(username)
    .fetch_all(pool)
    .await?;
    let mut groups = Vec::with_capacity(rows.len());
    for row in rows {
        let id: String = row.get("id");
        groups.push(NavGroup {
            items: load_items(pool, &id).await?,
            id,
            title: row.get("title"),
            sort_order: row.get("sort_order"),
            settings: parse_json_column(&row, "settings_json", json!({})),
        });
    }
    Ok(groups)
}

async fn load_items(pool: &SqlitePool, group_id: &str) -> Result<Vec<NavItem>> {
    let rows = sqlx::query(
        "SELECT id, title, url, icon, is_public, sort_order, metadata_json FROM nav_items WHERE group_id = ? ORDER BY sort_order ASC, title ASC",
    )
    .bind(group_id)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| NavItem {
            id: row.get("id"),
            title: row.get("title"),
            url: row.get("url"),
            icon: row.get("icon"),
            is_public: row.get::<i64, _>("is_public") != 0,
            sort_order: row.get("sort_order"),
            metadata: parse_json_column(&row, "metadata_json", json!({})),
        })
        .collect())
}

async fn load_widgets(pool: &SqlitePool, username: &str) -> Result<Vec<WidgetRecord>> {
    let rows = sqlx::query(
        "SELECT id, widget_type, enabled, is_public, data_json, layout_json, sort_order FROM widgets WHERE username = ? ORDER BY sort_order ASC, id ASC",
    )
    .bind(username)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| WidgetRecord {
            id: row.get("id"),
            widget_type: row.get("widget_type"),
            enabled: row.get::<i64, _>("enabled") != 0,
            is_public: row.get::<i64, _>("is_public") != 0,
            data: parse_json_column(&row, "data_json", json!({})),
            layout: parse_json_column(&row, "layout_json", json!({})),
            sort_order: row.get("sort_order"),
        })
        .collect())
}

async fn import_widget_cache(pool: &SqlitePool, path: &Path) -> Result<()> {
    let value = read_json_or(path, json!({}))?;
    let Some(kinds) = value.as_object() else {
        return Ok(());
    };
    for (kind, entries) in kinds {
        let Some(entries) = entries.as_object() else {
            continue;
        };
        for (key, item) in entries {
            let data = item.get("data").cloned().unwrap_or_else(|| json!(null));
            let ttl_ms = item.get("ttl").and_then(Value::as_i64).unwrap_or(0) * 1000;
            let updated_at = item
                .get("updatedAt")
                .and_then(Value::as_i64)
                .unwrap_or_else(now_ms);
            let expires_at = if ttl_ms > 0 {
                Some(updated_at + ttl_ms)
            } else {
                None
            };
            sqlx::query(
                r#"INSERT OR REPLACE INTO runtime_cache(kind, cache_key, value_json, expires_at, source_status, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)"#,
            )
            .bind(kind)
            .bind(key)
            .bind(data.to_string())
            .bind(expires_at)
            .bind(item.get("sourceStatus").and_then(Value::as_str).unwrap_or("imported"))
            .bind(updated_at)
            .execute(pool)
            .await?;
        }
    }
    Ok(())
}

async fn import_icon_seed_file(pool: &SqlitePool, path: &Path, source: &str) -> Result<()> {
    let value = read_json_or(path, json!({"items":[]}))?;
    let Some(items) = value.get("items").and_then(Value::as_array) else {
        return Ok(());
    };
    for item in items {
        let url = string_field(item, "url").unwrap_or_default();
        let host = normalize_host(&url).unwrap_or_else(|| Uuid::new_v4().to_string());
        let record = IconRecord {
            host,
            title: string_field(item, "title").unwrap_or_default(),
            url: url.clone(),
            final_url: url,
            description: String::new(),
            background_color: string_field(item, "background_color").unwrap_or_default(),
            icon: string_field(item, "icon_url")
                .or_else(|| string_field(item, "original_icon_url"))
                .map(|icon| normalize_icon_reference(&icon, None)),
            source: source.to_string(),
            fetched_at: Utc::now(),
        };
        upsert_icon_record(pool, &record).await?;
    }
    Ok(())
}

async fn import_icon_cache_file(pool: &SqlitePool, path: &Path) -> Result<()> {
    let value = read_json_or(path, json!({"records":[]}))?;
    let Some(records) = value.get("records").and_then(Value::as_array) else {
        return Ok(());
    };
    for item in records {
        let host = string_field(item, "host")
            .or_else(|| normalize_host(&string_field(item, "url").unwrap_or_default()));
        let Some(host) = host else {
            continue;
        };
        let fetched_at = item
            .get("fetchedAt")
            .and_then(Value::as_str)
            .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
            .map(|value| value.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);
        let record = IconRecord {
            host,
            title: string_field(item, "title")
                .or_else(|| string_field(item, "name"))
                .unwrap_or_default(),
            url: string_field(item, "url").unwrap_or_default(),
            final_url: string_field(item, "finalUrl").unwrap_or_default(),
            description: string_field(item, "description").unwrap_or_default(),
            background_color: string_field(item, "backgroundColor").unwrap_or_default(),
            icon: first_icon(item),
            source: string_field(item, "source").unwrap_or_else(|| "cache".to_string()),
            fetched_at,
        };
        upsert_icon_record(pool, &record).await?;
    }
    Ok(())
}

fn read_json_or(path: &Path, fallback: Value) -> Result<Value> {
    if !path.exists() {
        return Ok(fallback);
    }
    let bytes = std::fs::read(path).with_context(|| format!("read {}", path.display()))?;
    serde_json::from_slice(&bytes).with_context(|| format!("parse {}", path.display()))
}

fn first_existing_path<const N: usize>(paths: [PathBuf; N]) -> PathBuf {
    paths
        .iter()
        .find(|path| path.exists())
        .cloned()
        .unwrap_or_else(|| paths[0].clone())
}

fn normalize_password_hash(value: Option<&Value>, default_password: &str) -> Result<String> {
    let raw = value.and_then(Value::as_str).unwrap_or(default_password);
    if raw.starts_with('$') {
        return Ok(raw.to_string());
    }
    Ok(hash(raw, DEFAULT_COST)?)
}

fn parse_json_column(row: &sqlx::sqlite::SqliteRow, column: &str, fallback: Value) -> Value {
    row.try_get::<String, _>(column)
        .ok()
        .and_then(|value| serde_json::from_str(&value).ok())
        .unwrap_or(fallback)
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn first_icon(value: &Value) -> Option<String> {
    if let Some(local) = value
        .get("localIcons")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(Value::as_str)
    {
        return Some(normalize_icon_reference(local, Some("cache")));
    }
    value
        .get("icons")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(Value::as_str)
        .map(|icon| normalize_icon_reference(icon, None))
        .or_else(|| string_field(value, "src"))
}

fn normalize_icon_reference(icon: &str, default_local_prefix: Option<&str>) -> String {
    let trimmed = icon.trim().trim_start_matches('/');
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return trimmed.to_string();
    }
    if let Some(name) = trimmed.strip_prefix("data/icons/") {
        return format!("icons/{name}");
    }
    if let Some(name) = trimmed.strip_prefix("data/cache/") {
        return format!("cache/{name}");
    }
    if trimmed.contains('/') {
        return trimmed.to_string();
    }
    if let Some(prefix) = default_local_prefix {
        return format!("{prefix}/{trimmed}");
    }
    trimmed.to_string()
}

fn normalize_host(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    let without_scheme = raw
        .strip_prefix("https://")
        .or_else(|| raw.strip_prefix("http://"))
        .unwrap_or(raw);
    let host = without_scheme
        .split('/')
        .next()
        .unwrap_or_default()
        .split('@')
        .next_back()
        .unwrap_or_default()
        .split(':')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    if host.is_empty() { None } else { Some(host) }
}

fn is_local_icon(raw: &str) -> bool {
    raw.starts_with('/') || !raw.contains("://")
}

fn millis_to_datetime(ms: i64) -> DateTime<Utc> {
    DateTime::<Utc>::from_timestamp_millis(ms).unwrap_or_else(Utc::now)
}

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}
