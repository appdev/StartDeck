use bcrypt::verify;
use chrono::Utc;
use serde_json::json;
use sqlx::{Row, SqlitePool};
use startdeck_core::models::{IconAssetRecord, IconRecord};
use startdeck_core::{
    RuntimeConfig, app_snapshot, connect_sqlite, icon_record, import_legacy_data,
    import_meta_server_data, save_snapshot, upsert_icon_record, user_password_hash,
};

async fn raw_sqlite_pool(config: &RuntimeConfig) -> SqlitePool {
    config.ensure_dirs().unwrap();
    let options = sqlx::sqlite::SqliteConnectOptions::new()
        .filename(&config.sqlite_file)
        .create_if_missing(true);
    sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap()
}

async fn schema_versions(pool: &SqlitePool) -> Vec<i64> {
    sqlx::query_scalar("SELECT version FROM schema_migrations ORDER BY version")
        .fetch_all(pool)
        .await
        .unwrap()
}

async fn max_schema_version(pool: &SqlitePool) -> i64 {
    sqlx::query_scalar("SELECT MAX(version) FROM schema_migrations")
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn create_schema_migrations(pool: &SqlitePool, version: i64) {
    sqlx::query(
        r#"CREATE TABLE schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )"#,
    )
    .execute(pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO schema_migrations(version, applied_at) VALUES (?, 1)")
        .bind(version)
        .execute(pool)
        .await
        .unwrap();
}

async fn create_v4_icon_tables(pool: &SqlitePool) {
    sqlx::query(
        r#"CREATE TABLE icon_records (
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
    )
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(
        r#"CREATE TABLE icon_assets (
            host TEXT NOT NULL,
            asset_kind TEXT NOT NULL,
            url TEXT NOT NULL,
            is_local INTEGER NOT NULL,
            sort_order INTEGER NOT NULL,
            PRIMARY KEY(host, asset_kind, url),
            FOREIGN KEY(host) REFERENCES icon_records(host) ON DELETE CASCADE
        )"#,
    )
    .execute(pool)
    .await
    .unwrap();
}

async fn insert_v4_icon_record(pool: &SqlitePool, host: &str) {
    sqlx::query(
        r#"INSERT INTO icon_records(
            host, title, url, final_url, description, background_color, source,
            fetch_status, failure_kind, failure_count, retry_after, last_error, fetched_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', '', 0, 0, '', ?, ?)"#,
    )
    .bind(host)
    .bind(format!("Title {host}"))
    .bind(format!("https://{host}/"))
    .bind(format!("https://{host}/final"))
    .bind(format!("Description {host}"))
    .bind("#ffffff")
    .bind("seed")
    .bind(1_700_000_000_000_i64)
    .bind(1_700_000_000_123_i64)
    .execute(pool)
    .await
    .unwrap();
}

async fn insert_icon_asset(
    pool: &SqlitePool,
    host: &str,
    asset_kind: &str,
    url: &str,
    is_local: i64,
    sort_order: i64,
) {
    sqlx::query(
        r#"INSERT INTO icon_assets(host, asset_kind, url, is_local, sort_order)
           VALUES (?, ?, ?, ?, ?)"#,
    )
    .bind(host)
    .bind(asset_kind)
    .bind(url)
    .bind(is_local)
    .bind(sort_order)
    .execute(pool)
    .await
    .unwrap();
}

async fn stored_primary_icon(pool: &SqlitePool, host: &str) -> Option<String> {
    sqlx::query_scalar(
        "SELECT url FROM icon_assets WHERE host = ? AND asset_kind = 'primary' ORDER BY sort_order ASC, url ASC LIMIT 1",
    )
    .bind(host)
    .fetch_optional(pool)
    .await
    .unwrap()
}

#[tokio::test]
async fn fresh_sqlite_db_records_schema_version_8() {
    let temp = tempfile::tempdir().unwrap();
    let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
    let pool = connect_sqlite(&config).await.unwrap();

    assert_eq!(schema_versions(&pool).await, vec![8]);

    let icon_asset_columns = sqlx::query("PRAGMA table_info(icon_assets)")
        .fetch_all(&pool)
        .await
        .unwrap()
        .into_iter()
        .map(|row| row.get::<String, _>("name"))
        .collect::<Vec<_>>();
    for column in [
        "content_type",
        "width",
        "height",
        "byte_size",
        "quality_score",
        "quality_checked_at",
        "quality_refresh_after",
    ] {
        assert!(icon_asset_columns.iter().any(|item| item == column));
    }

    let managed_asset_columns = sqlx::query("PRAGMA table_info(managed_icon_assets)")
        .fetch_all(&pool)
        .await
        .unwrap()
        .into_iter()
        .map(|row| row.get::<String, _>("name"))
        .collect::<Vec<_>>();
    for column in [
        "id",
        "visibility",
        "owner_username",
        "blob_id",
        "source_kind",
        "source_ref",
        "sha256",
        "content_type",
        "lifecycle",
    ] {
        assert!(managed_asset_columns.iter().any(|item| item == column));
    }

    let managed_blob_columns = sqlx::query("PRAGMA table_info(managed_icon_blobs)")
        .fetch_all(&pool)
        .await
        .unwrap()
        .into_iter()
        .map(|row| row.get::<String, _>("name"))
        .collect::<Vec<_>>();
    for column in ["id", "sha256", "content_type", "byte_size", "storage_path"] {
        assert!(managed_blob_columns.iter().any(|item| item == column));
    }
}

#[tokio::test]
async fn v8_migration_rewrites_legacy_managed_icon_prefixes() {
    let temp = tempfile::tempdir().unwrap();
    let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
    let pool = raw_sqlite_pool(&config).await;
    sqlx::query(
        r#"CREATE TABLE schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )"#,
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO schema_migrations(version, applied_at) VALUES (7, 1)")
        .execute(&pool)
        .await
        .unwrap();
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
            PRIMARY KEY(username, id)
        )"#,
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        r#"INSERT INTO nav_items(id, group_id, username, title, url, icon, is_public, sort_order, metadata_json)
           VALUES ('item-1', 'group-1', 'admin', 'Old', 'https://example.com', '/api/assets/icons/icn_old', 0, 0, '{"icon":"/api/assets/icons/icn_old"}')"#,
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        r#"CREATE TABLE runtime_cache (
            kind TEXT NOT NULL,
            cache_key TEXT NOT NULL,
            value_json TEXT NOT NULL,
            expires_at INTEGER,
            source_status TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY(kind, cache_key)
        )"#,
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        r#"INSERT INTO runtime_cache(kind, cache_key, value_json, expires_at, source_status, updated_at)
           VALUES ('data', 'admin', '{"icon":"/api/assets/icons/icn_cache"}', NULL, 'ok', 1)"#,
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        r#"CREATE TABLE config_versions (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            label TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )"#,
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        r#"INSERT INTO config_versions(id, username, label, snapshot_json, created_at)
           VALUES ('version-1', 'admin', 'Old', '{"icon":"/api/assets/icons/icn_version"}', 1)"#,
    )
    .execute(&pool)
    .await
    .unwrap();
    pool.close().await;

    let migrated = connect_sqlite(&config).await.unwrap();
    assert_eq!(max_schema_version(&migrated).await, 8);
    let icon: String = sqlx::query_scalar("SELECT icon FROM nav_items WHERE id = 'item-1'")
        .fetch_one(&migrated)
        .await
        .unwrap();
    let metadata_json: String =
        sqlx::query_scalar("SELECT metadata_json FROM nav_items WHERE id = 'item-1'")
            .fetch_one(&migrated)
            .await
            .unwrap();
    let runtime_cache: String =
        sqlx::query_scalar("SELECT value_json FROM runtime_cache WHERE kind = 'data'")
            .fetch_one(&migrated)
            .await
            .unwrap();
    let snapshot_json: String =
        sqlx::query_scalar("SELECT snapshot_json FROM config_versions WHERE id = 'version-1'")
            .fetch_one(&migrated)
            .await
            .unwrap();
    for value in [icon, metadata_json, runtime_cache, snapshot_json] {
        assert!(value.contains("/api/icons/icn_"), "{value}");
        assert!(!value.contains("/api/assets/icons/"), "{value}");
    }
}

#[tokio::test]
async fn creates_ai_usage_credentials_table_with_user_widget_scope() {
    let temp = tempfile::tempdir().unwrap();
    let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
    let pool = connect_sqlite(&config).await.unwrap();

    let columns = sqlx::query("PRAGMA table_info(ai_usage_credentials)")
        .fetch_all(&pool)
        .await
        .unwrap()
        .into_iter()
        .map(|row| row.get::<String, _>("name"))
        .collect::<Vec<_>>();

    for column in [
        "username",
        "widget_id",
        "provider_id",
        "credential_type",
        "encrypted_secret",
        "encrypted_account_id",
        "nonce",
        "account_nonce",
        "key_version",
        "created_at",
        "updated_at",
    ] {
        assert!(columns.iter().any(|existing| existing == column));
    }
}

#[tokio::test]
async fn creates_tapd_credentials_table_with_user_widget_scope() {
    let temp = tempfile::tempdir().unwrap();
    let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
    let pool = connect_sqlite(&config).await.unwrap();

    let columns = sqlx::query("PRAGMA table_info(tapd_credentials)")
        .fetch_all(&pool)
        .await
        .unwrap()
        .into_iter()
        .map(|row| row.get::<String, _>("name"))
        .collect::<Vec<_>>();

    for column in [
        "username",
        "widget_id",
        "credential_type",
        "encrypted_material",
        "nonce",
        "key_version",
        "created_at",
        "updated_at",
    ] {
        assert!(columns.iter().any(|existing| existing == column));
    }
}

#[tokio::test]
async fn creates_icon_records_fetch_status_columns() {
    let temp = tempfile::tempdir().unwrap();
    let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
    let pool = connect_sqlite(&config).await.unwrap();

    let columns = sqlx::query("PRAGMA table_info(icon_records)")
        .fetch_all(&pool)
        .await
        .unwrap()
        .into_iter()
        .map(|row| row.get::<String, _>("name"))
        .collect::<Vec<_>>();

    for column in [
        "fetch_status",
        "failure_kind",
        "failure_count",
        "retry_after",
        "last_error",
    ] {
        assert!(columns.iter().any(|existing| existing == column));
    }
}

#[tokio::test]
async fn migrates_v3_icon_records_to_fetch_status_schema_without_losing_assets() {
    let temp = tempfile::tempdir().unwrap();
    let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
    let legacy_pool = raw_sqlite_pool(&config).await;
    create_schema_migrations(&legacy_pool, 3).await;
    sqlx::query(
        r#"CREATE TABLE icon_records (
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
    )
    .execute(&legacy_pool)
    .await
    .unwrap();
    sqlx::query(
        r#"CREATE TABLE icon_assets (
            host TEXT NOT NULL,
            asset_kind TEXT NOT NULL,
            url TEXT NOT NULL,
            is_local INTEGER NOT NULL,
            sort_order INTEGER NOT NULL,
            PRIMARY KEY(host, asset_kind, url),
            FOREIGN KEY(host) REFERENCES icon_records(host) ON DELETE CASCADE
        )"#,
    )
    .execute(&legacy_pool)
    .await
    .unwrap();
    sqlx::query(
        r#"INSERT INTO icon_records(
            host, title, url, final_url, description, background_color, source, fetched_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind("legacy.example.com")
    .bind("Legacy Example")
    .bind("https://legacy.example.com/")
    .bind("https://legacy.example.com/")
    .bind("legacy description")
    .bind("#ffffff")
    .bind("seed")
    .bind(1_700_000_000_000_i64)
    .bind(1_700_000_000_000_i64)
    .execute(&legacy_pool)
    .await
    .unwrap();
    sqlx::query(
        r#"INSERT INTO icon_assets(host, asset_kind, url, is_local, sort_order)
           VALUES (?, 'primary', ?, 1, 0)"#,
    )
    .bind("legacy.example.com")
    .bind("data/icons/legacy.svg")
    .execute(&legacy_pool)
    .await
    .unwrap();
    legacy_pool.close().await;

    let pool = connect_sqlite(&config).await.unwrap();
    let record = icon_record(&pool, "legacy.example.com")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(record.title, "Legacy Example");
    assert_eq!(record.icon.as_deref(), Some("icons/legacy.svg"));
    assert_eq!(record.fetch_status, "ok");
    assert_eq!(record.failure_kind, "");
    assert_eq!(record.failure_count, 0);
    assert_eq!(record.retry_after, 0);
    assert_eq!(record.last_error, "");

    assert_eq!(schema_versions(&pool).await, vec![3, 4, 5, 6, 7, 8]);
}

#[tokio::test]
async fn upserting_non_ok_icon_record_clears_stale_primary_assets() {
    let temp = tempfile::tempdir().unwrap();
    let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
    let pool = connect_sqlite(&config).await.unwrap();
    let mut record = IconRecord {
        host: "example.com".to_string(),
        title: "Example".to_string(),
        url: "https://example.com/".to_string(),
        final_url: "https://example.com/".to_string(),
        description: String::new(),
        background_color: String::new(),
        icon: Some("icons/example.svg".to_string()),
        icon_asset: None,
        source: "remote".to_string(),
        fetch_status: "ok".to_string(),
        failure_kind: String::new(),
        failure_count: 0,
        retry_after: 0,
        last_error: String::new(),
        fetched_at: Utc::now(),
    };
    upsert_icon_record(&pool, &record).await.unwrap();
    assert_eq!(
        icon_record(&pool, "example.com")
            .await
            .unwrap()
            .unwrap()
            .icon
            .as_deref(),
        Some("icons/example.svg")
    );

    record.icon = None;
    record.fetch_status = "no_icon".to_string();
    record.failure_kind = "icon_not_found".to_string();
    record.retry_after = Utc::now().timestamp_millis() + 86_400_000;
    upsert_icon_record(&pool, &record).await.unwrap();
    let stored = icon_record(&pool, "example.com").await.unwrap().unwrap();
    assert_eq!(stored.fetch_status, "no_icon");
    assert!(stored.icon.is_none());
    assert!(stored.icon_asset.is_none());
}

#[tokio::test]
async fn upserting_icon_record_persists_primary_asset_quality() {
    let temp = tempfile::tempdir().unwrap();
    let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
    let pool = connect_sqlite(&config).await.unwrap();
    let record = IconRecord {
        host: "quality.example.com".to_string(),
        title: "Quality Example".to_string(),
        url: "https://quality.example.com/".to_string(),
        final_url: "https://quality.example.com/".to_string(),
        description: String::new(),
        background_color: String::new(),
        icon: Some("/cache/quality.png".to_string()),
        icon_asset: Some(IconAssetRecord {
            url: "cache/quality.png".to_string(),
            content_type: "image/png".to_string(),
            width: Some(114),
            height: Some(114),
            byte_size: 4096,
            quality_score: 220,
            quality_checked_at: 1_700_000_000_000,
            quality_refresh_after: 1_700_086_400_000,
        }),
        source: "remote".to_string(),
        fetch_status: "ok".to_string(),
        failure_kind: String::new(),
        failure_count: 0,
        retry_after: 0,
        last_error: String::new(),
        fetched_at: Utc::now(),
    };

    upsert_icon_record(&pool, &record).await.unwrap();

    let stored = icon_record(&pool, "quality.example.com")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(stored.icon.as_deref(), Some("cache/quality.png"));
    let asset = stored.icon_asset.expect("icon asset quality");
    assert_eq!(asset.url, "cache/quality.png");
    assert_eq!(asset.content_type, "image/png");
    assert_eq!(asset.width, Some(114));
    assert_eq!(asset.height, Some(114));
    assert_eq!(asset.byte_size, 4096);
    assert_eq!(asset.quality_score, 220);
    assert_eq!(asset.quality_checked_at, 1_700_000_000_000);
    assert_eq!(asset.quality_refresh_after, 1_700_086_400_000);
}

#[tokio::test]
async fn imports_legacy_navigation_widgets_and_icon_seed_into_relational_tables() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path();
    let data_dir = base.join("Data/data");
    let meta_resource_dir = base.join("rust/crates/startdeck-metaserver/resources/data");
    let meta_data_dir = base.join("meta-service-data");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::create_dir_all(meta_resource_dir.join("icons")).unwrap();
    std::fs::create_dir_all(meta_data_dir.join("cache")).unwrap();
    std::fs::write(
        data_dir.join("system.json"),
        r#"{"authMode":"single","enableDocker":true}"#,
    )
    .unwrap();
    std::fs::write(
        data_dir.join("data.json"),
        serde_json::to_vec(&json!({
            "username": "admin",
            "password": "secret",
            "appConfig": {"customTitle": "Demo"},
            "groups": [{"id": "g1", "title": "Main", "items": [{"id": "i1", "title": "Example", "url": "https://example.com", "icon": "example.svg", "isPublic": true}]}],
            "widgets": [{"id": "w1", "type": "memo", "enable": true, "isPublic": true, "data": {"content": "hello"}, "layouts": {"desktop": {"w": 1}}}]
        }))
        .unwrap(),
    )
    .unwrap();
    std::fs::write(meta_resource_dir.join("icons/example.svg"), "<svg/>").unwrap();
    std::fs::write(
        meta_resource_dir.join("seed-data.json"),
        serde_json::to_vec(&json!({"items": [
            {"title": "Example", "url": "https://example.com", "icon_url": "data/icons/example.svg", "background_color": "#fff"},
            {"title": "Query Example", "url": "https://query.example.com?ref=seed", "icon_url": "data/icons/example.svg", "background_color": "#fff"}
        ]})).unwrap(),
    )
    .unwrap();

    let mut config = RuntimeConfig::from_base_dir(base.to_path_buf());
    config.meta_server_data_dir = meta_data_dir;
    config.meta_server_resource_dir = meta_resource_dir;
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_data(&pool, &config).await.unwrap();

    let password_hash = user_password_hash(&pool, "admin").await.unwrap().unwrap();
    assert!(verify("secret", &password_hash).unwrap());

    let snapshot = app_snapshot(&pool, "admin").await.unwrap();
    assert!(snapshot.system_config.enable_docker);
    assert_eq!(snapshot.groups[0].items[0].title, "Example");
    assert_eq!(snapshot.widgets[0].widget_type, "memo");
    let config_json: String =
        sqlx::query_scalar("SELECT config_json FROM system_config WHERE id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(!config_json.contains("authMode"));

    let icon = icon_record(&pool, "example.com").await.unwrap().unwrap();
    assert_eq!(icon.title, "Example");
    assert_eq!(icon.icon.as_deref(), Some("icons/example.svg"));
    assert_eq!(icon.fetch_status, "ok");
    let query_icon = icon_record(&pool, "query.example.com")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(query_icon.title, "Query Example");
}

#[tokio::test]
async fn imports_admin_from_default_template_when_legacy_data_json_is_missing() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path();
    let data_dir = base.join("Data/data");
    let default_data_dir = base.join("rust/crates/startdeck-server/resources/data");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::create_dir_all(&default_data_dir).unwrap();
    std::fs::write(
        data_dir.join("system.json"),
        r#"{"authMode":"single","enableDocker":true}"#,
    )
    .unwrap();
    std::fs::write(
        default_data_dir.join("default.json"),
        serde_json::to_vec(&json!({
            "appConfig": {"customTitle": "Default Template"},
            "groups": [{"id": "g1", "title": "Template Group", "items": []}],
            "widgets": [{"id": "calendar", "type": "itab-calendar-01", "enable": true, "isPublic": true, "data": {"runtime": "itab-calendar"}}]
        }))
        .unwrap(),
    )
    .unwrap();

    let config = RuntimeConfig::from_base_dir(base.to_path_buf());
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_data(&pool, &config).await.unwrap();

    let snapshot = app_snapshot(&pool, "admin").await.unwrap();
    assert_eq!(snapshot.user.app_config["customTitle"], "Default Template");
    assert_eq!(snapshot.groups[0].title, "Template Group");
    assert_eq!(snapshot.widgets[0].id, "calendar");
    assert_eq!(snapshot.widgets[0].widget_type, "itab-calendar-01");
}

#[tokio::test]
async fn imports_legacy_data_json_as_admin_and_users_dir_as_user_data() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path();
    let data_dir = base.join("Data/data");
    let users_dir = data_dir.join("users");
    std::fs::create_dir_all(&users_dir).unwrap();
    std::fs::write(
        data_dir.join("system.json"),
        r#"{"authMode":"single","enableDocker":false}"#,
    )
    .unwrap();
    for (path, username, title, content) in [
        (
            data_dir.join("data.json"),
            "admin",
            "Admin Group",
            "admin content",
        ),
        (
            users_dir.join("bob.json"),
            "bob",
            "Bob Group",
            "bob content",
        ),
    ] {
        std::fs::write(
            path,
            serde_json::to_vec(&json!({
                "username": username,
                "password": "secret",
                "appConfig": {"customTitle": title},
                "groups": [{"id": "shared-group", "title": title, "items": [{"id": "shared-item", "title": title, "url": "https://example.com", "icon": "", "isPublic": true}]}],
                "widgets": [{"id": "shared-widget", "type": "memo", "enable": true, "isPublic": true, "data": {"content": content}}]
            }))
            .unwrap(),
        )
        .unwrap();
    }

    let config = RuntimeConfig::from_base_dir(base.to_path_buf());
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_data(&pool, &config).await.unwrap();

    let admin = app_snapshot(&pool, "admin").await.unwrap();
    let bob = app_snapshot(&pool, "bob").await.unwrap();
    assert_eq!(admin.groups[0].title, "Admin Group");
    assert_eq!(bob.groups[0].title, "Bob Group");
    assert_eq!(admin.groups[0].items[0].id, "shared-item");
    assert_eq!(bob.groups[0].items[0].id, "shared-item");
    assert_eq!(admin.widgets[0].id, "shared-widget");
    assert_eq!(bob.widgets[0].id, "shared-widget");
    assert_eq!(admin.widgets[0].data["content"], "admin content");
    assert_eq!(bob.widgets[0].data["content"], "bob content");
}

#[tokio::test]
async fn incompatible_legacy_schema_is_rebuilt_destructively() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path();
    let data_dir = base.join("Data/data");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::write(
        data_dir.join("system.json"),
        r#"{"authMode":"single","enableDocker":true}"#,
    )
    .unwrap();
    std::fs::write(
        data_dir.join("data.json"),
        serde_json::to_vec(&json!({
            "username": "admin",
            "password": "secret",
            "groups": [],
            "widgets": [{"id": "docker", "type": "docker", "enable": true, "isPublic": false, "layouts": {"desktop": {"w": 2, "h": 2, "x": 0, "y": 1}}}]
        }))
        .unwrap(),
    )
    .unwrap();

    let config = RuntimeConfig::from_base_dir(base.to_path_buf());
    config.ensure_dirs().unwrap();
    let options = sqlx::sqlite::SqliteConnectOptions::new()
        .filename(&config.sqlite_file)
        .create_if_missing(true);
    let legacy_pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    sqlx::query(
        r#"CREATE TABLE schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )"#,
    )
    .execute(&legacy_pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO schema_migrations(version, applied_at) VALUES (1, 1)")
        .execute(&legacy_pool)
        .await
        .unwrap();
    sqlx::query(
        r#"CREATE TABLE runtime_cache (
            cache_key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            expires_at INTEGER,
            updated_at INTEGER NOT NULL
        )"#,
    )
    .execute(&legacy_pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO runtime_cache(cache_key, value_json, updated_at) VALUES ('stale', '{}', 1)",
    )
    .execute(&legacy_pool)
    .await
    .unwrap();
    legacy_pool.close().await;

    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_data(&pool, &config).await.unwrap();

    let columns = sqlx::query("PRAGMA table_info(runtime_cache)")
        .fetch_all(&pool)
        .await
        .unwrap()
        .into_iter()
        .map(|row| row.get::<String, _>("name"))
        .collect::<Vec<_>>();
    assert!(columns.iter().any(|column| column == "kind"));
    assert!(columns.iter().any(|column| column == "source_status"));

    let stale_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM runtime_cache")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(stale_count, 0);

    assert_eq!(max_schema_version(&pool).await, 8);

    let snapshot = app_snapshot(&pool, "admin").await.unwrap();
    assert!(snapshot.system_config.enable_docker);
    assert_eq!(snapshot.widgets.len(), 1);
    assert_eq!(snapshot.widgets[0].widget_type, "docker");
}

#[tokio::test]
async fn restart_import_does_not_overwrite_saved_sqlite_app_data() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path();
    let data_dir = base.join("Data/data");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::write(
        data_dir.join("system.json"),
        r#"{"authMode":"single","enableDocker":true}"#,
    )
    .unwrap();
    std::fs::write(
        data_dir.join("data.json"),
        serde_json::to_vec(&json!({
            "username": "admin",
            "password": "secret",
            "appConfig": {"customTitle": "Seed"},
            "groups": [{"id": "g1", "title": "Seed Group", "items": []}],
            "widgets": [{"id": "seed", "type": "docker", "enable": true, "isPublic": false, "data": {"sizeKey": "2x2"}}]
        }))
        .unwrap(),
    )
    .unwrap();

    let config = RuntimeConfig::from_base_dir(base.to_path_buf());
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_data(&pool, &config).await.unwrap();

    let mut saved = app_snapshot(&pool, "admin").await.unwrap();
    saved.user.app_config = json!({"customTitle": "Saved"});
    saved.groups[0].title = "Saved Group".to_string();
    saved.widgets[0].id = "saved-widget".to_string();
    saved.widgets[0].widget_type = "custom-css".to_string();
    saved.widgets[0].data = json!({"html": "<p>saved</p>", "sizeKey": "2x2"});
    save_snapshot(&pool, &saved).await.unwrap();

    std::fs::write(
        data_dir.join("data.json"),
        serde_json::to_vec(&json!({
            "username": "admin",
            "password": "secret",
            "appConfig": {"customTitle": "Seed After Restart"},
            "groups": [{"id": "reset", "title": "Reset Group", "items": []}],
            "widgets": [{"id": "reset-widget", "type": "docker", "enable": true, "isPublic": false, "data": {}}]
        }))
        .unwrap(),
    )
    .unwrap();

    import_legacy_data(&pool, &config).await.unwrap();

    let after_restart = app_snapshot(&pool, "admin").await.unwrap();
    assert_eq!(after_restart.user.app_config["customTitle"], "Saved");
    assert_eq!(after_restart.groups.len(), 1);
    assert_eq!(after_restart.groups[0].title, "Saved Group");
    assert_eq!(after_restart.widgets.len(), 1);
    assert_eq!(after_restart.widgets[0].id, "saved-widget");
    assert_eq!(after_restart.widgets[0].widget_type, "custom-css");
    assert_eq!(after_restart.widgets[0].data["html"], "<p>saved</p>");
}

#[tokio::test]
async fn migrates_v4_icon_assets_to_v5_without_rerunning_older_migrations() {
    let temp = tempfile::tempdir().unwrap();
    let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
    let legacy_pool = raw_sqlite_pool(&config).await;
    create_schema_migrations(&legacy_pool, 4).await;
    create_v4_icon_tables(&legacy_pool).await;
    insert_v4_icon_record(&legacy_pool, "v4.example.com").await;
    insert_icon_asset(
        &legacy_pool,
        "v4.example.com",
        "primary",
        "/cache/v4.svg",
        1,
        9,
    )
    .await;
    legacy_pool.close().await;

    let pool = connect_sqlite(&config).await.unwrap();

    assert_eq!(schema_versions(&pool).await, vec![4, 5, 6, 7, 8]);
    assert_eq!(
        icon_record(&pool, "v4.example.com")
            .await
            .unwrap()
            .unwrap()
            .icon
            .as_deref(),
        Some("cache/v4.svg")
    );
    let asset = icon_record(&pool, "v4.example.com")
        .await
        .unwrap()
        .unwrap()
        .icon_asset
        .expect("migrated icon asset");
    assert_eq!(asset.content_type, "");
    assert_eq!(asset.width, None);
    assert_eq!(asset.height, None);
    assert_eq!(asset.byte_size, 0);
    assert_eq!(asset.quality_score, 0);
    assert_eq!(asset.quality_checked_at, 0);
    assert_eq!(asset.quality_refresh_after, 0);
}

#[tokio::test]
async fn v5_migration_normalizes_and_collapses_icon_assets_only() {
    let temp = tempfile::tempdir().unwrap();
    let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
    let legacy_pool = raw_sqlite_pool(&config).await;
    create_schema_migrations(&legacy_pool, 4).await;
    create_v4_icon_tables(&legacy_pool).await;
    insert_v4_icon_record(&legacy_pool, "normalize.example.com").await;
    for (url, is_local, sort_order) in [
        ("data/icons/merged.svg", 1, 5),
        ("/icons/merged.svg", 1, 4),
        ("icons/merged.svg", 0, 2),
        ("/cache/merged.png", 1, 8),
        ("cache/merged.png", 1, 3),
        ("bare.ico", 1, 7),
        ("https://cdn.example.com/icon.png", 0, 6),
        ("../secret.svg", 1, 1),
        ("data:image/png;base64,AAAA", 0, 1),
        ("/tmp/absolute.svg", 1, 1),
        ("icons/nested/unsafe.svg", 1, 1),
        ("cache/../unsafe.svg", 1, 1),
    ] {
        insert_icon_asset(
            &legacy_pool,
            "normalize.example.com",
            "primary",
            url,
            is_local,
            sort_order,
        )
        .await;
    }
    let before = sqlx::query(
        r#"SELECT title, url, final_url, description, background_color, source,
                  fetch_status, failure_kind, failure_count, retry_after, last_error, fetched_at, updated_at
           FROM icon_records WHERE host = 'normalize.example.com'"#,
    )
    .fetch_one(&legacy_pool)
    .await
    .unwrap();
    legacy_pool.close().await;

    let pool = connect_sqlite(&config).await.unwrap();
    let after = sqlx::query(
        r#"SELECT title, url, final_url, description, background_color, source,
                  fetch_status, failure_kind, failure_count, retry_after, last_error, fetched_at, updated_at
           FROM icon_records WHERE host = 'normalize.example.com'"#,
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    for column in [
        "title",
        "url",
        "final_url",
        "description",
        "background_color",
        "source",
        "fetch_status",
        "failure_kind",
        "last_error",
    ] {
        assert_eq!(
            before.get::<String, _>(column),
            after.get::<String, _>(column),
            "icon_records column {column} changed"
        );
    }
    for column in ["failure_count", "retry_after", "fetched_at", "updated_at"] {
        assert_eq!(
            before.get::<i64, _>(column),
            after.get::<i64, _>(column),
            "icon_records column {column} changed"
        );
    }

    let assets: Vec<(String, i64, i64)> = sqlx::query_as(
        r#"SELECT url, is_local, sort_order
           FROM icon_assets
           WHERE host = 'normalize.example.com'
           ORDER BY url"#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(
        assets,
        vec![
            ("cache/merged.png".to_string(), 1, 3),
            ("https://cdn.example.com/icon.png".to_string(), 0, 6),
            ("icons/bare.ico".to_string(), 1, 7),
            ("icons/merged.svg".to_string(), 1, 2),
        ]
    );
}

#[tokio::test]
async fn v4_main_service_data_survives_v5_migration_and_restart_import() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path();
    let data_dir = base.join("Data/data");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::write(
        data_dir.join("system.json"),
        r#"{"authMode":"single","enableDocker":true}"#,
    )
    .unwrap();
    std::fs::write(
        data_dir.join("data.json"),
        serde_json::to_vec(&json!({
            "username": "admin",
            "password": "secret",
            "appConfig": {"customTitle": "Seed"},
            "groups": [{"id": "seed-group", "title": "Seed Group", "items": [{"id": "seed-item", "title": "Seed Item", "url": "https://seed.example.com", "icon": "", "isPublic": true}]}],
            "widgets": [{"id": "seed-widget", "type": "docker", "enable": true, "isPublic": false, "data": {"sizeKey": "2x2"}}]
        }))
        .unwrap(),
    )
    .unwrap();

    let config = RuntimeConfig::from_base_dir(base.to_path_buf());
    let pool = connect_sqlite(&config).await.unwrap();
    import_legacy_data(&pool, &config).await.unwrap();
    let mut saved = app_snapshot(&pool, "admin").await.unwrap();
    saved.user.app_config = json!({"customTitle": "Saved Before Migration"});
    saved.groups[0].id = "saved-group".to_string();
    saved.groups[0].title = "Saved Group".to_string();
    saved.groups[0].items[0].id = "saved-item".to_string();
    saved.groups[0].items[0].title = "Saved Item".to_string();
    saved.widgets[0].id = "saved-widget".to_string();
    saved.widgets[0].widget_type = "custom-css".to_string();
    saved.widgets[0].data = json!({"html": "<p>saved</p>", "sizeKey": "2x2"});
    save_snapshot(&pool, &saved).await.unwrap();
    sqlx::query(
        r#"INSERT OR REPLACE INTO runtime_cache(kind, cache_key, value_json, expires_at, source_status, updated_at)
           VALUES ('test-kind', 'test-key', '{"saved":true}', NULL, 'saved', 42)"#,
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        r#"INSERT OR REPLACE INTO config_versions(id, username, label, snapshot_json, created_at)
           VALUES ('version-1', 'admin', 'Saved Version', '{"saved":true}', 43)"#,
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("DELETE FROM schema_migrations WHERE version = 5")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (4, 1)")
        .execute(&pool)
        .await
        .unwrap();
    pool.close().await;

    std::fs::write(
        data_dir.join("data.json"),
        serde_json::to_vec(&json!({
            "username": "admin",
            "password": "secret",
            "appConfig": {"customTitle": "Reset Attempt"},
            "groups": [{"id": "reset-group", "title": "Reset Group", "items": []}],
            "widgets": [{"id": "reset-widget", "type": "docker", "enable": true, "isPublic": false, "data": {}}]
        }))
        .unwrap(),
    )
    .unwrap();

    let migrated_pool = connect_sqlite(&config).await.unwrap();
    import_legacy_data(&migrated_pool, &config).await.unwrap();

    assert_eq!(max_schema_version(&migrated_pool).await, 8);
    let after = app_snapshot(&migrated_pool, "admin").await.unwrap();
    assert_eq!(
        after.user.app_config["customTitle"],
        "Saved Before Migration"
    );
    assert_eq!(after.groups[0].id, "saved-group");
    assert_eq!(after.groups[0].items[0].title, "Saved Item");
    assert_eq!(after.widgets[0].id, "saved-widget");
    assert_eq!(after.widgets[0].widget_type, "custom-css");
    assert_eq!(after.widgets[0].data["html"], "<p>saved</p>");
    let runtime_cache: String = sqlx::query_scalar(
        "SELECT value_json FROM runtime_cache WHERE kind = 'test-kind' AND cache_key = 'test-key'",
    )
    .fetch_one(&migrated_pool)
    .await
    .unwrap();
    assert_eq!(runtime_cache, r#"{"saved":true}"#);
    let config_version_label: String =
        sqlx::query_scalar("SELECT label FROM config_versions WHERE id = 'version-1'")
            .fetch_one(&migrated_pool)
            .await
            .unwrap();
    assert_eq!(config_version_label, "Saved Version");
}

#[tokio::test]
async fn opening_v6_database_twice_is_idempotent() {
    let temp = tempfile::tempdir().unwrap();
    let config = RuntimeConfig::from_base_dir(temp.path().to_path_buf());
    let legacy_pool = raw_sqlite_pool(&config).await;
    create_schema_migrations(&legacy_pool, 4).await;
    create_v4_icon_tables(&legacy_pool).await;
    insert_v4_icon_record(&legacy_pool, "idempotent.example.com").await;
    insert_icon_asset(
        &legacy_pool,
        "idempotent.example.com",
        "primary",
        "data/icons/idempotent.svg",
        1,
        5,
    )
    .await;
    legacy_pool.close().await;

    let first_pool = connect_sqlite(&config).await.unwrap();
    let first_icon = stored_primary_icon(&first_pool, "idempotent.example.com").await;
    let first_versions = schema_versions(&first_pool).await;
    first_pool.close().await;

    let second_pool = connect_sqlite(&config).await.unwrap();
    assert_eq!(
        stored_primary_icon(&second_pool, "idempotent.example.com").await,
        first_icon
    );
    assert_eq!(schema_versions(&second_pool).await, first_versions);
}

#[tokio::test]
async fn icon_reference_normalization_matrix_applies_to_import_upsert_and_migration() {
    let cases: Vec<(&str, &str, Option<&str>)> = vec![
        (
            "data_icons",
            "data/icons/example.svg",
            Some("icons/example.svg"),
        ),
        (
            "slash_icons",
            "/icons/example.svg",
            Some("icons/example.svg"),
        ),
        (
            "canonical_icons",
            "icons/example.svg",
            Some("icons/example.svg"),
        ),
        (
            "data_cache",
            "data/cache/runtime.png",
            Some("cache/runtime.png"),
        ),
        (
            "slash_cache",
            "/cache/runtime.png",
            Some("cache/runtime.png"),
        ),
        (
            "canonical_cache",
            "cache/runtime.png",
            Some("cache/runtime.png"),
        ),
        ("bare", "bare.ico", Some("icons/bare.ico")),
        (
            "https_remote",
            "https://cdn.example.com/icon.svg",
            Some("https://cdn.example.com/icon.svg"),
        ),
        (
            "http_remote",
            "http://cdn.example.com/icon.svg",
            Some("http://cdn.example.com/icon.svg"),
        ),
        (
            "https_remote_uppercase",
            "HTTPS://cdn.example.com/icon.svg",
            Some("HTTPS://cdn.example.com/icon.svg"),
        ),
        ("unsafe_parent", "../secret.svg", None),
        ("unsafe_absolute", "/tmp/secret.svg", None),
        ("unsafe_backslash", "icons\\secret.svg", None),
        ("unsafe_pseudo", "data:image/png;base64,AAAA", None),
        ("unsafe_nested", "icons/nested/secret.svg", None),
    ];

    let upsert_temp = tempfile::tempdir().unwrap();
    let upsert_config = RuntimeConfig::from_base_dir(upsert_temp.path().to_path_buf());
    let upsert_pool = connect_sqlite(&upsert_config).await.unwrap();
    for (name, raw, expected) in &cases {
        let host = format!("upsert-{name}.example.com");
        let record = IconRecord {
            host: host.clone(),
            title: name.to_string(),
            url: format!("https://{host}/"),
            final_url: format!("https://{host}/"),
            description: String::new(),
            background_color: String::new(),
            icon: Some((*raw).to_string()),
            icon_asset: None,
            source: "remote".to_string(),
            fetch_status: "ok".to_string(),
            failure_kind: String::new(),
            failure_count: 0,
            retry_after: 0,
            last_error: String::new(),
            fetched_at: Utc::now(),
        };
        upsert_icon_record(&upsert_pool, &record).await.unwrap();
        assert_eq!(
            stored_primary_icon(&upsert_pool, &host).await.as_deref(),
            *expected,
            "upsert case {name}"
        );
        if expected
            .map(|icon| icon.to_ascii_lowercase().starts_with("http"))
            .unwrap_or(false)
        {
            let is_local: i64 =
                sqlx::query_scalar("SELECT is_local FROM icon_assets WHERE host = ?")
                    .bind(&host)
                    .fetch_one(&upsert_pool)
                    .await
                    .unwrap();
            assert_eq!(is_local, 0, "remote upsert case {name}");
        }
    }

    let import_temp = tempfile::tempdir().unwrap();
    let import_base = import_temp.path();
    let import_resource_dir = import_base.join("rust/crates/startdeck-metaserver/resources/data");
    std::fs::create_dir_all(&import_resource_dir).unwrap();
    let items = cases
        .iter()
        .map(|(name, raw, _)| {
            json!({
                "title": format!("Import {name}"),
                "url": format!("https://import-{name}.example.com"),
                "icon_url": raw,
                "background_color": "#fff"
            })
        })
        .collect::<Vec<_>>();
    std::fs::write(
        import_resource_dir.join("seed-data.json"),
        serde_json::to_vec(&json!({"items": items})).unwrap(),
    )
    .unwrap();
    let mut import_config = RuntimeConfig::from_base_dir(import_base.to_path_buf());
    import_config.meta_server_resource_dir = import_resource_dir;
    let import_pool = connect_sqlite(&import_config).await.unwrap();
    import_meta_server_data(&import_pool, &import_config)
        .await
        .unwrap();
    for (name, _, expected) in &cases {
        let host = format!("import-{name}.example.com");
        assert_eq!(
            icon_record(&import_pool, &host)
                .await
                .unwrap()
                .unwrap()
                .icon
                .as_deref(),
            *expected,
            "import case {name}"
        );
    }

    let migration_temp = tempfile::tempdir().unwrap();
    let migration_config = RuntimeConfig::from_base_dir(migration_temp.path().to_path_buf());
    let migration_legacy_pool = raw_sqlite_pool(&migration_config).await;
    create_schema_migrations(&migration_legacy_pool, 4).await;
    create_v4_icon_tables(&migration_legacy_pool).await;
    for (name, raw, _) in &cases {
        let host = format!("migration-{name}.example.com");
        insert_v4_icon_record(&migration_legacy_pool, &host).await;
        insert_icon_asset(&migration_legacy_pool, &host, "primary", raw, 1, 0).await;
    }
    migration_legacy_pool.close().await;
    let migration_pool = connect_sqlite(&migration_config).await.unwrap();
    for (name, _, expected) in &cases {
        let host = format!("migration-{name}.example.com");
        assert_eq!(
            icon_record(&migration_pool, &host)
                .await
                .unwrap()
                .unwrap()
                .icon
                .as_deref(),
            *expected,
            "migration case {name}"
        );
    }
}
