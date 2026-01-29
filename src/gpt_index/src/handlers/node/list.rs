use crate::storage::{NODE_OWNER_INDEX, NODES};
use gpt_types::{
    api::{
        ListActiveNodesRequest, ListActiveNodesResponse, ListActiveNodesResult, ListMyNodesRequest,
        ListMyNodesResponse, ListMyNodesResult,
    },
    domain::node::{NodeLifecycleStatus, PublicNodeInfo},
};
use ic_cdk_macros::query;

use super::utils::map_to_public_node_info;

#[query]
pub fn list_my_nodes(_req: ListMyNodesRequest) -> ListMyNodesResult {
    let caller = ic_cdk::api::msg_caller();
    ic_cdk::println!("list_my_nodes called by: {}", caller);

    let my_node_ids =
        NODE_OWNER_INDEX.with(|index| index.borrow().get(&caller).cloned().unwrap_or_default());

    if my_node_ids.is_empty() {
        return Ok(ListMyNodesResponse { nodes: vec![] });
    }

    let my_nodes_info = NODES.with(|nodes_map_ref| {
        let nodes_map = nodes_map_ref.borrow();
        my_node_ids
            .iter()
            .filter_map(|node_id| {
                nodes_map
                    .get(node_id)
                    .map(|wrapper| map_to_public_node_info(&wrapper.0))
            })
            .collect::<Vec<PublicNodeInfo>>()
    });

    Ok(ListMyNodesResponse {
        nodes: my_nodes_info,
    })
}

#[query]
pub fn list_active_nodes(_req: ListActiveNodesRequest) -> ListActiveNodesResult {
    // Only return nodes that are fully Active.
    // Draining nodes are excluded so new jobs are not routed to them.
    let active_nodes_info = NODES.with(|nodes_map_ref| {
        nodes_map_ref
            .borrow()
            .iter()
            .map(|(_, wrapper)| wrapper.0)
            .filter(|node| {
                node.lifecycle_status == NodeLifecycleStatus::Active
                    && node.node_principal.is_some()
            })
            .map(|node| map_to_public_node_info(&node))
            .collect::<Vec<PublicNodeInfo>>()
    });

    Ok(ListActiveNodesResponse {
        nodes: active_nodes_info,
    })
}
