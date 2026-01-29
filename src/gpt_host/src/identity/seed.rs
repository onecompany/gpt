//! Host identity and seed management.
//!
//! This module handles the generation, loading, and cryptographic derivation of the host's
//! identity seed. The seed is the root of trust for the node's identity and must be protected.

use anyhow::{Context, Result, bail};
use colorful::Colorful;
use rand::TryRngCore;
use rand::rngs::OsRng;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::PathBuf;
use x25519_dalek::PublicKey;
use zeroize::Zeroize;
use bech32::{Bech32, Hrp};

// Constants defining the default location for storing the host's secret seed.
// This seed is critical for the identity of the host and must be protected.
const CONFIG_BASE_DIR: &str = "/etc";
const APP_CONFIG_DIR_NAME: &str = "gpt_host";
const HOST_SEED_NAME: &str = "host_seed.bin";

pub const SEED_LENGTH: usize = 24;
// The host data passed to the guest via SEV-SNP (contains node ID + seed slice)
pub const HOST_DATA_LENGTH: usize = 32;

/// Determines the path to the host seed file, using an override if provided.
pub fn get_seed_path(seed_path_override: Option<&PathBuf>) -> Result<PathBuf> {
    match seed_path_override {
        Some(path) => {
            if path.is_dir() {
                bail!(
                    "Provided seed path is a directory, must be a file: {}",
                    path.display()
                );
            }
            Ok(path.clone())
        }
        None => {
            let default_path = PathBuf::from(CONFIG_BASE_DIR)
                .join(APP_CONFIG_DIR_NAME)
                .join(HOST_SEED_NAME);
            Ok(default_path)
        }
    }
}

/// Saves the generated seed to a file with secure permissions (0o600).
/// This seed is the root of trust for the node's identity.
pub fn save_seed(seed: &[u8; SEED_LENGTH], seed_path: &PathBuf) -> Result<()> {
    let parent_dir = seed_path.parent().ok_or_else(|| {
        anyhow::anyhow!("Invalid seed path configuration: {}", seed_path.display())
    })?;

    fs::create_dir_all(parent_dir).with_context(|| {
        format!(
            "Failed to create config directory (permissions?): {}",
            parent_dir.display()
        )
    })?;

    // Open with exclusive creation to avoid race conditions and ensure fresh file.
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600) // Strict read/write for owner only.
        .open(seed_path)
        .with_context(|| {
            format!(
                "Failed to create or open seed file (permissions?): {}",
                seed_path.display()
            )
        })?;

    file.write_all(seed)
        .with_context(|| format!("Failed to write seed to file: {}", seed_path.display()))?;

    println!("Successfully saved node seed to: {}", seed_path.display());
    Ok(())
}

/// Loads the host seed from its file, checking for existence and secure permissions.
pub fn load_seed(seed_path_override: Option<&PathBuf>) -> Result<[u8; SEED_LENGTH]> {
    let seed_path = get_seed_path(seed_path_override)?;
    if !seed_path.exists() {
        bail!(
            "Node seed file not found at {}. Please run './gpt_host init' first (as root).",
            seed_path.display()
        );
    }

    let mut file = fs::OpenOptions::new()
        .read(true)
        .open(&seed_path)
        .with_context(|| {
            format!(
                "Failed to open seed file (permissions?): {}",
                seed_path.display()
            )
        })?;

    // Warn if permissions are too open (not 600).
    let metadata = file.metadata()?;
    let permissions = metadata.permissions();
    if permissions.mode() & 0o077 != 0 {
        eprintln!(
            "{}",
            format!(
                "Warning: Seed file {} has potentially insecure permissions ({:#o}). Expected 0o600.",
                seed_path.display(),
                permissions.mode() & 0o777
            )
            .color(colorful::Color::Yellow)
        );
    }

    let mut seed = [0u8; SEED_LENGTH];
    file.read_exact(&mut seed)
        .with_context(|| format!("Failed to read seed file: {}", seed_path.display()))?;

    Ok(seed)
}

/// Generates a new cryptographically secure random seed.
pub fn generate_seed(seed_path: &PathBuf) -> Result<()> {
    println!("Generating new 24-byte node identity seed...");
    let mut seed = [0u8; SEED_LENGTH];
    OsRng
        .try_fill_bytes(&mut seed)
        .map_err(|e| anyhow::anyhow!("Failed to generate random seed bytes using OS RNG: {}", e))?;

    save_seed(&seed, seed_path)?;

    // Ensure the seed is wiped from memory after being written to disk.
    seed.zeroize();

    println!("Node identity initialized successfully.");
    Ok(())
}

/// Derives an X25519 private key from the seed.
/// This key is used for Age encryption/decryption of secrets.
pub fn seed_to_x25519_key(seed: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"gpt_host_age_key_derivation_v1"); // Domain separation tag.
    hasher.update(seed);
    let result = hasher.finalize();

    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(result.as_slice());

    // Clamp the key for X25519 (Curve25519 requirement).
    key_bytes[0] &= 248;
    key_bytes[31] &= 127;
    key_bytes[31] |= 64;

    key_bytes
}

/// Converts a public key to an Age recipient string (bech32).
pub fn pubkey_to_age_recipient(pubkey: &PublicKey) -> String {
    let hrp = Hrp::parse("age").expect("valid HRP");
    bech32::encode::<Bech32>(hrp, pubkey.as_bytes())
        .expect("bech32 encoding should not fail for valid inputs")
}
