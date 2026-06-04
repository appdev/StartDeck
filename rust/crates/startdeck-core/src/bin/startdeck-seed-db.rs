use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, Connection, Row};
use startdeck_core::{RuntimeConfig, connect_sqlite, import_meta_server_data};

const DEFAULT_RESOURCE_DIR: &str = "rust/crates/startdeck-metaserver/resources/data";
const DEFAULT_SEED_DB_FILE: &str = "seed.sqlite3";

#[tokio::main]
async fn main() -> Result<()> {
    let options = Options::parse(env::args().skip(1))?;
    generate_seed_database(&options).await
}

async fn generate_seed_database(options: &Options) -> Result<()> {
    if !options.resource_dir.join("seed-data.json").is_file() {
        bail!(
            "missing seed-data.json in {}",
            options.resource_dir.display()
        );
    }

    remove_sqlite_file_set(&options.output)?;
    if let Some(parent) = options.output.parent() {
        fs::create_dir_all(parent).with_context(|| format!("create {}", parent.display()))?;
    }

    let temp_base = options
        .output
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(".seed-db-build");
    if temp_base.exists() {
        fs::remove_dir_all(&temp_base)
            .with_context(|| format!("remove {}", temp_base.display()))?;
    }
    fs::create_dir_all(temp_base.join("Data/data"))
        .with_context(|| format!("create {}", temp_base.display()))?;

    let mut config = RuntimeConfig::from_base_dir(temp_base.clone());
    config.sqlite_file = options.output.clone();
    config.data_dir = options
        .output
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(".seed-db-runtime");
    config.users_dir = config.data_dir.join("users");
    config.icon_cache_dir = config.data_dir.join("icon-cache");
    config.meta_server_data_dir = config.data_dir.join("meta-service");
    config.meta_server_resource_dir = options.resource_dir.clone();

    let pool = connect_sqlite(&config).await?;
    import_meta_server_data(&pool, &config).await?;
    let count: i64 =
        sqlx::query("SELECT COUNT(*) AS count FROM icon_records WHERE source = 'seed'")
            .fetch_one(&pool)
            .await?
            .get("count");
    sqlx::query("UPDATE icon_records SET fetched_at = 0, updated_at = 0 WHERE source = 'seed'")
        .execute(&pool)
        .await?;
    sqlx::query("UPDATE schema_migrations SET applied_at = 0")
        .execute(&pool)
        .await?;
    pool.close().await;

    compact_seed_database(&options.output).await?;

    remove_sqlite_sidecars(&options.output)?;
    if config.data_dir.exists() {
        fs::remove_dir_all(&config.data_dir)
            .with_context(|| format!("remove {}", config.data_dir.display()))?;
    }
    if temp_base.exists() {
        fs::remove_dir_all(&temp_base)
            .with_context(|| format!("remove {}", temp_base.display()))?;
    }

    println!(
        "generated {} with {} seed icon records",
        options.output.display(),
        count
    );
    Ok(())
}

async fn compact_seed_database(path: &Path) -> Result<()> {
    let mut conn = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(false)
        .connect()
        .await
        .with_context(|| format!("open generated sqlite seed {}", path.display()))?;
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
        .execute(&mut conn)
        .await?;
    let journal_mode: String = sqlx::query("PRAGMA journal_mode = DELETE")
        .fetch_one(&mut conn)
        .await?
        .get(0);
    if journal_mode.to_ascii_lowercase() != "delete" {
        bail!("failed to set seed sqlite journal mode to DELETE: {journal_mode}");
    }
    sqlx::query("VACUUM").execute(&mut conn).await?;
    conn.close().await?;
    Ok(())
}

fn remove_sqlite_file_set(path: &Path) -> Result<()> {
    if path.exists() {
        fs::remove_file(path).with_context(|| format!("remove {}", path.display()))?;
    }
    remove_sqlite_sidecars(path)
}

fn remove_sqlite_sidecars(path: &Path) -> Result<()> {
    for suffix in ["-wal", "-shm"] {
        let sidecar = PathBuf::from(format!("{}{}", path.display(), suffix));
        if sidecar.exists() {
            fs::remove_file(&sidecar).with_context(|| format!("remove {}", sidecar.display()))?;
        }
    }
    Ok(())
}

struct Options {
    resource_dir: PathBuf,
    output: PathBuf,
}

impl Options {
    fn parse(args: impl IntoIterator<Item = String>) -> Result<Self> {
        let mut resource_dir = PathBuf::from(DEFAULT_RESOURCE_DIR);
        let mut output: Option<PathBuf> = None;
        let mut args = args.into_iter();
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--resource-dir" => {
                    resource_dir = args
                        .next()
                        .map(PathBuf::from)
                        .context("--resource-dir requires a value")?;
                }
                "--output" => {
                    output = Some(
                        args.next()
                            .map(PathBuf::from)
                            .context("--output requires a value")?,
                    );
                }
                "--help" | "-h" => {
                    print_usage();
                    std::process::exit(0);
                }
                _ if arg.starts_with("--resource-dir=") => {
                    resource_dir = PathBuf::from(arg.trim_start_matches("--resource-dir="));
                }
                _ if arg.starts_with("--output=") => {
                    output = Some(PathBuf::from(arg.trim_start_matches("--output=")));
                }
                _ => bail!("unknown argument: {arg}"),
            }
        }
        let output = output.unwrap_or_else(|| resource_dir.join(DEFAULT_SEED_DB_FILE));
        Ok(Self {
            resource_dir,
            output,
        })
    }
}

fn print_usage() {
    println!(
        "Usage: startdeck-seed-db [--resource-dir <dir>] [--output <sqlite-file>]\n\
         Defaults: --resource-dir {DEFAULT_RESOURCE_DIR} --output <resource-dir>/{DEFAULT_SEED_DB_FILE}"
    );
}
