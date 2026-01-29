use crate::storage::NODES;
use candid::Principal;
use gpt_types::{
    api::{GetNodeConfigRequest, GetNodeConfigResponse, GetNodeConfigResult},
    domain::node::NodeLifecycleStatus,
    error::CanisterError,
};
use ic_cdk_macros::query;

#[query]
pub fn get_node_config(req: GetNodeConfigRequest) -> GetNodeConfigResult {
    let node_principal = ic_cdk::api::msg_caller();

    if node_principal == Principal::anonymous() {
        return Err(CanisterError::Unauthorized);
    }

    let node_opt = NODES.with(|nodes| nodes.borrow().get(&req.node_id).map(|w| w.0.clone()));

    match node_opt {
        Some(node) => {
            // Allow access if node is Active or Draining (so it can still get config during drain if needed)
            if node.lifecycle_status == NodeLifecycleStatus::Inactive
                || node.node_principal != Some(node_principal)
            {
                Err(CanisterError::Unauthorized)
            } else {
                Ok(GetNodeConfigResponse {
                    hostname: node.hostname,
                    model_id: node.model_id,
                    encrypted_api_key: node.encrypted_api_key,
                })
            }
        }
        None => Err(CanisterError::NodeNotFound),
    }
}
