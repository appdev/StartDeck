use anyhow::Context;
use startdeck_core::{RuntimeConfig, connect_sqlite, import_icon_service_data};
use startdeck_iconserver::{IconState, app, icon_addr_from_env};
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("startdeck=info".parse()?))
        .init();

    let config = RuntimeConfig::from_env();
    let pool = connect_sqlite(&config).await?;
    import_icon_service_data(&pool, &config).await?;
    let addr = icon_addr_from_env();
    let listener = TcpListener::bind(&addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    tracing::info!(%addr, "startdeck rust icon service listening");
    axum::serve(listener, app(IconState::new(config, pool))).await?;
    Ok(())
}
