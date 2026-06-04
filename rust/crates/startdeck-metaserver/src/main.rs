use anyhow::Context;
use startdeck_core::{RuntimeConfig, connect_sqlite};
use startdeck_metaserver::{MetaState, app, meta_addr_from_env};
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("startdeck=info".parse()?))
        .init();

    let config = RuntimeConfig::from_env();
    let pool = connect_sqlite(&config).await?;
    let addr = meta_addr_from_env();
    let listener = TcpListener::bind(&addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    tracing::info!(%addr, "startdeck rust meta server listening");
    axum::serve(listener, app(MetaState::new(config, pool))).await?;
    Ok(())
}
