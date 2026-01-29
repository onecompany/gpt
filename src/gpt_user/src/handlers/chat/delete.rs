use crate::helpers::message_helpers::is_chat_in_generation;
use crate::helpers::user_helpers::verify_owner;
use crate::storage::{CHAT_JOBS, CHATS, MESSAGES};
use candid::Principal;
use gpt_types::api::{DeleteChatRequest, DeleteChatResponse, DeleteChatResult};
use gpt_types::error::{CanisterError, CanisterResult};
use ic_cdk_macros::update;

#[update]
pub fn delete_chat(req: DeleteChatRequest) -> DeleteChatResult {
    ic_cdk::println!("delete_chat called with request: {:?}", req);

    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    match is_chat_in_generation(req.chat_id) {
        Ok(true) => return Err(CanisterError::GenerationInProgress),
        Ok(false) => {}
        Err(e) => return Err(e),
    }

    delete_chat_internal(caller, req.chat_id)?;
    ic_cdk::println!("Successfully deleted chat ID: {}", req.chat_id);
    Ok(DeleteChatResponse)
}

pub fn delete_chat_internal(user: Principal, chat_id: u64) -> CanisterResult<()> {
    // Get the chat first
    let chat_opt = CHATS.with(|c| {
        let chats = c.borrow();
        chats.get(&chat_id).map(|w| w.0.clone())
    });

    let chat = match chat_opt {
        Some(c) if c.owner == user => c,
        Some(_) => return Err(CanisterError::Unauthorized),
        None => return Err(CanisterError::ChatNotFound),
    };

    // Remove the chat
    CHATS.with(|c| {
        c.borrow_mut().remove(&chat_id);
    });

    // Remove associated messages
    MESSAGES.with(|m| {
        let mut msgs = m.borrow_mut();
        for msg_id in &chat.message_ids {
            msgs.remove(msg_id);
        }
    });

    // Remove associated jobs
    CHAT_JOBS.with(|cj| {
        let mut jobs = cj.borrow_mut();
        for job_id in &chat.job_ids {
            jobs.remove(job_id);
        }
    });

    // No CHATS_INDEX to update - single user canister

    Ok(())
}
