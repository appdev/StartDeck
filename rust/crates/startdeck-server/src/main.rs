use anyhow::Context;
use startdeck_core::{RuntimeConfig, connect_sqlite, import_legacy_app_data};
use startdeck_server::{AppState, app};
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("startdeck=info".parse()?))
        .init();

    let config = RuntimeConfig::from_env();
    let pool = connect_sqlite(&config).await?;
    import_legacy_app_data(&pool, &config).await?;
    let addr = format!("{}:{}", config.host, config.port);
    let listener = TcpListener::bind(&addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    tracing::info!(%addr, "startdeck rust backend listening");
    axum::serve(listener, app(AppState::new(config, pool))).await?;
    Ok(())
}
