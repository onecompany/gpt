use anyhow::{Context, Result};
use fs2::FileExt;
use regex::Regex;
use std::collections::HashSet;
use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;

const SYSTEMD_DIR: &str = "/etc/systemd/system";
const LOCK_FILE_DIR: &str = "/var/lib/gpt_host";
const LOCK_FILE_NAME: &str = "port.lock";

/// Scans systemd directory for `gpt_node_(\d+).service` files and extracts used ports.
/// This acts as the source of truth for persistent port allocations.
pub fn get_allocated_ports() -> Result<HashSet<u16>> {
    let mut ports = HashSet::new();
    let re_file = Regex::new(r"gpt_node_(\d+)\.service")?;
    let re_port = Regex::new(r"--port (\d+)")?;

    if !std::path::Path::new(SYSTEMD_DIR).exists() {
        return Ok(ports);
    }

    for entry in fs::read_dir(SYSTEMD_DIR)? {
        let entry = entry?;
        let path = entry.path();
        let fname = entry.file_name().to_string_lossy().to_string();

        if re_file.is_match(&fname) {
            // Read file content to parse the configured port
            let content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            if let Some(pcaps) = re_port.captures(&content)
                && let Ok(port) = pcaps[1].parse::<u16>()
            {
                ports.insert(port);
            }
        }
    }
    Ok(ports)
}

/// Helper to check if a specific node ID already has a service file and return its port if so.
pub fn get_assigned_port(node_id: u64) -> Result<Option<u16>> {
    let service_name = format!("gpt_node_{}.service", node_id);
    let path = PathBuf::from(SYSTEMD_DIR).join(&service_name);

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)?;
    let re_port = Regex::new(r"--port (\d+)")?;

    if let Some(caps) = re_port.captures(&content) {
        let port = caps[1].parse::<u16>()?;
        return Ok(Some(port));
    }

    Ok(None)
}

/// Finds a free port in the range [start, end) that is NOT in the excluded set AND not currently bound by OS.
/// MUST be called while holding a system-wide lock if used for assignment to ensure atomicity.
pub fn find_free_port(start: u16, end: u16, excluded: &HashSet<u16>) -> Option<u16> {
    (start..end).find(|&port| !excluded.contains(&port) && is_port_available(port))
}

/// Checks if a port is available by attempting to bind to it on localhost.
fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

/// Helper to run a closure with an exclusive file lock to prevent race conditions during port assignment.
pub fn with_port_lock<F, T>(f: F) -> Result<T>
where
    F: FnOnce() -> Result<T>,
{
    let lock_dir = PathBuf::from(LOCK_FILE_DIR);
    if !lock_dir.exists() {
        fs::create_dir_all(&lock_dir).context("Failed to create lock directory")?;
    }
    let lock_path = lock_dir.join(LOCK_FILE_NAME);

    let file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .open(&lock_path)
        .context("Failed to open port lock file")?;

    file.lock_exclusive()
        .context("Failed to acquire port lock")?;

    let result = f();

    // Use fully qualified syntax to avoid instability warning
    let _ = FileExt::unlock(&file);

    result
}
