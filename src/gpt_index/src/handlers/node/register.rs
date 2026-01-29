use crate::handlers::node::lifecycle::deactivate_node_internal;
use crate::storage::{CONFIG, CandidWrapper, NODE_PRINCIPAL_INDEX, NODES};
use candid::Principal;
use gpt_types::{
    api::{RegisterNodeRequest, RegisterNodeResponse, RegisterNodeResult},
    domain::node::{MeasurementStatus, NodeLifecycleStatus},
    error::{CanisterError, CanisterResult},
};
use ic_cdk::api;
use ic_cdk_macros::update;
use sev::certs::snp::Certificate;
use sev::firmware::guest::AttestationReport;
use sev::parser::ByteParser;
use sha2::{Digest, Sha256};

use super::attestation::verify_attestation_evidence;
use hex;

#[update]
pub fn register_node(req: RegisterNodeRequest) -> RegisterNodeResult {
    let node_principal = ic_cdk::api::msg_caller();
    let current_time_ns = api::time();
    ic_cdk::println!(
        "register_node called by node principal: {} for node_id: {}",
        node_principal,
        req.node_id
    );

    if node_principal == Principal::anonymous() {
        return Err(CanisterError::Unauthorized);
    }

    // 1. Enforce Principal Uniqueness: Check if this principal is already active on another node.
    // If so, we must deactivate the old session to prevent "Zombie" nodes.
    let existing_node_id =
        NODE_PRINCIPAL_INDEX.with(|idx| idx.borrow().get(&node_principal).cloned());

    if let Some(old_id) = existing_node_id.filter(|&id| id != req.node_id) {
        ic_cdk::println!(
            "Principal {} is already registered to node {}. Deactivating old session before registering node {}.",
            node_principal,
            old_id,
            req.node_id
        );
        // We can safely call this because we haven't borrowed NODES mutably yet in this scope
        let _ = deactivate_node_internal(old_id);
    }

    if req.public_key.trim().is_empty() {
        return Err(CanisterError::InvalidInput(
            "Node public key is required for registration.".to_string(),
        ));
    }

    // 2. Fetch and Validate Requirements
    let requirements_res = CONFIG.with(|c| {
        let cell_ref = c.borrow();
        let wrapper = cell_ref.get();
        if let Some(reqs) = &wrapper.0.attestation_requirements {
            Ok(reqs.clone())
        } else {
            Err(CanisterError::Other(
                "Index canister attestation requirements not configured".to_string(),
            ))
        }
    });

    let requirements = requirements_res?;

    if requirements.measurements.is_empty() {
        return Err(CanisterError::Other(
            "No active attestation measurements configured. Registration is disabled.".to_string(),
        ));
    }

    // 3. Replay Protection
    let time_diff = current_time_ns.abs_diff(req.timestamp);

    if time_diff > requirements.max_attestation_age_ns {
        return Err(CanisterError::InvalidInput(format!(
            "Attestation timestamp too old or in future. Diff: {}ns, Max: {}ns",
            time_diff, requirements.max_attestation_age_ns
        )));
    }

    // 4. Check Target Node Status
    // We don't want to overwrite an active session unless it's the same principal re-registering (e.g. restart)
    let can_register = NODES.with(|nodes| {
        nodes.borrow().get(&req.node_id).is_some_and(|wrapper| {
            // Allow if inactive OR if active but owned by same principal (restart scenario)
            wrapper.0.lifecycle_status == NodeLifecycleStatus::Inactive
                || wrapper.0.node_principal == Some(node_principal)
        })
    });

    if !can_register {
        // Node is active under a different principal
        return Err(CanisterError::Other(format!(
            "Node {} is currently active with a different controller.",
            req.node_id
        )));
    }

    // 5. Parse Attestation
    let ark = match Certificate::from_der(&req.ark_der) {
        Ok(c) => c,
        Err(e) => {
            return Err(CanisterError::InvalidInput(format!(
                "Failed to parse ARK DER: {}",
                e
            )));
        }
    };
    let ask = match Certificate::from_der(&req.ask_der) {
        Ok(c) => c,
        Err(e) => {
            return Err(CanisterError::InvalidInput(format!(
                "Failed to parse ASK DER: {}",
                e
            )));
        }
    };
    let vek = match Certificate::from_der(&req.vek_der) {
        Ok(c) => c,
        Err(e) => {
            return Err(CanisterError::InvalidInput(format!(
                "Failed to parse VEK DER: {}",
                e
            )));
        }
    };

    let report = match AttestationReport::from_bytes(&req.attestation_report) {
        Ok(r) => r,
        Err(e) => {
            return Err(CanisterError::InvalidInput(format!(
                "Failed to parse attestation report bytes: {}",
                e
            )));
        }
    };

    // 6. Verify Crypto & Policy
    let mut hasher = Sha256::new();
    hasher.update(node_principal.as_slice());
    hasher.update(req.timestamp.to_le_bytes());
    let expected_nonce_digest = hasher.finalize();
    let mut expected_report_data = [0u8; 64];
    expected_report_data[0..32].copy_from_slice(&expected_nonce_digest);

    let generation_str = match verify_attestation_evidence(
        &req.attestation_report,
        &report,
        &ark,
        &ask,
        &vek,
        &requirements,
        &expected_report_data,
    ) {
        Ok(generation) => generation,
        Err(e) => return Err(CanisterError::InvalidInput(e)),
    };

    // 7. Verify Registry Status
    let reported_hex = hex::encode(report.measurement);
    let valid_measurement = requirements
        .measurements
        .iter()
        .find(|m| m.measurement_hex == reported_hex);

    match valid_measurement {
        Some(m) => {
            if m.status != MeasurementStatus::Active {
                return Err(CanisterError::InvalidInput(format!(
                    "Measurement {} is {:?}. Registration rejected.",
                    reported_hex, m.status
                )));
            }
        }
        None => {
            return Err(CanisterError::InvalidInput(format!(
                "Measurement {} not found in allowed registry.",
                reported_hex
            )));
        }
    }

    // 8. Verify Hardware Binding (Chip ID)
    let reported_chip_id_bytes = report.chip_id.as_slice();
    let expected_chip_id_hex_res = NODES.with(|nodes| {
        nodes
            .borrow()
            .get(&req.node_id)
            .map(|n| n.0.expected_chip_id.clone())
            .ok_or(CanisterError::NodeNotFound)
    });

    let expected_chip_id_hex = expected_chip_id_hex_res?;

    let expected_chip_id_bytes = match hex::decode(&expected_chip_id_hex) {
        Ok(b) => b,
        Err(_) => {
            return Err(CanisterError::Other(
                "Internal error: Failed to decode expected_chip_id.".to_string(),
            ));
        }
    };

    if reported_chip_id_bytes != expected_chip_id_bytes.as_slice() {
        return Err(CanisterError::InvalidInput(
            "Chip ID mismatch between configuration and attestation report.".to_string(),
        ));
    }

    // 9. Persist Active Session
    let persist_res: CanisterResult<()> = NODES.with(|nodes| {
        let mut nodes_mut = nodes.borrow_mut();
        if let Some(wrapper) = nodes_mut.get(&req.node_id) {
            let mut node = wrapper.0;

            node.node_principal = Some(node_principal);
            node.lifecycle_status = NodeLifecycleStatus::Active;
            node.authenticated_measurement = Some(reported_hex);
            node.attestation_verified_at = Some(current_time_ns);
            node.last_heartbeat_timestamp = Some(current_time_ns);
            node.public_key = Some(req.public_key);

            node.reported_measurement = Some(report.measurement.to_vec());
            node.reported_chip_id = Some(report.chip_id.to_vec());

            let tcb = report.reported_tcb;
            node.reported_tcb = Some(gpt_types::domain::node::TcbVersion {
                bootloader: tcb.bootloader,
                tee: tcb.tee,
                snp: tcb.snp,
                microcode: tcb.microcode,
                fmc: tcb.fmc.unwrap_or(0),
            });

            node.reported_platform_info = Some(report.plat_info.0);
            node.detected_generation = Some(generation_str);

            nodes_mut.insert(req.node_id, CandidWrapper(node));

            NODE_PRINCIPAL_INDEX.with(|index| {
                index.borrow_mut().insert(node_principal, req.node_id);
            });

            ic_cdk::println!(
                "Successfully registered and activated node_id {} with principal {}.",
                req.node_id,
                node_principal
            );

            Ok(())
        } else {
            Err(CanisterError::NodeNotFound)
        }
    });

    persist_res?;

    Ok(RegisterNodeResponse { success: true })
}
