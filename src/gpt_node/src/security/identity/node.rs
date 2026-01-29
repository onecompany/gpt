use age::x25519::Identity as X25519Identity;
use crate::core::error::NodeError;
use tracing::info;

/// Generates a new ephemeral age x25519 identity for node-to-client encryption.
pub fn generate_node_identity() -> Result<(X25519Identity, String), NodeError> {
    info!("Generating new ephemeral node age identity...");
    let identity = X25519Identity::generate();
    let public_key = identity.to_public().to_string();
    info!("Generated ephemeral node public key: {}", public_key);
    Ok((identity, public_key))
}
