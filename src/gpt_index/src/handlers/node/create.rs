use crate::storage::{
    CONFIG, CandidWrapper, MODELS, NODE_OWNER_INDEX, NODES, StorablePrincipal, USERS,
};
use gpt_types::{
    api::{CreateIndexNodeRequest, CreateIndexNodeResponse, CreateIndexNodeResult},
    domain::node::NodeLifecycleStatus,
    domain::{ModelStatus, Node},
    error::{CanisterError, CanisterResult},
};
use hex;
use ic_cdk_macros::update;
use std::collections::BTreeSet;

use super::attestation::CHIP_ID_HEX_LENGTH;

#[update]
pub fn create_node(req: CreateIndexNodeRequest) -> CreateIndexNodeResult {
    let owner_principal = ic_cdk::api::msg_caller();

    let is_registered = USERS.with(|users| {
        users
            .borrow()
            .contains_key(&StorablePrincipal(owner_principal))
    });
    if !is_registered {
        return Err(CanisterError::Unauthorized);
    }

    if CONFIG.with(|c| {
        let cell_ref = c.borrow();
        let wrapper = cell_ref.get();
        if let Some(reqs) = &wrapper.0.attestation_requirements {
            reqs.measurements.is_empty()
        } else {
            true
        }
    }) {
        return Err(CanisterError::Other(
            "Attestation measurements have not been configured.".to_string(),
        ));
    }

    if req.hostname.trim().is_empty() {
        return Err(CanisterError::InvalidInput(
            "Hostname cannot be empty.".to_string(),
        ));
    }

    let model_check: CanisterResult<()> = MODELS.with(|models| {
        let m = models.borrow();
        let wrapper = m.get(&req.model_id).ok_or(CanisterError::ModelNotFound)?;
        if wrapper.0.status == ModelStatus::Paused {
            return Err(CanisterError::InvalidInput("Model is paused.".to_string()));
        }
        Ok(())
    });
    model_check?;

    let expected_chip_id_trimmed = req.expected_chip_id.trim().to_lowercase();
    if expected_chip_id_trimmed.len() != CHIP_ID_HEX_LENGTH {
        return Err(CanisterError::InvalidInput(format!(
            "Chip ID must be {} chars.",
            CHIP_ID_HEX_LENGTH
        )));
    }
    if hex::decode(&expected_chip_id_trimmed).is_err() {
        return Err(CanisterError::InvalidInput(
            "Invalid Chip ID hex.".to_string(),
        ));
    }

    let node_id = CONFIG.with(|c| {
        let mut cell_ref = c.borrow_mut();
        let mut wrapper = cell_ref.get().clone();
        let id = wrapper.0.next_node_id;
        wrapper.0.next_node_id += 1;
        cell_ref.set(wrapper).expect("Failed to update node id");
        id
    });

    let node = Node {
        node_id,
        owner: owner_principal,
        node_principal: None,
        hostname: req.hostname.trim().to_string(),
        model_id: req.model_id.clone(),
        encrypted_api_key: req.encrypted_api_key.clone(),

        // Initial state is Inactive until registration
        lifecycle_status: NodeLifecycleStatus::Inactive,
        authenticated_measurement: None,

        attestation_verified_at: None,
        last_heartbeat_timestamp: None,
        expected_chip_id: expected_chip_id_trimmed,
        reported_measurement: None,
        reported_chip_id: None,
        reported_tcb: None,
        reported_platform_info: None,
        detected_generation: None,
        public_key: None,
    };

    NODES.with(|nodes| {
        nodes.borrow_mut().insert(node_id, CandidWrapper(node));
    });

    NODE_OWNER_INDEX.with(|index| {
        index
            .borrow_mut()
            .entry(owner_principal)
            .or_insert_with(BTreeSet::new)
            .insert(node_id);
    });

    Ok(CreateIndexNodeResponse { node_id })
}
