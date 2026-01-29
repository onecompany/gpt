use crate::core::error::NodeError;
use ic_agent::{export::Principal, identity::Secp256k1Identity, Identity};
use k256::ecdsa::SigningKey;
use rand_core::OsRng;
use tracing::info;

/// Generates a new random ephemeral k256 signing key and derives its Principal.
pub fn generate_ephemeral_identity() -> Result<(SigningKey, Principal), NodeError> {
    info!("Generating new random ephemeral k256 key...");
    let ephemeral_signing_key = SigningKey::random(&mut OsRng);
    let ephemeral_identity =
        Secp256k1Identity::from_private_key(ephemeral_signing_key.clone().into());
    let ephemeral_principal = ephemeral_identity
        .sender()
        .map_err(|e| NodeError::Other(format!("Failed to derive principal from key: {}", e)))?;
    info!(
        "Using ephemeral principal: {}",
        ephemeral_principal.to_text()
    );
    Ok((ephemeral_signing_key, ephemeral_principal))
}
