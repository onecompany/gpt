//! Host identity display command.

use anyhow::Result;
use colorful::Colorful;
use std::path::PathBuf;
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroize;

use crate::identity;

pub fn run_id(seed_path_override: Option<&PathBuf>) -> Result<()> {
    use sev::firmware::host::Firmware;

    // Fetch and display the unique hardware ID from the AMD Secure Processor.
    let chip_id_hex = match Firmware::open() {
        Ok(mut fw) => match fw.get_identifier() {
            Ok(id) => {
                if id.0.is_empty() {
                    "Empty identifier received from firmware".to_string()
                } else {
                    hex::encode(&id.0)
                }
            }
            Err(e) => format!("Error retrieving chip ID: {}", e),
        },
        Err(e) => format!("Error opening firmware interface (/dev/sev): {}", e),
    };
    println!("Unique Chip ID: {}", chip_id_hex);

    // Load the seed, derive the secret/public key pair, and display the public key.
    match identity::load_seed(seed_path_override) {
        Ok(mut seed) => {
            let mut key_bytes = identity::seed_to_x25519_key(&seed);
            let secret = StaticSecret::from(key_bytes);
            key_bytes.zeroize(); // Wipe intermediate key material.

            let public = PublicKey::from(&secret);

            // Format the public key as a standard `age` recipient string.
            let recipient_string = identity::pubkey_to_age_recipient(&public);
            println!("Host Identity: {}", recipient_string);

            seed.zeroize(); // Wipe the seed after use.
        }
        Err(e) => {
            let seed_path_str = match identity::get_seed_path(seed_path_override) {
                Ok(p) => p.display().to_string(),
                Err(_) => "<default path>".to_string(),
            };
            println!(
                "{}",
                format!(
                    "Host Identity: Not Initialized (seed file missing or inaccessible at {} - Error: {})",
                    seed_path_str, e
                )
                .color(colorful::Color::Yellow)
            );
        }
    }
    Ok(())
}
