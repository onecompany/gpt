use crate::helpers::user_helpers::verify_owner;
use crate::storage::{CandidWrapper, CHATS, MESSAGES};
use gpt_types::{
    api::{StoreToolResultsRequest, StoreToolResultsResponse, StoreToolResultsResult},
    domain::Role,
    error::{CanisterError, CanisterResult},
};
use ic_cdk::api;
use ic_cdk_macros::update;

#[update]
pub fn store_tool_results(req: StoreToolResultsRequest) -> StoreToolResultsResult {
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    // Verify chat ownership
    let chat_opt = CHATS.with(|c| c.borrow().get(&req.chat_id).map(|w| w.0.clone()));
    let chat = chat_opt.ok_or(CanisterError::ChatNotFound)?;

    if chat.owner != caller {
        return Err(CanisterError::Unauthorized);
    }

    // Get and update the message
    let update_res: CanisterResult<()> = MESSAGES.with(|m_ref| {
        let mut messages = m_ref.borrow_mut();
        let msg_wrapper = messages
            .get(&req.assistant_message_id)
            .ok_or(CanisterError::MessageNotFound)?;
        let mut msg = msg_wrapper.0.clone();

        if msg.role != Role::Assistant {
            return Err(CanisterError::InvalidInput(
                "Can only store results on an assistant message.".into(),
            ));
        }
        if msg.chat_id != req.chat_id {
            return Err(CanisterError::InvalidInput(
                "Message not in specified chat.".into(),
            ));
        }

        msg.tool_results = Some(req.results);
        msg.requires_client_action = false;
        msg.updated_at = api::time();

        messages.insert(req.assistant_message_id, CandidWrapper(msg));
        Ok(())
    });

    update_res?;
    Ok(StoreToolResultsResponse)
}
