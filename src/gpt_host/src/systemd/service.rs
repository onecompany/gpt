use crate::network::port_manager;
use anyhow::{Context, Result, anyhow};
use colorful::Colorful;
use regex::Regex;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

const SYSTEMD_DIR: &str = "/etc/systemd/system";

/// Generates and installs a Systemd unit file for the GPT Host Router Daemon.
pub fn setup_router_service() -> Result<()> {
    let current_exe = std::env::current_exe().context("Failed to get current exe path")?;
    let exe_path = current_exe.to_string_lossy();
    let service_name = "gpt_router.service";
    let service_path = PathBuf::from(SYSTEMD_DIR).join(service_name);

    let content = format!(
        r#"[Unit]
Description=GPT Protocol Host Router
After=network.target

[Service]
Type=simple
# Launch the router daemon on default port 9999
ExecStart={exe_path} router --port 9999
Restart=always
RestartSec=5
User=root
Group=root
# Increase file limits for high concurrency proxying
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
"#,
        exe_path = exe_path
    );

    fs::write(&service_path, content)
        .with_context(|| format!("Failed to write router service file at {:?}", service_path))?;
    println!("Created router service file: {}", service_path.display());

    run_systemctl(&["daemon-reload"])?;
    run_systemctl(&["enable", service_name])?;
    run_systemctl(&["restart", service_name])?;

    println!("Router service enabled and started. It will proxy traffic on port 9999.");
    Ok(())
}

/// Generates and installs a Systemd unit file for a specific node configuration.
/// If `port` is None, it automatically assigns a stable, free port.
pub fn add_service(node_id: u64, port_opt: Option<u16>) -> Result<()> {
    // Acquire lock to prevent race conditions during port scanning/assignment
    port_manager::with_port_lock(|| {
        let current_exe = std::env::current_exe().context("Failed to get current exe path")?;
        let exe_path = current_exe.to_string_lossy();
        let service_name = format!("gpt_node_{}.service", node_id);
        let service_path = PathBuf::from(SYSTEMD_DIR).join(&service_name);

        // Determine port
        let port = match port_opt {
            Some(p) => p,
            None => {
                // Check if already assigned (idempotency)
                if let Some(existing) = port_manager::get_assigned_port(node_id)? {
                    println!(
                        "Node {} already configured on port {}. Updating service...",
                        node_id, existing
                    );
                    existing
                } else {
                    // Find a new free port
                    let allocated = port_manager::get_allocated_ports()?;
                    // Search range 8000-9000
                    port_manager::find_free_port(8000, 9000, &allocated)
                        .ok_or_else(|| anyhow!("No free ports available in range 8000-9000"))?
                }
            }
        };

        // Definition of the systemd unit file.
        let content = format!(
            r#"[Unit]
Description=GPT Protocol Node {node_id}
After=network.target
# Fail if pre-check fails
OnFailure=failure-handler.service

[Service]
Type=simple
# Verify SEV-SNP hardware support before starting
ExecStartPre={exe_path} check
# Replace this process with QEMU via execv
ExecStart={exe_path} launch-internal {node_id} -p {port}
# Graceful shutdown via SIGTERM to QEMU -> ACPI to Guest
KillSignal=SIGTERM
TimeoutStopSec=120
# Do not restart automatically on failure (per requirements)
Restart=no
# Run as root for /dev/sev and memory locking
User=root
Group=root
# Security hardening
PrivateTmp=true

[Install]
WantedBy=multi-user.target
"#,
            node_id = node_id,
            port = port,
            exe_path = exe_path
        );

        fs::write(&service_path, content)
            .with_context(|| format!("Failed to write service file at {:?}", service_path))?;
        println!(
            "Created service file: {} (Port: {})",
            service_path.display(),
            port
        );

        run_systemctl(&["daemon-reload"])?;
        run_systemctl(&["enable", &service_name])?;

        println!("Service enabled. Start with: sudo gpt_host start {}", node_id);

        Ok(())
    })?;

    // Optimistic Update: Trigger Router Reload via SIGHUP
    trigger_router_reload();

    Ok(())
}

/// Sends SIGHUP to the gpt_host router process to trigger an immediate routing table refresh.
fn trigger_router_reload() {
    // pkill -HUP -f "gpt_host router"
    // We ignore errors here because the router might not be running yet, which is fine.
    let _ = Command::new("pkill")
        .args(["-HUP", "-f", "gpt_host router"])
        .status();
}

/// Starts the systemd service for the given node ID.
pub fn start_service(node_id: u64) -> Result<()> {
    run_systemctl(&["start", &format!("gpt_node_{}.service", node_id)])
}

/// Stops the systemd service for the given node ID.
pub fn stop_service(node_id: u64) -> Result<()> {
    println!("Requesting graceful shutdown for Node {}...", node_id);
    run_systemctl(&["stop", &format!("gpt_node_{}.service", node_id)])
}

/// Removes the systemd service and configuration for the given node ID.
pub fn remove_service(node_id: u64) -> Result<()> {
    let name = format!("gpt_node_{}.service", node_id);
    let path = PathBuf::from(SYSTEMD_DIR).join(&name);

    if !path.exists() {
        return Err(anyhow!("Service {} does not exist.", name));
    }

    // Ensure it is stopped and disabled before removal
    let _ = run_systemctl(&["stop", &name]);
    let _ = run_systemctl(&["disable", &name]);

    fs::remove_file(&path).context("Failed to delete service file")?;
    run_systemctl(&["daemon-reload"])?;
    println!("Service removed: {}", name);

    // Trigger Router refresh
    trigger_router_reload();

    Ok(())
}

/// Lists all configured GPT Protocol nodes by scanning systemd unit files.
pub fn list_services() -> Result<()> {
    let re_file = Regex::new(r"gpt_node_(\d+)\.service")?;
    let re_port = Regex::new(r"--port (\d+)")?;

    println!(
        "{:<10} {:<10} {:<15} {:<30}",
        "NODE ID", "PORT", "STATUS", "UNIT"
    );
    println!("{:-<10} {:-<10} {:-<15} {:-<30}", "", "", "", "");

    if let Ok(entries) = fs::read_dir(SYSTEMD_DIR) {
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            let fname = entry.file_name().to_string_lossy().to_string();

            if let Some(caps) = re_file.captures(&fname) {
                let node_id = &caps[1];

                // Read file content to parse the configured port
                let content = match fs::read_to_string(&path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let port = if let Some(pcaps) = re_port.captures(&content) {
                    pcaps[1].to_string()
                } else {
                    "???".to_string()
                };

                let status = get_active_state(&fname);
                let status_colored = if status == "active" {
                    "running".green()
                } else if status == "failed" {
                    "failed".red()
                } else if status == "inactive" {
                    "stopped".dim()
                } else {
                    status.white()
                };

                println!(
                    "{:<10} {:<10} {:<15} {:<30}",
                    node_id, port, status_colored, fname
                );
            }
        }
    }
    Ok(())
}

/// Follows the logs for a specific node using journalctl.
pub fn follow_logs(node_id: u64) -> Result<()> {
    let unit_name = format!("gpt_node_{}.service", node_id);
    println!("Showing logs for {}. Press Ctrl+C to exit.", unit_name);

    let status = Command::new("journalctl")
        .args(["-u", &unit_name, "-n", "100", "-f"])
        .status()
        .context("Failed to execute journalctl")?;

    if !status.success() {
        return Err(anyhow!("journalctl exited with error code"));
    }
    Ok(())
}

fn run_systemctl(args: &[&str]) -> Result<()> {
    let status = Command::new("systemctl")
        .args(args)
        .status()
        .with_context(|| format!("Failed to execute systemctl {:?}", args))?;

    if !status.success() {
        return Err(anyhow!("systemctl command {:?} failed", args));
    }
    Ok(())
}

fn get_active_state(unit: &str) -> String {
    let output = Command::new("systemctl").args(["is-active", unit]).output();

    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        Err(_) => "unknown".to_string(),
    }
}
