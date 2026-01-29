use anyhow::{Context, Result};
use candid::{Decode, Encode};
use gpt_types::api::{GetProvisioningInfoRequest, GetProvisioningInfoResult};
use ic_agent::{Agent, export::Principal};

#[derive(Clone, Debug)]
pub struct NodePublicConfig {
    pub hostname: String,
    pub model_id: String,
}

/// Fetches public configuration for a node. Uses anonymous identity.
/// This is used by both the CLI (config command) and the Router (watcher).
pub async fn fetch_node_config(
    node_id: u64,
    ic_url: &str,
    canister_id: &str,
) -> Result<NodePublicConfig> {
    let agent = Agent::builder()
        .with_url(ic_url)
        .build()
        .context("Failed to build IC agent")?;

    // If not mainnet, fetch root key to allow communication
    if !ic_url.contains("ic0.app") {
        agent
            .fetch_root_key()
            .await
            .context("Failed to fetch root key")?;
    }

    let canister_principal =
        Principal::from_text(canister_id).context("Invalid canister principal ID")?;
    let args =
        Encode!(&GetProvisioningInfoRequest { node_id }).context("Failed to encode arguments")?;

    let response_bytes = agent
        .query(&canister_principal, "get_provisioning_info")
        .with_arg(args)
        .call()
        .await
        .context("Failed to call get_provisioning_info on index canister")?;

    let result: GetProvisioningInfoResult = Decode!(&response_bytes, GetProvisioningInfoResult)
        .context("Failed to decode canister response")?;

    match result {
        Ok(info) => Ok(NodePublicConfig {
            hostname: info.hostname,
            model_id: info.model_id,
        }),
        Err(e) => Err(anyhow::anyhow!("Canister returned an error: {:?}", e)),
    }
}
