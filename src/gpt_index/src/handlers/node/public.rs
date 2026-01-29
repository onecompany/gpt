use crate::storage::NODES;
use gpt_types::{
    api::{GetProvisioningInfoRequest, GetProvisioningInfoResponse, GetProvisioningInfoResult},
    domain::node::NodeLifecycleStatus,
    error::CanisterError,
};
use ic_cdk_macros::query;

#[query]
pub fn get_provisioning_info(req: GetProvisioningInfoRequest) -> GetProvisioningInfoResult {
    NODES.with(|nodes| {
        let nodes_map = nodes.borrow();
        let wrapper = nodes_map
            .get(&req.node_id)
            .ok_or(CanisterError::NodeNotFound)?;
        let node = &wrapper.0;

        Ok(GetProvisioningInfoResponse {
            hostname: node.hostname.clone(),
            model_id: node.model_id.clone(),
            owner: node.owner,
            // Map Lifecycle status to simple boolean for legacy router compatibility
            is_active: node.lifecycle_status == NodeLifecycleStatus::Active,
        })
    })
}
