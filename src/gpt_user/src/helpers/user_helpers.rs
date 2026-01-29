use crate::storage::{NODES, get_owner};
use candid::Principal;
use gpt_types::{
    domain::LocalNode,
    error::{CanisterError, CanisterResult},
};

/// Verifies the caller is the single bound owner of this canister.
/// This is the primary authentication check for all user operations.
pub fn verify_owner(caller: Principal) -> CanisterResult<()> {
    let owner = get_owner();

    match owner {
        Some(o) if o == caller => Ok(()),
        Some(_) => {
            ic_cdk::println!("Unauthorized: caller {} is not the owner", caller);
            Err(CanisterError::Unauthorized)
        }
        None => {
            ic_cdk::println!("Canister not yet bound to any user");
            Err(CanisterError::UserNotFound)
        }
    }
}

/// Verifies a node by its caller principal.
/// Returns the LocalNode if found.
pub fn verify_node_by_caller() -> CanisterResult<LocalNode> {
    let caller = ic_cdk::api::msg_caller();
    NODES
        .with(|n| {
            let nodes_map = n.borrow();
            for entry in nodes_map.iter() {
                let node = entry.value().0.clone();
                if node.node_principal == Some(caller) {
                    return Some(node);
                }
            }
            None
        })
        .ok_or_else(|| {
            ic_cdk::println!("Node not found for caller principal {}", caller);
            CanisterError::NodeNotFound
        })
}
