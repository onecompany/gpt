use crate::helpers::node_helpers::ensure_no_conflict_incomplete;
use crate::helpers::user_helpers::verify_node_by_caller;
use crate::storage::{CHATS, MESSAGES};
use gpt_types::api::{NodeGetMessageRequest, NodeGetMessageResponse, NodeGetMessageResult};
use gpt_types::error::CanisterError;
use ic_cdk_macros::query;

#[query(name = "node_get_message")]
pub fn node_get_message(req: NodeGetMessageRequest) -> NodeGetMessageResult {
    ic_cdk::println!("node_get_message called with request: {:?}", req);
    let node = verify_node_by_caller()?;
    let node_id = node.node_id;

    // Get message from stable storage
    let msg = MESSAGES
        .with(|m| m.borrow().get(&req.message_id).map(|w| w.0.clone()))
        .ok_or(CanisterError::MessageNotFound)?;

    // Get chat from stable storage
    let chat = CHATS
        .with(|c| c.borrow().get(&msg.chat_id).map(|w| w.0.clone()))
        .ok_or(CanisterError::ChatNotFound)?;

    ensure_no_conflict_incomplete(&chat, node_id)?;

    Ok(NodeGetMessageResponse { message: msg })
}
