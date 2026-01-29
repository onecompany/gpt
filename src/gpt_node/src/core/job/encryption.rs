use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use age::Decryptor;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use rand::RngCore;
use std::io::Read;
use std::iter;

// Standard 12-byte IV for AES-GCM
const GCM_NONCE_SIZE: usize = 12;

/// Decrypts a chat key that was encrypted with Age using the node's x25519 identity.
pub(super) fn decrypt_chat_key(
    encrypted_key_b64: &str,
    node_identity: &age::x25519::Identity,
) -> anyhow::Result<Vec<u8>> {
    // 1. Decode Base64 to get the binary Age file
    let encrypted_bytes = STANDARD
        .decode(encrypted_key_b64)
        .map_err(|e| anyhow::anyhow!("Failed to decode Base64 chat key: {}", e))?;

    // 2. Initialize Decryptor with binary bytes
    let decryptor = Decryptor::new(&encrypted_bytes[..])
        .map_err(|e| anyhow::anyhow!("Failed to parse Age header: {}", e))?;

    // 3. Decrypt using the node's identity
    let mut decrypted_reader = decryptor
        .decrypt(iter::once(node_identity as &dyn age::Identity))
        .map_err(|e| anyhow::anyhow!("Decryption failed (wrong identity?): {}", e))?;

    let mut key = Vec::new();
    decrypted_reader
        .read_to_end(&mut key)
        .map_err(|e| anyhow::anyhow!("Failed to read decrypted bytes: {}", e))?;

    if key.len() != 32 {
        return Err(anyhow::anyhow!(
            "Decrypted key length mismatch. Expected 32 bytes, got {}",
            key.len()
        ));
    }
    Ok(key)
}

/// Encrypts content using AES-256-GCM with a random nonce.
/// Returns [nonce (12 bytes)][ciphertext + auth tag].
pub fn encrypt_content(plaintext: &str, key: &[u8]) -> anyhow::Result<Vec<u8>> {
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(key);

    // 12 bytes random nonce
    let mut nonce_bytes = [0u8; GCM_NONCE_SIZE];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow::anyhow!("Encryption error: {}", e))?;

    // Prepend IV to ciphertext: [IV (12)] [Ciphertext....Tag]
    let mut final_payload = Vec::with_capacity(GCM_NONCE_SIZE + ciphertext.len());
    final_payload.extend_from_slice(&nonce_bytes);
    final_payload.extend_from_slice(&ciphertext);
    Ok(final_payload)
}

/// Decrypts content encrypted with AES-256-GCM.
/// Expects payload format: [nonce (12 bytes)][ciphertext + auth tag].
pub(super) fn decrypt_content(payload: &[u8], key: &[u8]) -> anyhow::Result<String> {
    if payload.len() < GCM_NONCE_SIZE {
        return Err(anyhow::anyhow!("Payload too short for IV"));
    }

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(key);

    let nonce_bytes = &payload[..GCM_NONCE_SIZE];
    let ciphertext = &payload[GCM_NONCE_SIZE..];
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| anyhow::anyhow!("Decryption error: {}", e))?;

    let plaintext = String::from_utf8(plaintext_bytes)
        .map_err(|e| anyhow::anyhow!("Invalid UTF-8 after decryption: {}", e))?;

    Ok(plaintext)
}
