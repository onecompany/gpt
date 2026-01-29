//! Fetch node configuration from Index Canister.

use anyhow::Result;
use crate::ic;

pub async fn run_config(node_id: u64, ic_url: String, canister_id: String) -> Result<()> {
    // Uses the client module to query the Index Canister.
    let config = ic::client::fetch_node_config(node_id, &ic_url, &canister_id).await?;
    println!("GPT_HOSTNAME={}", config.hostname);
    println!("GPT_MODEL_ID={}", config.model_id);
    Ok(())
}
