mod comms;
mod state_init;

use crate::{
    core::{error::NodeError, state::SharedState},
    security::{attestation, identity},
    Args,
};
use gpt_types::prelude::NodeId;
use ic_agent::export::Principal;
use sha2::{Digest, Sha256};
use std::time::SystemTime;
use tracing::info;

/// Performs node startup: attestation, identity generation, registration, and state initialization.
pub async fn perform_startup(args: &Args) -> Result<(SharedState, Principal, NodeId), NodeError> {
    let (ephemeral_signing_key, ephemeral_principal) = identity::generate_ephemeral_identity()?;

    // Generate the ephemeral node age identity for E2E encryption
    let (node_x25519_identity, node_public_key) = identity::generate_node_identity()?;

    let (index_principal, attestation_requirements) =
        comms::fetch_setup_requirements(args, &ephemeral_signing_key).await?;

    // Replay Protection: Generate Nonce
    // Nonce = SHA256(CallerPrincipal || Timestamp)
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64;

    let mut hasher = Sha256::new();
    hasher.update(ephemeral_principal.as_slice());
    hasher.update(timestamp.to_le_bytes());
    let nonce_digest = hasher.finalize();

    let mut report_data_payload = [0u8; 64];
    report_data_payload[0..32].copy_from_slice(&nonce_digest);

    info!("Starting Local SEV-SNP Attestation Verification...");
    let attestation_data =
        attestation::fetch_attestation_data(&attestation_requirements, report_data_payload)
            .map_err(|e| {
                NodeError::Attestation(format!("Attestation fetch/verify failed: {:?}", e))
            })?;
    info!("Local SEV-SNP Attestation Verification Successful.");

    let (node_id, host_x25519_identity) =
        identity::extract_host_data(&attestation_data.report_bytes)?;

    let (agent, node_config, model_details) = comms::register_and_configure_node(
        args,
        &index_principal,
        &ephemeral_signing_key,
        node_id,
        attestation_data,
        timestamp, // Pass timestamp to registration
        node_public_key.clone(),
    )
    .await?;

    let shared_state = state_init::initialize_shared_state(
        args,
        node_id,
        node_config,
        model_details,
        agent,
        ephemeral_signing_key,
        host_x25519_identity,
        node_x25519_identity,
        node_public_key,
    )?;
    info!("Shared application state initialized.");

    Ok((shared_state, index_principal, node_id))
}
