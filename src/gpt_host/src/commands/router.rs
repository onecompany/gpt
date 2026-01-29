//! Router daemon command (internal, used by systemd).

use anyhow::Result;
use crate::network;

pub async fn run_router(port: u16, ic_url: String, canister_id: String) -> Result<()> {
    network::router::start_router(port, ic_url, canister_id).await
}
