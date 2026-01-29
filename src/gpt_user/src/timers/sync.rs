use crate::storage::{get_parent_canister, CandidWrapper, StorableString, MODELS, NODES};
use gpt_types::{
    api::{GetModelsRequest, GetModelsResponse, ListActiveNodesRequest, ListActiveNodesResponse},
    domain::LocalNode,
    error::CanisterResult,
};
use ic_cdk::call::Call;
use std::collections::HashSet;

pub async fn sync_nodes_with_index() {
    ic_cdk::println!("[TASK] Starting: Sync active nodes with index canister...");

    let index_id = match get_parent_canister() {
        Some(id) => id,
        None => {
            ic_cdk::println!("[TASK] SKIPPING: No parent canister set.");
            return;
        }
    };

    let call_result = Call::unbounded_wait(index_id, "list_active_nodes")
        .with_arg(&ListActiveNodesRequest {})
        .await;

    match call_result {
        Ok(response) => match response.candid::<CanisterResult<ListActiveNodesResponse>>() {
            Ok(Ok(active_nodes_response)) => {
                let active_node_infos = active_nodes_response.nodes;
                ic_cdk::println!(
                    "[TASK] Success: Received {} active node infos from index.",
                    active_node_infos.len()
                );

                NODES.with(|n_ref| {
                    let mut nodes_map = n_ref.borrow_mut();

                    // Collect received active IDs
                    let received_active_ids: HashSet<u64> =
                        active_node_infos.iter().map(|info| info.node_id).collect();

                    // Update or insert nodes
                    for public_info in active_node_infos {
                        if public_info.node_principal.is_some() {
                            let local_node = LocalNode {
                                node_id: public_info.node_id,
                                node_principal: public_info.node_principal,
                                address: public_info.hostname,
                                model_id: public_info.model_id,
                                public_key: public_info.public_key,
                            };
                            nodes_map.insert(local_node.node_id, CandidWrapper(local_node));
                        }
                    }

                    // Remove nodes that are no longer active
                    // Collect keys to remove first (can't mutate while iterating)
                    let keys_to_remove: Vec<u64> = {
                        let mut keys = Vec::new();
                        for entry in nodes_map.iter() {
                            let key = *entry.key();
                            if !received_active_ids.contains(&key) {
                                keys.push(key);
                            }
                        }
                        keys
                    };

                    for key in keys_to_remove {
                        nodes_map.remove(&key);
                    }

                    ic_cdk::println!(
                        "[TASK] Completed: Local NODES storage now contains {} active nodes.",
                        nodes_map.len()
                    );
                });
            }
            Ok(Err(canister_err)) => {
                ic_cdk::println!(
                    "[TASK] ERROR: Index canister returned an error for list_active_nodes: {:?}",
                    canister_err
                );
            }
            Err(decode_err) => {
                ic_cdk::println!(
                    "[TASK] ERROR: Failed to decode response from index canister for list_active_nodes: {:?}",
                    decode_err
                );
            }
        },
        Err(e) => {
            ic_cdk::println!("[TASK] ERROR: Call to list_active_nodes failed: {}", e);
        }
    }
}

pub async fn sync_models_with_index() {
    ic_cdk::println!("[TASK] Starting: Sync models with index canister...");

    let index_id = match get_parent_canister() {
        Some(id) => id,
        None => {
            ic_cdk::println!("[TASK] SKIPPING: No parent canister set.");
            return;
        }
    };

    let call_result = Call::unbounded_wait(index_id, "get_models")
        .with_arg(&GetModelsRequest {})
        .await;

    match call_result {
        Ok(response) => match response.candid::<GetModelsResponse>() {
            Ok(get_models_response) => {
                ic_cdk::println!(
                    "[TASK] Success: Received {} models from index.",
                    get_models_response.models.len()
                );

                MODELS.with(|m_ref| {
                    let mut models_map = m_ref.borrow_mut();

                    // Clear existing models by collecting all keys and removing them
                    let existing_keys: Vec<StorableString> = {
                        let mut keys = Vec::new();
                        for entry in models_map.iter() {
                            keys.push(entry.key().clone());
                        }
                        keys
                    };
                    for key in existing_keys {
                        models_map.remove(&key);
                    }

                    // Insert new models
                    for model in get_models_response.models {
                        models_map.insert(
                            StorableString(model.model_id.clone()),
                            CandidWrapper(model),
                        );
                    }

                    ic_cdk::println!(
                        "[TASK] Completed: Local MODELS cache now contains {} models.",
                        models_map.len()
                    );
                });
            }
            Err(decode_err) => {
                ic_cdk::println!(
                    "[TASK] ERROR: Failed to decode response from index canister for get_models: {:?}",
                    decode_err
                );
            }
        },
        Err(e) => {
            ic_cdk::println!("[TASK] ERROR: Call to get_models failed: {}", e);
        }
    }
}
