use crate::storage::NODES;
use gpt_types::api::{GptUserGetNodesResponse, GptUserGetNodesResult};
use gpt_types::domain::node::LocalNode;
use ic_cdk_macros::query;

#[query]
pub fn get_nodes() -> GptUserGetNodesResult {
    ic_cdk::println!("get_nodes called (gpt_user)");

    // Collect all nodes from stable storage
    let nodes_vec: Vec<LocalNode> = NODES.with(|n| {
        let nodes_map = n.borrow();
        let mut result = Vec::new();
        for entry in nodes_map.iter() {
            result.push(entry.value().0.clone());
        }
        result
    });

    ic_cdk::println!(
        "Returning get_nodes response with {} nodes",
        nodes_vec.len()
    );
    Ok(GptUserGetNodesResponse { nodes: nodes_vec })
}
