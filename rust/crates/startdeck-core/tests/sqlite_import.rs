use bcrypt::verify;
use serde_json::json;
use sqlx::Row;
use startdeck_core::{
    RuntimeConfig, app_snapshot, connect_sqlite, icon_record, import_legacy_data, save_snapshot,
    user_password_hash,
};

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
async fn imports_legacy_navigation_widgets_and_icon_seed_into_relational_tables() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path();
    let data_dir = base.join("Data/data");
    let icon_resource_dir = base.join("rust/crates/startdeck-iconserver/resources/data");
    let icon_data_dir = base.join("icon-service-data");
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::create_dir_all(icon_resource_dir.join("icons")).unwrap();
    std::fs::create_dir_all(icon_data_dir.join("cache")).unwrap();
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
    std::fs::write(icon_resource_dir.join("icons/example.svg"), "<svg/>").unwrap();
    std::fs::write(
        icon_resource_dir.join("seed-data.json"),
        serde_json::to_vec(&json!({"items": [{"title": "Example", "url": "https://example.com", "icon_url": "data/icons/example.svg", "background_color": "#fff"}]})).unwrap(),
    )
    .unwrap();

    let mut config = RuntimeConfig::from_base_dir(base.to_path_buf());
    config.icon_service_data_dir = icon_data_dir;
    config.icon_service_resource_dir = icon_resource_dir;
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

    let schema_version: i64 = sqlx::query_scalar("SELECT MAX(version) FROM schema_migrations")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(schema_version, 3);

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
