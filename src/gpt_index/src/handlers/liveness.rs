use crate::config;
use crate::handlers::node::lifecycle::deactivate_node_internal;
use crate::storage::NODES;
use gpt_types::domain::NodeId;
use gpt_types::domain::node::NodeLifecycleStatus;
use ic_cdk::api;
use ic_cdk_timers::set_timer_interval;

pub fn setup_liveness_timer() {
    ic_cdk::println!(
        "Setting up node liveness check timer (interval: {:?}, timeout: {:?})",
        config::LIVENESS_CHECK_INTERVAL,
        config::LIVENESS_TIMEOUT
    );
    set_timer_interval(config::LIVENESS_CHECK_INTERVAL, || {
        ic_cdk::futures::spawn(check_node_liveness_tick());
    });
}

async fn check_node_liveness_tick() {
    let current_time = api::time();
    let timeout_threshold_ns = config::LIVENESS_TIMEOUT.as_nanos() as u64;
    ic_cdk::println!(
        "Liveness Check Timer Tick at time: {}. Timeout threshold: {}ns",
        current_time,
        timeout_threshold_ns
    );

    let mut nodes_to_deactivate: Vec<NodeId> = Vec::new();

    NODES.with(|nodes_refcell| {
        let nodes_map = nodes_refcell.borrow();
        for (node_id, wrapper) in nodes_map.iter() {
            let node = &wrapper.0;
            // Check if node is effectively active (Active or Draining, but mostly Active for heartbeat purposes)
            if node.lifecycle_status != NodeLifecycleStatus::Inactive {
                match node.last_heartbeat_timestamp {
                    Some(last_heartbeat) => {
                        let time_since_heartbeat = current_time.saturating_sub(last_heartbeat);
                        if time_since_heartbeat > timeout_threshold_ns {
                            ic_cdk::println!(
                                "Node {} timed out. Last heartbeat: {} ({}ns ago). Marked for deactivation.",
                                node_id,
                                last_heartbeat,
                                time_since_heartbeat
                            );
                            nodes_to_deactivate.push(node_id);
                        }
                    }
                    None => {
                        ic_cdk::println!(
                            "WARN: Active/Draining node {} has no last_heartbeat_timestamp set. Considering it timed out.",
                            node_id
                        );
                        nodes_to_deactivate.push(node_id);
                    }
                }
            }
        }
    });

    if !nodes_to_deactivate.is_empty() {
        ic_cdk::println!(
            "Deactivating {} timed-out nodes...",
            nodes_to_deactivate.len()
        );
        for node_id in nodes_to_deactivate {
            match deactivate_node_internal(node_id) {
                Ok(_) => ic_cdk::println!("Successfully deactivated timed-out node {}.", node_id),
                Err(e) => ic_cdk::println!(
                    "ERROR: Failed to deactivate timed-out node {}: {:?}",
                    node_id,
                    e
                ),
            }
        }
    } else {
        ic_cdk::println!("No nodes timed out during this liveness check.");
    }
    ic_cdk::println!("Liveness check finished.");
}
