use crate::storage::{CONFIG, CandidWrapper, NODE_PRINCIPAL_INDEX, NODES};
use candid::Principal;
use gpt_types::{
    api::{
        HeartbeatRequest, HeartbeatResponse, HeartbeatResult, NodeHeartbeatCommand,
        UnregisterNodeRequest, UnregisterNodeResponse, UnregisterNodeResult,
    },
    domain::{
        common::NodeId,
        node::{MeasurementStatus, NodeLifecycleStatus},
    },
    error::{CanisterError, CanisterResult},
};
use hex;
use ic_cdk::api;
use ic_cdk_macros::update;

/// Completely resets a node's session state, clearing all ephemeral data
/// and marking it as Inactive. This leaves configuration (ID, hostname, API key) intact.
pub fn deactivate_node_internal(node_id: NodeId) -> CanisterResult<()> {
    NODES.with(|nodes| {
        let mut nodes_mut = nodes.borrow_mut();

        if let Some(wrapper) = nodes_mut.get(&node_id) {
            let mut node = wrapper.0;

            // Only perform cleanup if we haven't already to save write cycles,
            // unless we need to enforce a clean slate.
            if node.lifecycle_status != NodeLifecycleStatus::Inactive
                || node.node_principal.is_some()
            {
                ic_cdk::println!(
                    "Deactivating node {} and scrubbing session data...",
                    node_id
                );
                let principal_to_remove = node.node_principal;

                // 1. Reset Status
                node.lifecycle_status = NodeLifecycleStatus::Inactive;

                // 2. Clear Identity & Session
                node.node_principal = None;
                node.public_key = None;
                node.authenticated_measurement = None;

                // 3. Clear Telemetry & Attestation Evidence
                node.attestation_verified_at = None;
                node.last_heartbeat_timestamp = None;
                node.reported_measurement = None;
                node.reported_chip_id = None;
                node.reported_tcb = None;
                node.reported_platform_info = None;
                node.detected_generation = None;

                // 4. Persist
                nodes_mut.insert(node_id, CandidWrapper(node));

                // 5. Clean Heap Index
                if let Some(principal) = principal_to_remove {
                    NODE_PRINCIPAL_INDEX.with(|index| {
                        if index.borrow_mut().remove(&principal).is_some() {
                            ic_cdk::println!(
                                "Removed principal {} from NODE_PRINCIPAL_INDEX.",
                                principal
                            );
                        }
                    });
                }
                Ok(())
            } else {
                ic_cdk::println!("Node {} is already inactive and clean.", node_id);
                Ok(())
            }
        } else {
            Err(CanisterError::NodeNotFound)
        }
    })
}

#[update]
pub fn unregister_node(_req: UnregisterNodeRequest) -> UnregisterNodeResult {
    let node_principal = ic_cdk::api::msg_caller();
    if node_principal == Principal::anonymous() {
        return Err(CanisterError::Unauthorized);
    }

    let node_id_opt =
        NODE_PRINCIPAL_INDEX.with(|index| index.borrow().get(&node_principal).cloned());

    match node_id_opt {
        Some(node_id) => deactivate_node_internal(node_id).map(|_| UnregisterNodeResponse {}),
        None => {
            // Edge case: Node might be in stable storage but index was lost or out of sync?
            // Unlikely with current logic, but safe to reject.
            Err(CanisterError::NodeNotFound)
        }
    }
}

#[update]
pub fn heartbeat(_req: HeartbeatRequest) -> HeartbeatResult {
    let node_principal = ic_cdk::api::msg_caller();
    let current_time = api::time();

    if node_principal == Principal::anonymous() {
        return Err(CanisterError::Unauthorized);
    }

    let node_id = match NODE_PRINCIPAL_INDEX.with(|idx| idx.borrow().get(&node_principal).cloned())
    {
        Some(id) => id,
        None => return Err(CanisterError::Unauthorized),
    };

    // Retrieve measurements from config
    let measurements = CONFIG
        .with(|c| {
            c.borrow()
                .get()
                .0
                .attestation_requirements
                .clone()
                .map(|r| r.measurements)
        })
        .unwrap_or_default();

    NODES.with(|nodes| {
        let mut nodes_mut = nodes.borrow_mut();

        if let Some(wrapper) = nodes_mut.get(&node_id) {
            let mut node = wrapper.0;

            // Security Check: Ensure the caller still owns this session
            if node.node_principal != Some(node_principal) {
                return Err(CanisterError::Unauthorized);
            }

            let command;
            let new_status;

            // 1. Verify Measurement Status against Registry
            if let Some(reported_bytes) = &node.reported_measurement {
                let reported_hex = hex::encode(reported_bytes);

                if let Some(config_m) = measurements
                    .iter()
                    .find(|m| m.measurement_hex == reported_hex)
                {
                    match config_m.status {
                        MeasurementStatus::Active => {
                            new_status = NodeLifecycleStatus::Active;
                            command = NodeHeartbeatCommand::Continue;
                        }
                        MeasurementStatus::Deprecated => {
                            new_status = NodeLifecycleStatus::Draining;
                            command = NodeHeartbeatCommand::DrainAndShutdown;
                        }
                        MeasurementStatus::Revoked => {
                            new_status = NodeLifecycleStatus::Inactive;
                            command = NodeHeartbeatCommand::Abort;
                        }
                    }
                } else {
                    // Measurement is unknown (removed from registry) -> Revoke immediately
                    ic_cdk::println!(
                        "Node {} heartbeat: Measurement {} not found in registry.",
                        node_id,
                        reported_hex
                    );
                    new_status = NodeLifecycleStatus::Inactive;
                    command = NodeHeartbeatCommand::Abort;
                }
            } else {
                // No measurement reported (should be impossible for active node) -> Revoke
                ic_cdk::println!("Node {} heartbeat: No measurement data found.", node_id);
                new_status = NodeLifecycleStatus::Inactive;
                command = NodeHeartbeatCommand::Abort;
            }

            // 2. Apply State Changes
            if new_status == NodeLifecycleStatus::Inactive {
                // If we are aborting, we perform a full cleanup immediately.
                // We can't call deactivate_node_internal here easily due to RefCell borrow rules (re-entrancy into NODES),
                // so we implement the cleanup logic inline for the current mutable borrow.

                node.lifecycle_status = NodeLifecycleStatus::Inactive;
                node.node_principal = None;
                node.public_key = None;
                node.authenticated_measurement = None;
                node.attestation_verified_at = None;
                node.last_heartbeat_timestamp = None;
                node.reported_measurement = None;
                node.reported_chip_id = None;
                node.reported_tcb = None;
                node.reported_platform_info = None;
                node.detected_generation = None;

                // Remove from heap index
                NODE_PRINCIPAL_INDEX.with(|idx| {
                    idx.borrow_mut().remove(&node_principal);
                });

                // Persist
                nodes_mut.insert(node_id, CandidWrapper(node));

                return Ok(HeartbeatResponse { command });
            }

            // For Active or Draining states, update heartbeat timestamp and status
            if node.lifecycle_status != new_status {
                node.lifecycle_status = new_status;
            }

            node.last_heartbeat_timestamp = Some(current_time);
            nodes_mut.insert(node_id, CandidWrapper(node));

            Ok(HeartbeatResponse { command })
        } else {
            Err(CanisterError::NodeNotFound)
        }
    })
}
