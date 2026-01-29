// This is the main entry point for the `gpt_node` binary. This process runs inside the
// secure VM on a node operator's machine. Its primary responsibilities include:
// 1. Performing SEV-SNP attestation on startup.
// 2. Registering with the index canister to become an active worker.
// 3. Opening a WebSocket endpoint to listen for conversation job requests.
// 4. Communicating with IC canisters to claim jobs and fetch data.
// 5. Interacting with external AI providers (e.g., OpenAI) to generate responses.
// 6. Streaming responses back to the client and completing the job on-canister.
// 7. Sending periodic heartbeats to the index canister to remain active.
// 8. Gracefully unregistering from the index upon shutdown.

mod api;
mod bootstrap;
mod clients;
mod core;
mod lifecycle;
mod security;

use anyhow::Result as AnyhowResult;
use clap::Parser;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use tracing::{error, info, warn};
use tracing_subscriber::{
    EnvFilter, fmt, fmt::time::ChronoUtc, layer::SubscriberExt, util::SubscriberInitExt,
};

use crate::api::create_router;
use crate::bootstrap::perform_startup;
use crate::lifecycle::{
    graceful_shutdown_signal, spawn_heartbeat_task, unregister_node, wait_for_jobs_completion,
};

const DEFAULT_LOCAL_PORT: u16 = 8000;

/// Defines the command-line arguments required to start the node.
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
pub struct Args {
    /// The principal ID of the main index canister.
    #[arg(long, required = true)]
    pub canister_principal: String,

    /// The network to connect to ("local" or "ic").
    #[arg(long, required = true)]
    pub network_type: String,

    /// The URL of the IC replica to use (required for "local" network).
    #[arg(long, default_value = "https://daemon-dev.gptprotocol.dev")]
    pub replica_url: String,

    /// Optional: Rate limit for requests per minute to the AI provider.
    #[arg(long)]
    pub rpm: Option<u32>,

    /// Optional: Maximum number of concurrent AI provider requests.
    #[arg(long)]
    pub concurrency: Option<u32>,
}

#[tokio::main]
async fn main() -> AnyhowResult<()> {
    // Initialize logging (JSON or compact format).
    let log_format = std::env::var("LOG_FORMAT").unwrap_or_else(|_| "compact".to_string());
    let (non_blocking_writer, _guard) = tracing_appender::non_blocking(std::io::stdout());

    let base_subscriber = tracing_subscriber::registry().with(
        EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "gpt_node=info,tower_http=info,ic_agent=warn".into()),
    );

    match log_format.as_str() {
        "json" => {
            let json_layer = tracing_bunyan_formatter::JsonStorageLayer;
            let bunyan_layer = tracing_bunyan_formatter::BunyanFormattingLayer::new(
                "gpt_node".into(),
                non_blocking_writer,
            );
            base_subscriber.with(json_layer).with(bunyan_layer).init();
        }
        _ => {
            let fmt_layer = fmt::layer()
                .with_writer(non_blocking_writer)
                .with_target(false)
                .with_level(true)
                .with_thread_ids(false)
                .with_thread_names(false)
                .with_ansi(true)
                .with_timer(ChronoUtc::new("%T%.3f".to_string()))
                .compact();
            base_subscriber.with(fmt_layer).init();
        }
    }

    // Register a panic hook to ensure panics are logged structuredly before exit
    std::panic::set_hook(Box::new(|panic_info| {
        let location = panic_info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown".to_string());
        let payload = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            *s
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.as_str()
        } else {
            "Box<Any>"
        };
        error!(target: "panic", location = %location, error = %payload, "CRITICAL: Process Panic");
    }));

    let args = Args::parse();
    info!(
        version = env!("CARGO_PKG_VERSION"),
        log_format, "Starting gpt_node instance"
    );
    info!(
        index_canister = %args.canister_principal,
        network = %args.network_type,
        replica_url = if args.network_type == "local" { Some(&args.replica_url) } else { None },
        rpm_limit = ?args.rpm,
        concurrency_limit = ?args.concurrency,
        "Loaded configuration"
    );

    info!("Beginning node setup and registration...");
    // `perform_startup` is a critical function that handles attestation, registration,
    // and fetching initial configuration.
    let (shared_state, index_principal, node_id) = match perform_startup(&args).await {
        Ok(data) => {
            info!(node_id = %data.2, "Node setup and registration successful");
            data
        }
        Err(e) => {
            error!(error = %e, "CRITICAL SETUP FAILURE");
            return Err(anyhow::anyhow!("Node setup failed: {e}"));
        }
    };

    // Spawn a background task to send periodic heartbeats to the index canister.
    spawn_heartbeat_task(shared_state.clone(), index_principal);

    info!("Starting Axum Web Server...");
    // Bind to IPv6 and fall back to IPv4 if necessary.
    let listen_addr = SocketAddr::new(
        IpAddr::V6(std::net::Ipv6Addr::UNSPECIFIED),
        DEFAULT_LOCAL_PORT,
    );
    info!("Attempting to bind server to address: {}", listen_addr);
    let listener = match tokio::net::TcpListener::bind(&listen_addr).await {
        Ok(l) => {
            info!("Successfully bound server to IPv6 address {}", listen_addr);
            l
        }
        Err(e) => {
            warn!(
                "Failed to bind to IPv6 address {}: {}. Attempting fallback to IPv4.",
                listen_addr, e
            );
            let listen_addr_v4 =
                SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), DEFAULT_LOCAL_PORT);
            info!("Retrying bind on IPv4 address {}", listen_addr_v4);
            tokio::net::TcpListener::bind(&listen_addr_v4).await?
        }
    };
    let actual_local_addr = listener.local_addr()?;
    info!("Server listening on: {}", actual_local_addr);

    // Define the web server routes.
    let app = create_router(shared_state.clone());
    info!("Axum server configured. Listening for connections...");

    // Run the server with graceful shutdown handling (listens for Ctrl+C, SIGTERM, or internal flag).
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(graceful_shutdown_signal(shared_state.shutdown.clone()))
    .await?;

    info!("Shutdown signal processed. Initiating graceful shutdown sequence...");
    // Wait for any in-progress jobs to complete before shutting down.
    wait_for_jobs_completion(shared_state.clone()).await;

    // Attempt to unregister from the index canister to mark this node as inactive.
    info!(
        "Attempting to unregister node {} from index canister...",
        node_id
    );
    if let Err(e) = unregister_node(&shared_state.agent, &index_principal, node_id).await {
        warn!(
            node_id,
            error = %e,
            "Failed to unregister node from the index. Proceeding with shutdown."
        );
    }

    info!("Graceful shutdown complete. Exiting process.");
    Ok(())
}
