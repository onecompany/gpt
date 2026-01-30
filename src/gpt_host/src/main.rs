// This is the main entry point for the GPT Protocol Host ("gpt_host") daemon.
// Its primary responsibilities are:
// 1. Lifecycle Management: Creating, starting, stopping, and removing systemd services for
//    GPT Protocol Nodes (guests).
// 2. Confidential Computing: Configuring and launching QEMU virtual machines with AMD SEV-SNP
//    (Secure Encrypted Virtualization - Secure Nested Paging) enabled.
// 3. Identity Management: Generating and managing the host's cryptographic identity (seed)
//    used to derive keys for attestation and secret communication.
// 4. Asset Management: Ensuring the required firmware (OVMF), kernel, and initrd artifacts
//    are available and integrity-checked before launch.
// 5. Routing: Running a reverse proxy/router to direct external traffic to the appropriate
//    local node instance based on hostname/SNI.

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use std::path::PathBuf;

mod commands;
mod diagnostics;
mod ic;
mod identity;
mod network;
mod systemd;
mod vm;

/// The main command-line interface for the GPT Protocol Host.
/// This tool is used by node operators to initialize, configure, and manage SEV-SNP nodes.
#[derive(Parser)]
#[command(author, version, about = "GPT Protocol Host - Manage SEV-SNP nodes")]
struct Cli {
    #[command(subcommand)]
    command: Command,

    /// Override the default path for the host seed file.
    #[arg(long, global = true)]
    seed_path: Option<PathBuf>,
}

#[derive(Subcommand)]
enum Command {
    /// Initialize the host (generate identity seed and setup router).
    Init {
        /// Force overwrite of an existing seed file.
        #[arg(short, long)]
        force: bool,
        /// Only generate identity seed, skip router setup.
        #[arg(long)]
        identity_only: bool,
        /// Only setup router, skip identity generation.
        #[arg(long)]
        router_only: bool,
    },

    /// Add a new node and create its systemd service.
    Add {
        /// Node ID assigned by the Index Canister.
        node_id: u64,
        /// Port to bind (auto-assigned from 8000-9000 if omitted).
        #[arg(short, long)]
        port: Option<u16>,
    },

    /// Start a node.
    Start {
        /// Node ID to start.
        node_id: u64,
    },

    /// Stop a node (graceful shutdown).
    Stop {
        /// Node ID to stop.
        node_id: u64,
    },

    /// Remove a node and delete its systemd service.
    #[command(alias = "rm")]
    Remove {
        /// Node ID to remove.
        node_id: u64,
    },

    /// List all configured nodes and their status.
    #[command(alias = "ls")]
    List,

    /// Follow logs for a node.
    Logs {
        /// Node ID to show logs for.
        node_id: u64,
    },

    /// Run system diagnostics for SEV-SNP compatibility.
    Check,

    /// Show host identity (Chip ID and public key).
    Id,

    /// Fetch node configuration from Index Canister.
    Config {
        /// Node ID to fetch config for.
        node_id: u64,
        /// Index Canister Principal ID.
        #[arg(long)]
        canister_id: String,
        /// IC replica URL.
        #[arg(long, default_value = "https://ic0.app")]
        ic_url: String,
    },

    /// Launch a node manually (for debugging).
    Launch {
        /// Node ID to launch.
        node_id: u64,
        /// Port to bind.
        #[arg(short, long)]
        port: u16,
    },

    /// Start the router daemon (internal, used by systemd).
    #[command(hide = true)]
    Router {
        #[arg(long, default_value = "9999")]
        port: u16,
        #[arg(long, default_value = "https://ic0.app")]
        ic_url: String,
        #[arg(long, default_value = "u6s2n-gx777-77774-qaaba-cai")]
        canister_id: String,
    },

    /// Internal: launch VM via systemd (do not use directly).
    #[command(hide = true)]
    LaunchInternal {
        node_id: u64,
        #[arg(short, long)]
        port: u16,
    },
}

/// Ensures that the command is running with root privileges.
/// Required for accessing /dev/sev, managing systemd units, and binding low ports.
fn ensure_root() -> Result<()> {
    if unsafe { libc::geteuid() } != 0 {
        bail!("This command must be run as root (or using sudo).")
    }
    Ok(())
}

fn main() -> Result<()> {
    ensure_root().context("Root privileges are required to run any gpt_host command")?;

    let cli = Cli::parse();
    let seed_path_override = cli.seed_path.as_ref();

    match cli.command {
        Command::Init {
            force,
            identity_only,
            router_only,
        } => commands::init::run_init(seed_path_override, force, identity_only, router_only),

        Command::Add { node_id, port } => commands::node::add(node_id, port),
        Command::Start { node_id } => commands::node::start(node_id),
        Command::Stop { node_id } => commands::node::stop(node_id),
        Command::Remove { node_id } => commands::node::remove(node_id),
        Command::List => commands::node::list(),
        Command::Logs { node_id } => commands::node::logs(node_id),

        Command::Check => commands::check::run_check(),
        Command::Id => commands::identity::run_id(seed_path_override),

        Command::Config {
            node_id,
            canister_id,
            ic_url,
        } => {
            let rt = tokio::runtime::Runtime::new().context("Failed to create Tokio runtime")?;
            rt.block_on(commands::config::run_config(node_id, ic_url, canister_id))
        }

        Command::Launch { node_id, port } => {
            commands::check::run_check()?;
            commands::launch::run_launch(port, node_id, seed_path_override)
        }

        // Internal commands (hidden from help)
        Command::Router {
            port,
            ic_url,
            canister_id,
        } => {
            tracing_subscriber::fmt()
                .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
                .init();

            let rt = tokio::runtime::Runtime::new().context("Failed to create Tokio runtime")?;
            rt.block_on(commands::router::run_router(port, ic_url, canister_id))
        }

        Command::LaunchInternal { node_id, port } => {
            commands::launch::run_launch(port, node_id, seed_path_override)
        }
    }
}
