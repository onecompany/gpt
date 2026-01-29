use anyhow::{Context, Result};
use fs2::FileExt;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

// Embed pre-built reproducible VM components into the binary.
// We only embed the assets strictly required for cryptographic attestation continuity.
// The hypervisor binary itself is provided by the system OS.
const OVMF: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../artifacts/vm/OVMF.fd"
));
const INITRD: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../artifacts/vm/initrd.gz"
));
const VMLINUZ: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../artifacts/vm/vmlinuz"
));

/// Represents the location of extracted VM assets.
pub struct VmAssets {
    #[allow(dead_code)] // Field preserved for future cleanup/verification logic
    pub dir: PathBuf,
    pub ovmf: PathBuf,
    pub initrd: PathBuf,
    pub kernel: PathBuf,
}

/// Ensures that the VM assets are extracted to the host's persistent storage.
/// Uses a content-addressable scheme based on the hash of the assets.
/// Includes file locking to prevent race conditions between concurrent invocations.
pub fn ensure_assets() -> Result<VmAssets> {
    // 1. Compute deterministic hash of all embedded assets
    let mut hasher = Sha256::new();
    hasher.update(OVMF);
    hasher.update(INITRD);
    hasher.update(VMLINUZ);
    let hash = hex::encode(hasher.finalize());
    let short_hash = &hash[..16];

    // 2. Prepare paths
    // We use /var/lib/gpt_host as the base directory for persistent data
    let base_storage = PathBuf::from("/var/lib/gpt_host/assets");
    let target_dir = base_storage.join(short_hash);

    if !base_storage.exists() {
        fs::create_dir_all(&base_storage).context("Failed to create asset storage base")?;
    }

    // 3. Check existence with Lock to prevent race conditions
    // The lock file ensures that if two nodes start simultaneously with the same binary,
    // only one tries to write the assets.
    if !target_dir.exists() {
        let lock_file_path = base_storage.join(".lock");
        let lock_file = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&lock_file_path)
            .context("Failed to open asset lock file")?;

        // Acquire exclusive lock
        lock_file
            .lock_exclusive()
            .context("Failed to acquire asset lock")?;

        // Double check existence after acquiring lock
        if !target_dir.exists() {
            println!("Extracting new VM assets to {}...", target_dir.display());
            if let Err(e) = extract_assets(&target_dir) {
                // If extraction fails, try to cleanup partially extracted dir
                let _ = fs::remove_dir_all(&target_dir);
                // Ensure we unlock before returning error (OS usually handles this on close, but explicit is good)
                let _ = FileExt::unlock(&lock_file);
                return Err(e);
            }
        }

        // Use fully qualified syntax to avoid unstable name collisions
        FileExt::unlock(&lock_file).context("Failed to unlock asset lock")?;
    }

    Ok(VmAssets {
        ovmf: target_dir.join("OVMF.fd"),
        initrd: target_dir.join("initrd.gz"),
        kernel: target_dir.join("vmlinuz"),
        dir: target_dir,
    })
}

fn extract_assets(dir: &Path) -> Result<()> {
    fs::create_dir_all(dir).context("Failed to create asset directory")?;

    // Write data files with default permissions (usually 0644/0600 depending on umask, but read is needed)
    fs::write(dir.join("OVMF.fd"), OVMF).context("Failed to write OVMF.fd")?;
    fs::write(dir.join("initrd.gz"), INITRD).context("Failed to write initrd.gz")?;
    fs::write(dir.join("vmlinuz"), VMLINUZ).context("Failed to write vmlinuz")?;

    Ok(())
}
