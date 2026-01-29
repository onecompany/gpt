use crate::ic::client;
use crate::network::router::RoutingTable;
use anyhow::Result;
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{error, info, warn};

pub struct WatcherConfig {
    pub ic_url: String,
    pub canister_id: String,
}

struct NodeMeta {
    port: u16,
    hostname: Option<String>,
}

/// Main loop for the watcher.
/// Scans systemd service files to find active nodes, queries the IC for their hostnames,
/// and updates the shared RoutingTable for the Router.
pub async fn run_watcher(
    table: RoutingTable,
    config: WatcherConfig,
    mut signal_rx: tokio::sync::mpsc::Receiver<()>,
) {
    let mut cache: HashMap<u64, NodeMeta> = HashMap::new();
    let re_file = Regex::new(r"gpt_node_(\d+)\.service").unwrap();
    let re_port = Regex::new(r"--port (\d+)").unwrap();

    info!("Watcher started. Polling for gpt_node services...");

    loop {
        // Run sync logic
        if let Err(e) = sync_state(&table, &config, &mut cache, &re_file, &re_port).await {
            error!("Watcher sync failed: {}", e);
        }

        // Wait for timeout OR signal (SIGHUP)
        tokio::select! {
            _ = sleep(Duration::from_secs(30)) => {}, // Periodic poll every 30s
            _ = signal_rx.recv() => {
                info!("Received update signal, syncing immediately...");
            }
        }
    }
}

async fn sync_state(
    table: &RoutingTable,
    config: &WatcherConfig,
    cache: &mut HashMap<u64, NodeMeta>,
    re_file: &Regex,
    re_port: &Regex,
) -> Result<()> {
    let mut active_node_ids = HashSet::new();
    let systemd_dir = "/etc/systemd/system";

    if !std::path::Path::new(systemd_dir).exists() {
        return Ok(());
    }

    let entries = fs::read_dir(systemd_dir)?;

    for entry in entries {
        let entry = entry?;
        let fname = entry.file_name().to_string_lossy().to_string();

        if let Some(caps) = re_file.captures(&fname)
            && let Ok(node_id) = caps[1].parse::<u64>()
        {
            let content = match fs::read_to_string(entry.path()) {
                Ok(c) => c,
                Err(e) => {
                    warn!("Failed to read service file {}: {}", fname, e);
                    continue;
                }
            };

            if let Some(port_caps) = re_port.captures(&content)
                && let Ok(port) = port_caps[1].parse::<u16>()
            {
                active_node_ids.insert(node_id);

                // Check if we need to update cache (new node or port changed)
                let meta_exists = cache.contains_key(&node_id);
                let port_changed = if let Some(m) = cache.get(&node_id) {
                    m.port != port
                } else {
                    false
                };

                if !meta_exists || port_changed {
                    // Insert or update port
                    let hostname = cache.get(&node_id).and_then(|m| m.hostname.clone());
                    cache.insert(
                        node_id,
                        NodeMeta {
                            port,
                            hostname: hostname.clone(),
                        },
                    );
                }

                // If hostname is missing, fetch from IC
                let meta = cache.get_mut(&node_id).unwrap();
                if meta.hostname.is_none() {
                    info!(
                        "Fetching config for Node {} from Index Canister...",
                        node_id
                    );
                    match client::fetch_node_config(node_id, &config.ic_url, &config.canister_id)
                        .await
                    {
                        Ok(cfg) => {
                            info!("Resolved Node {} -> {}", node_id, cfg.hostname);
                            meta.hostname = Some(cfg.hostname);
                        }
                        Err(e) => {
                            warn!(
                                "Failed to resolve hostname for Node {}: {}. Will retry next cycle.",
                                node_id, e
                            );
                        }
                    }
                }
            }
        }
    }

    // Prune cache: remove nodes that no longer have a service file
    cache.retain(|id, _| active_node_ids.contains(id));

    // Rebuild Routing Table (Hostname -> Port)
    let mut new_table = HashMap::new();
    for meta in cache.values() {
        if let Some(host) = &meta.hostname {
            new_table.insert(host.clone(), meta.port);
        }
    }

    // Atomic Swap of the shared routing table
    {
        let mut w = table.write().await;
        let old_count = w.len();
        *w = new_table;
        let new_count = w.len();
        if old_count != new_count {
            info!(
                "Routing table updated. Routes: {} -> {}",
                old_count, new_count
            );
        }
    }

    Ok(())
}
