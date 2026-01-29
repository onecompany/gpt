use gpt_types::domain::Node;
use gpt_types::domain::node::{NodeLifecycleStatus, PublicNodeInfo};
use hex;

pub(super) fn map_to_public_node_info(node: &Node) -> PublicNodeInfo {
    PublicNodeInfo {
        node_id: node.node_id,
        owner: node.owner,
        node_principal: node.node_principal,
        hostname: node.hostname.clone(),
        model_id: node.model_id.clone(),
        is_active: node.lifecycle_status == NodeLifecycleStatus::Active,
        attestation_verified_at: node.attestation_verified_at,
        last_heartbeat_timestamp: node.last_heartbeat_timestamp,
        reported_measurement_hex: node.reported_measurement.as_ref().map(hex::encode),
        reported_chip_id_hex: node.reported_chip_id.as_ref().map(hex::encode),
        detected_generation: node.detected_generation.clone(),
        public_key: node.public_key.clone(),
    }
}
