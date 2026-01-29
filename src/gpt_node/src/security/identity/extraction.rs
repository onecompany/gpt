use age::x25519::Identity as X25519Identity;
use bech32::{Bech32, Hrp};
use crate::core::error::NodeError;
use gpt_types::prelude::NodeId;
use sev::firmware::guest::AttestationReport;
use sev::parser::ByteParser;
use sha2::{Digest, Sha256};
use tracing::info;
use zeroize::Zeroize;

const HOST_DATA_LENGTH: usize = 32;
const NODE_ID_LENGTH: usize = 8;
const SEED_LENGTH: usize = 24;

/// CRITICAL: This Key Derivation Function (KDF) is duplicated in `gpt_host/src/main.rs`.
fn seed_to_x25519_key(seed: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"gpt_host_age_key_derivation_v1");
    hasher.update(seed);
    let result = hasher.finalize();

    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(result.as_slice());

    // Clamp for X25519.
    key_bytes[0] &= 248;
    key_bytes[31] &= 127;
    key_bytes[31] |= 64;

    key_bytes
}

/// Extracts the node ID and host x25519 identity from the attestation report's host_data field.
pub fn extract_host_data(
    report_bytes: &[u8],
) -> Result<(NodeId, X25519Identity), NodeError> {
    info!("Extracting node ID and seed from host-data...");
    let parsed_report = AttestationReport::from_bytes(report_bytes).map_err(|e| {
        NodeError::Attestation(format!("Failed to re-parse verified report: {}", e))
    })?;

    if parsed_report.host_data.iter().all(|&b| b == 0) {
        return Err(NodeError::Attestation("Host data is all zeros".to_string()));
    }
    if parsed_report.host_data.len() != HOST_DATA_LENGTH {
        return Err(NodeError::Attestation(format!(
            "Host data length is {}, expected {}",
            parsed_report.host_data.len(),
            HOST_DATA_LENGTH
        )));
    }

    let host_data_bytes: [u8; HOST_DATA_LENGTH] = parsed_report
        .host_data
        .as_slice()
        .try_into()
        .map_err(|_| NodeError::Attestation("Host data slice conversion failed".to_string()))?;

    let node_id_bytes: [u8; NODE_ID_LENGTH] =
        host_data_bytes[0..NODE_ID_LENGTH].try_into().unwrap();
    let extracted_node_id = u64::from_le_bytes(node_id_bytes);
    info!("Extracted Node ID: {}", extracted_node_id);

    let mut extracted_seed_bytes: [u8; SEED_LENGTH] = host_data_bytes
        [NODE_ID_LENGTH..HOST_DATA_LENGTH]
        .try_into()
        .unwrap();
    info!("Extracted Seed.");

    // Derive the clamped X25519 secret key (32 bytes).
    let mut secret_key_bytes = seed_to_x25519_key(&extracted_seed_bytes);

    // Build a Bech32 "AGE-SECRET-KEY-..." string using bech32 v0.11 API, uppercase.
    let hrp = Hrp::parse("age-secret-key-")
        .map_err(|e| NodeError::Attestation(format!("Invalid HRP for age key: {}", e)))?;
    let encoded = bech32::encode_upper::<Bech32>(hrp, &secret_key_bytes).map_err(|e| {
        NodeError::Attestation(format!("Failed to Bech32-encode X25519 secret key: {}", e))
    })?;

    let host_x25519_identity: X25519Identity = encoded.parse().map_err(|e| {
        NodeError::Attestation(format!(
            "Failed to parse Bech32 AGE secret key into x25519 identity: {}",
            e
        ))
    })?;
    info!("Created age x25519 identity from host seed.");

    // Wipe sensitive material from memory.
    extracted_seed_bytes.zeroize();
    secret_key_bytes.zeroize();

    Ok((extracted_node_id, host_x25519_identity))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_kdf_matches_host_implementation() {
        let seed: [u8; 24] = [
            0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
            0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
        ];

        // This is the CORRECTED value and MUST be the same as in the `gpt_host` test.
        let expected_key: [u8; 32] = [
            56, 67, 185, 203, 103, 240, 87, 61, 87, 197, 87, 110, 4, 47, 208, 54, 135, 52, 80, 138,
            15, 98, 198, 212, 233, 21, 64, 174, 232, 63, 165, 107,
        ];

        let key = seed_to_x25519_key(&seed);
        assert_eq!(
            key, expected_key,
            "KDF implementation in gpt_node diverges from gpt_host."
        );
    }
}
