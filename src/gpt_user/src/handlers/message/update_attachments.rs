use crate::helpers::user_helpers::verify_owner;
use crate::helpers::message_helpers::{
    find_model_id_for_message, is_chat_in_generation, validate_attachments,
};
use crate::storage::{CandidWrapper, CHATS, MESSAGES};
use gpt_types::{
    api::{
        UpdateMessageAttachmentsRequest, UpdateMessageAttachmentsResponse,
        UpdateMessageAttachmentsResult,
    },
    domain::Role,
    error::CanisterError,
};
use ic_cdk::api;
use ic_cdk_macros::update;

#[update]
pub fn update_message_attachments(
    req: UpdateMessageAttachmentsRequest,
) -> UpdateMessageAttachmentsResult {
    ic_cdk::println!("update_message_attachments called with: {:?}", req);
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    // Get message and validate
    let (chat_id, model_id) = MESSAGES.with(|m| {
        let msgs = m.borrow();
        let msg_wrapper = msgs.get(&req.message_id).ok_or(CanisterError::MessageNotFound)?;
        let msg = &msg_wrapper.0;

        if msg.role != Role::User {
            return Err(CanisterError::InvalidInput(
                "Attachments can only be modified on 'User' role messages.".to_string(),
            ));
        }

        // Verify chat ownership
        let chat_opt = CHATS.with(|c| c.borrow().get(&msg.chat_id).map(|w| w.0.clone()));
        let chat = chat_opt.ok_or(CanisterError::ChatNotFound)?;

        if chat.owner != caller {
            return Err(CanisterError::Unauthorized);
        }

        let model_id = find_model_id_for_message(msg)?;
        Ok((msg.chat_id, model_id))
    })?;

    validate_attachments(&req.attachments, &model_id)?;

    if let Ok(in_gen) = is_chat_in_generation(chat_id) {
        if in_gen {
            return Err(CanisterError::GenerationInProgress);
        }
    }

    let timestamp = api::time();

    // Update message
    MESSAGES.with(|m| {
        let mut msgs = m.borrow_mut();
        if let Some(msg_wrapper) = msgs.get(&req.message_id) {
            let mut msg = msg_wrapper.0.clone();
            msg.attachments = req.attachments;
            msg.updated_at = timestamp;
            msgs.insert(req.message_id, CandidWrapper(msg));
        }
    });

    // Update chat timestamp
    CHATS.with(|c| {
        let mut chats = c.borrow_mut();
        if let Some(chat_wrapper) = chats.get(&chat_id) {
            let mut chat = chat_wrapper.0.clone();
            chat.updated_at = timestamp;
            chats.insert(chat_id, CandidWrapper(chat));
        }
    });

    Ok(UpdateMessageAttachmentsResponse)
}
