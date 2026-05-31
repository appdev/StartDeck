use std::collections::BTreeMap;
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
    AppSnapshot, IconAssetRecord, IconRecord, NavGroup, NavItem, SystemConfig, UserRecord,
    WidgetRecord,
};

const CURRENT_SCHEMA_VERSION: i64 = 7;

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
    migrate_schema(pool).await?;

    let statements = [
        r#"CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS system_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
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
            id TEXT NOT NULL,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            settings_json TEXT NOT NULL,
            PRIMARY KEY(username, id),
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
        r#"CREATE TABLE IF NOT EXISTS nav_items (
            id TEXT NOT NULL,
            group_id TEXT NOT NULL,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            icon TEXT NOT NULL,
            is_public INTEGER NOT NULL,
            sort_order INTEGER NOT NULL,
            metadata_json TEXT NOT NULL,
            PRIMARY KEY(username, id),
            FOREIGN KEY(username, group_id) REFERENCES nav_groups(username, id) ON DELETE CASCADE,
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_nav_items_group_order ON nav_items(username, group_id, sort_order)"#,
        r#"CREATE TABLE IF NOT EXISTS widgets (
            id TEXT NOT NULL,
            username TEXT NOT NULL,
            widget_type TEXT NOT NULL,
            enabled INTEGER NOT NULL,
            is_public INTEGER NOT NULL,
            data_json TEXT NOT NULL,
            layout_json TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            PRIMARY KEY(username, id),
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_widgets_username_order ON widgets(username, sort_order)"#,
        r#"CREATE TABLE IF NOT EXISTS ai_usage_credentials (
            username TEXT NOT NULL,
            widget_id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            credential_type TEXT NOT NULL,
            encrypted_secret TEXT NOT NULL,
            encrypted_account_id TEXT,
            nonce TEXT NOT NULL,
            account_nonce TEXT,
            key_version INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY(username, widget_id, provider_id),
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_ai_usage_credentials_username
           ON ai_usage_credentials(username, updated_at DESC)"#,
        r#"CREATE TABLE IF NOT EXISTS tapd_credentials (
            username TEXT NOT NULL,
            widget_id TEXT NOT NULL,
            credential_type TEXT NOT NULL,
            encrypted_material TEXT NOT NULL,
            nonce TEXT NOT NULL,
            key_version INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY(username, widget_id),
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_tapd_credentials_username
           ON tapd_credentials(username, updated_at DESC)"#,
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
            username TEXT NOT NULL,
            label TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_config_versions_username_created
           ON config_versions(username, created_at DESC)"#,
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
            fetch_status TEXT NOT NULL DEFAULT 'ok',
            failure_kind TEXT NOT NULL DEFAULT '',
            failure_count INTEGER NOT NULL DEFAULT 0,
            retry_after INTEGER NOT NULL DEFAULT 0,
            last_error TEXT NOT NULL DEFAULT '',
            fetched_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS icon_assets (
            host TEXT NOT NULL,
            asset_kind TEXT NOT NULL,
            url TEXT NOT NULL,
            is_local INTEGER NOT NULL,
            sort_order INTEGER NOT NULL,
            content_type TEXT NOT NULL DEFAULT '',
            width INTEGER,
            height INTEGER,
            byte_size INTEGER NOT NULL DEFAULT 0,
            quality_score INTEGER NOT NULL DEFAULT 0,
            quality_checked_at INTEGER NOT NULL DEFAULT 0,
            quality_refresh_after INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY(host, asset_kind, url),
            FOREIGN KEY(host) REFERENCES icon_records(host) ON DELETE CASCADE
        )"#,
        r#"CREATE TABLE IF NOT EXISTS managed_icon_blobs (
            id TEXT PRIMARY KEY,
            sha256 TEXT NOT NULL UNIQUE,
            content_type TEXT NOT NULL,
            byte_size INTEGER NOT NULL,
            storage_path TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS managed_icon_assets (
            id TEXT PRIMARY KEY,
            visibility TEXT NOT NULL CHECK (visibility IN ('private', 'template')),
            owner_username TEXT,
            blob_id TEXT NOT NULL,
            source_kind TEXT NOT NULL,
            source_ref TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            content_type TEXT NOT NULL,
            lifecycle TEXT NOT NULL DEFAULT 'active',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY(blob_id) REFERENCES managed_icon_blobs(id) ON DELETE RESTRICT
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_managed_icon_assets_scope_sha
           ON managed_icon_assets(visibility, owner_username, sha256, lifecycle)"#,
        r#"CREATE INDEX IF NOT EXISTS idx_managed_icon_assets_blob
           ON managed_icon_assets(blob_id)"#,
        r#"INSERT OR IGNORE INTO schema_migrations(version, applied_at)
           VALUES (7, CAST(strftime('%s','now') AS INTEGER) * 1000)"#,
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
    if row.get::<i64, _>("version") < 2 {
        return Ok(true);
    }

    runtime_cache_needs_destructive_reset(pool).await
}

async fn migrate_schema(pool: &SqlitePool) -> Result<()> {
    if !table_exists(pool, "schema_migrations").await? {
        return Ok(());
    }
    let row = sqlx::query("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
        .fetch_one(pool)
        .await?;
    let version = row.get::<i64, _>("version");
    if version < 3 {
        migrate_to_schema_3(pool).await?;
    }
    if version < 4 {
        migrate_to_schema_4(pool).await?;
    }
    if version < 5 {
        migrate_to_schema_5(pool).await?;
    }
    if version < 6 {
        migrate_to_schema_6(pool).await?;
    }
    if version < CURRENT_SCHEMA_VERSION {
        migrate_to_schema_7(pool).await?;
    }
    Ok(())
}

async fn migrate_to_schema_3(pool: &SqlitePool) -> Result<()> {
    rebuild_system_config_table(pool).await?;
    rebuild_nav_groups_table(pool).await?;
    rebuild_nav_items_table(pool).await?;
    if table_exists(pool, "nav_groups_v2").await? {
        sqlx::query("DROP TABLE nav_groups_v2")
            .execute(pool)
            .await?;
    }
    rebuild_widgets_table(pool).await?;
    rebuild_config_versions_table(pool).await?;
    sqlx::query("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (3, ?)")
        .bind(now_ms())
        .execute(pool)
        .await?;
    Ok(())
}

async fn migrate_to_schema_4(pool: &SqlitePool) -> Result<()> {
    if table_exists(pool, "icon_records").await? {
        add_column_if_missing(
            pool,
            "icon_records",
            "fetch_status",
            "ALTER TABLE icon_records ADD COLUMN fetch_status TEXT NOT NULL DEFAULT 'ok'",
        )
        .await?;
        add_column_if_missing(
            pool,
            "icon_records",
            "failure_kind",
            "ALTER TABLE icon_records ADD COLUMN failure_kind TEXT NOT NULL DEFAULT ''",
        )
        .await?;
        add_column_if_missing(
            pool,
            "icon_records",
            "failure_count",
            "ALTER TABLE icon_records ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0",
        )
        .await?;
        add_column_if_missing(
            pool,
            "icon_records",
            "retry_after",
            "ALTER TABLE icon_records ADD COLUMN retry_after INTEGER NOT NULL DEFAULT 0",
        )
        .await?;
        add_column_if_missing(
            pool,
            "icon_records",
            "last_error",
            "ALTER TABLE icon_records ADD COLUMN last_error TEXT NOT NULL DEFAULT ''",
        )
        .await?;
    }
    sqlx::query("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (4, ?)")
        .bind(now_ms())
        .execute(pool)
        .await?;
    Ok(())
}

async fn migrate_to_schema_5(pool: &SqlitePool) -> Result<()> {
    let mut normalized_assets = BTreeMap::<(String, String, String), (i64, i64)>::new();
    if table_exists(pool, "icon_assets").await? {
        let rows =
            sqlx::query("SELECT host, asset_kind, url, is_local, sort_order FROM icon_assets")
                .fetch_all(pool)
                .await?;
        for row in rows {
            let Some(normalized_url) =
                normalize_icon_reference(row.get::<String, _>("url").as_str())
            else {
                continue;
            };
            let key = (
                row.get::<String, _>("host"),
                row.get::<String, _>("asset_kind"),
                normalized_url,
            );
            let is_local = row.get::<i64, _>("is_local");
            let sort_order = row.get::<i64, _>("sort_order");
            normalized_assets
                .entry(key)
                .and_modify(|asset| {
                    asset.0 = asset.0.max(is_local);
                    asset.1 = asset.1.min(sort_order);
                })
                .or_insert((is_local, sort_order));
        }
    }

    let mut tx = pool.begin().await?;
    if table_exists(pool, "icon_assets").await? {
        sqlx::query(
            r#"CREATE TEMP TABLE icon_assets_v5 (
                host TEXT NOT NULL,
                asset_kind TEXT NOT NULL,
                url TEXT NOT NULL,
                is_local INTEGER NOT NULL,
                sort_order INTEGER NOT NULL,
                PRIMARY KEY(host, asset_kind, url)
            )"#,
        )
        .execute(&mut *tx)
        .await?;
        for ((host, asset_kind, url), (is_local, sort_order)) in normalized_assets {
            sqlx::query(
                r#"INSERT INTO icon_assets_v5(host, asset_kind, url, is_local, sort_order)
                   VALUES (?, ?, ?, ?, ?)"#,
            )
            .bind(host)
            .bind(asset_kind)
            .bind(url)
            .bind(is_local)
            .bind(sort_order)
            .execute(&mut *tx)
            .await?;
        }
        sqlx::query("DELETE FROM icon_assets")
            .execute(&mut *tx)
            .await?;
        sqlx::query(
            r#"INSERT INTO icon_assets(host, asset_kind, url, is_local, sort_order)
               SELECT host, asset_kind, url, is_local, sort_order
               FROM icon_assets_v5
               ORDER BY host, asset_kind, sort_order, url"#,
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query("DROP TABLE icon_assets_v5")
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (5, ?)")
        .bind(now_ms())
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

async fn migrate_to_schema_6(pool: &SqlitePool) -> Result<()> {
    create_managed_icon_tables(pool).await?;
    sqlx::query("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (6, ?)")
        .bind(now_ms())
        .execute(pool)
        .await?;
    Ok(())
}

async fn migrate_to_schema_7(pool: &SqlitePool) -> Result<()> {
    if table_exists(pool, "icon_assets").await? {
        add_column_if_missing(
            pool,
            "icon_assets",
            "content_type",
            "ALTER TABLE icon_assets ADD COLUMN content_type TEXT NOT NULL DEFAULT ''",
        )
        .await?;
        add_column_if_missing(
            pool,
            "icon_assets",
            "width",
            "ALTER TABLE icon_assets ADD COLUMN width INTEGER",
        )
        .await?;
        add_column_if_missing(
            pool,
            "icon_assets",
            "height",
            "ALTER TABLE icon_assets ADD COLUMN height INTEGER",
        )
        .await?;
        add_column_if_missing(
            pool,
            "icon_assets",
            "byte_size",
            "ALTER TABLE icon_assets ADD COLUMN byte_size INTEGER NOT NULL DEFAULT 0",
        )
        .await?;
        add_column_if_missing(
            pool,
            "icon_assets",
            "quality_score",
            "ALTER TABLE icon_assets ADD COLUMN quality_score INTEGER NOT NULL DEFAULT 0",
        )
        .await?;
        add_column_if_missing(
            pool,
            "icon_assets",
            "quality_checked_at",
            "ALTER TABLE icon_assets ADD COLUMN quality_checked_at INTEGER NOT NULL DEFAULT 0",
        )
        .await?;
        add_column_if_missing(
            pool,
            "icon_assets",
            "quality_refresh_after",
            "ALTER TABLE icon_assets ADD COLUMN quality_refresh_after INTEGER NOT NULL DEFAULT 0",
        )
        .await?;
    }
    sqlx::query("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (7, ?)")
        .bind(now_ms())
        .execute(pool)
        .await?;
    Ok(())
}

async fn create_managed_icon_tables(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS managed_icon_blobs (
            id TEXT PRIMARY KEY,
            sha256 TEXT NOT NULL UNIQUE,
            content_type TEXT NOT NULL,
            byte_size INTEGER NOT NULL,
            storage_path TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )"#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS managed_icon_assets (
            id TEXT PRIMARY KEY,
            visibility TEXT NOT NULL CHECK (visibility IN ('private', 'template')),
            owner_username TEXT,
            blob_id TEXT NOT NULL,
            source_kind TEXT NOT NULL,
            source_ref TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            content_type TEXT NOT NULL,
            lifecycle TEXT NOT NULL DEFAULT 'active',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY(blob_id) REFERENCES managed_icon_blobs(id) ON DELETE RESTRICT
        )"#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        r#"CREATE INDEX IF NOT EXISTS idx_managed_icon_assets_scope_sha
           ON managed_icon_assets(visibility, owner_username, sha256, lifecycle)"#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        r#"CREATE INDEX IF NOT EXISTS idx_managed_icon_assets_blob
           ON managed_icon_assets(blob_id)"#,
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn rebuild_system_config_table(pool: &SqlitePool) -> Result<()> {
    if !table_exists(pool, "system_config").await?
        || !table_has_column(pool, "system_config", "auth_mode").await?
    {
        return Ok(());
    }
    sqlx::query("ALTER TABLE system_config RENAME TO system_config_v2")
        .execute(pool)
        .await?;
    sqlx::query(
        r#"CREATE TABLE system_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            enable_docker INTEGER NOT NULL,
            config_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )"#,
    )
    .execute(pool)
    .await?;
    let rows =
        sqlx::query("SELECT id, enable_docker, config_json, updated_at FROM system_config_v2")
            .fetch_all(pool)
            .await?;
    for row in rows {
        sqlx::query(
            "INSERT OR REPLACE INTO system_config(id, enable_docker, config_json, updated_at) VALUES (?, ?, ?, ?)",
        )
        .bind(row.get::<i64, _>("id"))
        .bind(row.get::<i64, _>("enable_docker"))
        .bind(sanitize_system_config_json(&row.get::<String, _>("config_json")).to_string())
        .bind(row.get::<i64, _>("updated_at"))
        .execute(pool)
        .await?;
    }
    sqlx::query("DROP TABLE system_config_v2")
        .execute(pool)
        .await?;
    Ok(())
}

async fn rebuild_nav_groups_table(pool: &SqlitePool) -> Result<()> {
    if !table_exists(pool, "nav_groups").await?
        || !table_primary_key_is_single_id(pool, "nav_groups").await?
    {
        return Ok(());
    }
    sqlx::query("ALTER TABLE nav_groups RENAME TO nav_groups_v2")
        .execute(pool)
        .await?;
    sqlx::query(
        r#"CREATE TABLE nav_groups (
            id TEXT NOT NULL,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            settings_json TEXT NOT NULL,
            PRIMARY KEY(username, id),
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        r#"INSERT OR REPLACE INTO nav_groups(username, id, title, sort_order, settings_json)
           SELECT username, id, title, sort_order, settings_json FROM nav_groups_v2"#,
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn rebuild_nav_items_table(pool: &SqlitePool) -> Result<()> {
    if !table_exists(pool, "nav_items").await?
        || !table_primary_key_is_single_id(pool, "nav_items").await?
    {
        return Ok(());
    }
    sqlx::query("ALTER TABLE nav_items RENAME TO nav_items_v2")
        .execute(pool)
        .await?;
    sqlx::query(
        r#"CREATE TABLE nav_items (
            id TEXT NOT NULL,
            group_id TEXT NOT NULL,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            icon TEXT NOT NULL,
            is_public INTEGER NOT NULL,
            sort_order INTEGER NOT NULL,
            metadata_json TEXT NOT NULL,
            PRIMARY KEY(username, id),
            FOREIGN KEY(username, group_id) REFERENCES nav_groups(username, id) ON DELETE CASCADE,
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        r#"INSERT OR REPLACE INTO nav_items(username, id, group_id, title, url, icon, is_public, sort_order, metadata_json)
           SELECT item.username, item.id, item.group_id, item.title, item.url, item.icon, item.is_public, item.sort_order, item.metadata_json
           FROM nav_items_v2 item
           WHERE EXISTS (
             SELECT 1 FROM nav_groups grp
             WHERE grp.username = item.username AND grp.id = item.group_id
           )"#,
    )
    .execute(pool)
    .await?;
    sqlx::query("DROP TABLE nav_items_v2").execute(pool).await?;
    Ok(())
}

async fn rebuild_widgets_table(pool: &SqlitePool) -> Result<()> {
    if !table_exists(pool, "widgets").await?
        || !table_primary_key_is_single_id(pool, "widgets").await?
    {
        return Ok(());
    }
    sqlx::query("ALTER TABLE widgets RENAME TO widgets_v2")
        .execute(pool)
        .await?;
    sqlx::query(
        r#"CREATE TABLE widgets (
            id TEXT NOT NULL,
            username TEXT NOT NULL,
            widget_type TEXT NOT NULL,
            enabled INTEGER NOT NULL,
            is_public INTEGER NOT NULL,
            data_json TEXT NOT NULL,
            layout_json TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            PRIMARY KEY(username, id),
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        r#"INSERT OR REPLACE INTO widgets(username, id, widget_type, enabled, is_public, data_json, layout_json, sort_order)
           SELECT username, id, widget_type, enabled, is_public, data_json, layout_json, sort_order FROM widgets_v2"#,
    )
    .execute(pool)
    .await?;
    sqlx::query("DROP TABLE widgets_v2").execute(pool).await?;
    Ok(())
}

async fn rebuild_config_versions_table(pool: &SqlitePool) -> Result<()> {
    if !table_exists(pool, "config_versions").await? {
        return Ok(());
    }
    if table_has_column(pool, "config_versions", "username").await? {
        return Ok(());
    }
    sqlx::query("ALTER TABLE config_versions RENAME TO config_versions_v2")
        .execute(pool)
        .await?;
    sqlx::query(
        r#"CREATE TABLE config_versions (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            label TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )"#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        r#"INSERT OR REPLACE INTO config_versions(id, username, label, snapshot_json, created_at)
           SELECT id, 'admin', label, snapshot_json, created_at FROM config_versions_v2"#,
    )
    .execute(pool)
    .await?;
    sqlx::query("DROP TABLE config_versions_v2")
        .execute(pool)
        .await?;
    Ok(())
}

async fn any_runtime_table_exists(pool: &SqlitePool) -> Result<bool> {
    for table in [
        "system_config",
        "users",
        "nav_groups",
        "nav_items",
        "widgets",
        "ai_usage_credentials",
        "tapd_credentials",
        "memos",
        "runtime_cache",
        "ip_location_cache",
        "user_ip_locations",
        "config_versions",
        "visitor_stats",
        "icon_records",
        "icon_assets",
        "managed_icon_blobs",
        "managed_icon_assets",
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

async fn table_has_column(pool: &SqlitePool, table: &str, column: &str) -> Result<bool> {
    let rows = sqlx::query(table_info_sql(table)?).fetch_all(pool).await?;
    Ok(rows
        .iter()
        .any(|row| row.get::<String, _>("name") == column))
}

async fn add_column_if_missing(
    pool: &SqlitePool,
    table: &str,
    column: &str,
    statement: &'static str,
) -> Result<()> {
    if !table_has_column(pool, table, column).await? {
        sqlx::query(statement).execute(pool).await?;
    }
    Ok(())
}

async fn table_primary_key_is_single_id(pool: &SqlitePool, table: &str) -> Result<bool> {
    let rows = sqlx::query(table_info_sql(table)?).fetch_all(pool).await?;
    let pk_columns = rows
        .iter()
        .filter(|row| row.get::<i64, _>("pk") > 0)
        .map(|row| row.get::<String, _>("name"))
        .collect::<Vec<_>>();
    Ok(pk_columns.len() == 1 && pk_columns[0] == "id")
}

fn table_info_sql(table: &str) -> Result<&'static str> {
    match table {
        "system_config" => Ok("PRAGMA table_info(system_config)"),
        "nav_groups" => Ok("PRAGMA table_info(nav_groups)"),
        "nav_items" => Ok("PRAGMA table_info(nav_items)"),
        "widgets" => Ok("PRAGMA table_info(widgets)"),
        "config_versions" => Ok("PRAGMA table_info(config_versions)"),
        "icon_records" => Ok("PRAGMA table_info(icon_records)"),
        "icon_assets" => Ok("PRAGMA table_info(icon_assets)"),
        _ => anyhow::bail!("unsupported table_info target: {table}"),
    }
}

fn sanitize_system_config_json(raw: &str) -> Value {
    let mut value = serde_json::from_str(raw).unwrap_or_else(|_| json!({}));
    if !value.is_object() {
        value = json!({});
    }
    if let Some(map) = value.as_object_mut() {
        map.remove("authMode");
        map.remove("auth_mode");
    }
    value
}

async fn destructive_reset_schema(pool: &SqlitePool) -> Result<()> {
    let statements = [
        "DROP TABLE IF EXISTS integration_accounts",
        "DROP TABLE IF EXISTS widget_runtime_state",
        "DROP TABLE IF EXISTS json_documents",
        "DROP TABLE IF EXISTS storage_meta",
        "DROP TABLE IF EXISTS usage_snapshots",
        "DROP TABLE IF EXISTS managed_icon_assets",
        "DROP TABLE IF EXISTS managed_icon_blobs",
        "DROP TABLE IF EXISTS icon_assets",
        "DROP TABLE IF EXISTS nav_items",
        "DROP TABLE IF EXISTS widgets",
        "DROP TABLE IF EXISTS ai_usage_credentials",
        "DROP TABLE IF EXISTS tapd_credentials",
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
    import_meta_server_data(pool, config).await?;
    Ok(())
}

pub async fn import_legacy_app_data(pool: &SqlitePool, config: &RuntimeConfig) -> Result<()> {
    if user_data_exists(pool).await? {
        tracing::info!("sqlite user data already exists; skipping legacy app-data import");
    } else {
        import_system_config(pool, &config.data_dir.join("system.json")).await?;
        let admin_source = first_existing_path([
            config.data_dir.join("data.json"),
            config.users_dir.join("admin.json"),
            config.default_template_file.clone(),
        ]);
        import_user_document(pool, "admin", &admin_source, &config.admin_password).await?;
        import_user_dir(pool, &config.users_dir, &config.admin_password).await?;
    }
    import_widget_cache(pool, &config.data_dir.join("widget_cache.json")).await?;
    Ok(())
}

pub async fn import_meta_server_data(pool: &SqlitePool, config: &RuntimeConfig) -> Result<()> {
    import_icon_seed_file(
        pool,
        &config.meta_server_resource_dir.join("seed-data.json"),
        "seed",
    )
    .await?;
    Ok(())
}

async fn user_data_exists(pool: &SqlitePool) -> Result<bool> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;
    Ok(count > 0)
}

pub async fn system_config(pool: &SqlitePool) -> Result<SystemConfig> {
    let row = sqlx::query("SELECT enable_docker, config_json FROM system_config WHERE id = 1")
        .fetch_optional(pool)
        .await?;
    if let Some(row) = row {
        let mut extra: serde_json::Map<String, Value> =
            serde_json::from_str(row.get::<String, _>("config_json").as_str()).unwrap_or_default();
        let enable_docker = row.get::<i64, _>("enable_docker") != 0;
        extra.remove("authMode");
        extra.remove("auth_mode");
        extra.remove("enableDocker");
        Ok(SystemConfig {
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
        r#"SELECT host, title, url, final_url, description, background_color, source,
                  fetch_status, failure_kind, failure_count, retry_after, last_error, fetched_at
           FROM icon_records WHERE host = ?"#,
    )
    .bind(host)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let icon_asset = sqlx::query(
        r#"SELECT url, content_type, width, height, byte_size, quality_score,
                  quality_checked_at, quality_refresh_after
           FROM icon_assets
           WHERE host = ?
           ORDER BY is_local DESC, sort_order ASC
           LIMIT 1"#,
    )
    .bind(host)
    .fetch_optional(pool)
    .await?
    .map(|asset| IconAssetRecord {
        url: asset.get("url"),
        content_type: asset.get("content_type"),
        width: asset.get("width"),
        height: asset.get("height"),
        byte_size: asset.get("byte_size"),
        quality_score: asset.get("quality_score"),
        quality_checked_at: asset.get("quality_checked_at"),
        quality_refresh_after: asset.get("quality_refresh_after"),
    });
    let icon = icon_asset.as_ref().map(|asset| asset.url.clone());
    Ok(Some(IconRecord {
        host: row.get("host"),
        title: row.get("title"),
        url: row.get("url"),
        final_url: row.get("final_url"),
        description: row.get("description"),
        background_color: row.get("background_color"),
        icon,
        icon_asset,
        source: row.get("source"),
        fetch_status: row.get("fetch_status"),
        failure_kind: row.get("failure_kind"),
        failure_count: row.get("failure_count"),
        retry_after: row.get("retry_after"),
        last_error: row.get("last_error"),
        fetched_at: millis_to_datetime(row.get::<i64, _>("fetched_at")),
    }))
}

pub async fn upsert_icon_record(pool: &SqlitePool, record: &IconRecord) -> Result<()> {
    let now = now_ms();
    let mut tx = pool.begin().await?;
    sqlx::query(
        r#"INSERT INTO icon_records(
             host, title, url, final_url, description, background_color, source,
             fetch_status, failure_kind, failure_count, retry_after, last_error, fetched_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(host) DO UPDATE SET
             title=excluded.title,
             url=excluded.url,
             final_url=excluded.final_url,
             description=excluded.description,
             background_color=excluded.background_color,
             source=excluded.source,
             fetch_status=excluded.fetch_status,
             failure_kind=excluded.failure_kind,
             failure_count=excluded.failure_count,
             retry_after=excluded.retry_after,
             last_error=excluded.last_error,
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
    .bind(&record.fetch_status)
    .bind(&record.failure_kind)
    .bind(record.failure_count)
    .bind(record.retry_after)
    .bind(&record.last_error)
    .bind(record.fetched_at.timestamp_millis())
    .bind(now)
    .execute(&mut *tx)
    .await?;
    sqlx::query("DELETE FROM icon_assets WHERE host = ? AND asset_kind = 'primary'")
        .bind(&record.host)
        .execute(&mut *tx)
        .await?;
    if record.fetch_status == "ok"
        && let Some(icon) = record.icon.as_deref().and_then(normalize_icon_reference)
    {
        let quality = record.icon_asset.as_ref().filter(|asset| {
            normalize_icon_reference(&asset.url)
                .as_deref()
                .is_some_and(|url| url == icon)
        });
        sqlx::query(
            r#"INSERT OR REPLACE INTO icon_assets(
                 host, asset_kind, url, is_local, sort_order, content_type, width, height,
                 byte_size, quality_score, quality_checked_at, quality_refresh_after
               )
               VALUES (?, 'primary', ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&record.host)
        .bind(&icon)
        .bind(is_local_icon(&icon) as i64)
        .bind(
            quality
                .map(|asset| asset.content_type.as_str())
                .unwrap_or(""),
        )
        .bind(quality.and_then(|asset| asset.width))
        .bind(quality.and_then(|asset| asset.height))
        .bind(quality.map(|asset| asset.byte_size).unwrap_or(0))
        .bind(quality.map(|asset| asset.quality_score).unwrap_or(0))
        .bind(quality.map(|asset| asset.quality_checked_at).unwrap_or(0))
        .bind(
            quality
                .map(|asset| asset.quality_refresh_after)
                .unwrap_or(0),
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

async fn import_system_config(pool: &SqlitePool, path: &Path) -> Result<()> {
    let value = read_json_or(path, json!({"enableDocker":false}))?;
    let enable_docker = value
        .get("enableDocker")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let config_json = sanitize_system_config_json(&value.to_string());
    sqlx::query(
        r#"INSERT INTO system_config(id, enable_docker, config_json, updated_at)
           VALUES (1, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             enable_docker=excluded.enable_docker,
             config_json=excluded.config_json,
             updated_at=excluded.updated_at"#,
    )
    .bind(enable_docker as i64)
    .bind(config_json.to_string())
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
        if username == "admin" {
            continue;
        }
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
    .bind(false as i64)
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
    .bind(false as i64)
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
            items: load_items(pool, username, &id).await?,
            id,
            title: row.get("title"),
            sort_order: row.get("sort_order"),
            settings: parse_json_column(&row, "settings_json", json!({})),
        });
    }
    Ok(groups)
}

async fn load_items(pool: &SqlitePool, username: &str, group_id: &str) -> Result<Vec<NavItem>> {
    let rows = sqlx::query(
        "SELECT id, title, url, icon, is_public, sort_order, metadata_json FROM nav_items WHERE username = ? AND group_id = ? ORDER BY sort_order ASC, title ASC",
    )
    .bind(username)
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
                .and_then(|icon| normalize_icon_reference(&icon))
                .or_else(|| {
                    string_field(item, "original_icon_url")
                        .and_then(|icon| normalize_icon_reference(&icon))
                }),
            icon_asset: None,
            source: source.to_string(),
            fetch_status: "ok".to_string(),
            failure_kind: String::new(),
            failure_count: 0,
            retry_after: 0,
            last_error: String::new(),
            fetched_at: Utc::now(),
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

fn normalize_icon_reference(icon: &str) -> Option<String> {
    let trimmed = icon.trim();
    if trimmed.is_empty() {
        return None;
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("http://") || lower.starts_with("https://") {
        return Some(trimmed.to_string());
    }
    if trimmed.contains("://") || trimmed.contains(':') || trimmed.contains('\\') {
        return None;
    }
    if let Some(name) = trimmed.strip_prefix("data/icons/") {
        return normalize_prefixed_icon_reference("icons", name);
    }
    if let Some(name) = trimmed.strip_prefix("data/cache/") {
        return normalize_prefixed_icon_reference("cache", name);
    }
    if let Some(name) = trimmed.strip_prefix("/icons/") {
        return normalize_prefixed_icon_reference("icons", name);
    }
    if let Some(name) = trimmed.strip_prefix("/cache/") {
        return normalize_prefixed_icon_reference("cache", name);
    }
    if trimmed.starts_with('/') {
        return None;
    }
    if let Some(name) = trimmed.strip_prefix("icons/") {
        return normalize_prefixed_icon_reference("icons", name);
    }
    if let Some(name) = trimmed.strip_prefix("cache/") {
        return normalize_prefixed_icon_reference("cache", name);
    }
    if trimmed.contains('/') || !is_safe_icon_file_name(trimmed) {
        return None;
    }
    Some(format!("icons/{trimmed}"))
}

fn normalize_prefixed_icon_reference(prefix: &str, name: &str) -> Option<String> {
    let name = name.trim();
    if is_safe_icon_file_name(name) {
        Some(format!("{prefix}/{name}"))
    } else {
        None
    }
}

fn is_safe_icon_file_name(name: &str) -> bool {
    !name.is_empty()
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains(':')
        && Path::new(name)
            .components()
            .all(|component| matches!(component, std::path::Component::Normal(_)))
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
        .split(['/', '?', '#'])
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
    normalize_icon_reference(raw)
        .map(|icon| {
            let lower = icon.to_ascii_lowercase();
            !lower.starts_with("http://") && !lower.starts_with("https://")
        })
        .unwrap_or(false)
}

fn millis_to_datetime(ms: i64) -> DateTime<Utc> {
    DateTime::<Utc>::from_timestamp_millis(ms).unwrap_or_else(Utc::now)
}

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}
