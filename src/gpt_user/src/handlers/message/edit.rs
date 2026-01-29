use crate::helpers::user_helpers::verify_owner;
use crate::helpers::generation_helpers::{
    GenerationParams, create_generation_entities, validate_generation_request,
};
use crate::helpers::message_helpers::validate_attachments;
use crate::storage::{
    get_next_message_id, CandidWrapper, CHAT_JOBS, CHATS, MESSAGES,
};
use gpt_types::{
    api::{EditUserMessageRequest, EditUserMessageResponse, EditUserMessageResult},
    domain::{Message, Role},
    error::CanisterError,
};
use ic_cdk::api;
use ic_cdk_macros::update;

#[update]
pub fn edit_user_message(req: EditUserMessageRequest) -> EditUserMessageResult {
    ic_cdk::println!("edit_user_message called");
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    if req.new_content.is_empty() && req.attachments.is_none() {
        return Err(CanisterError::InvalidInput(
            "Cannot edit message to have no content and no attachments.".to_string(),
        ));
    }
    validate_attachments(&req.attachments, &req.model_id)?;

    // Verify chat ownership
    let chat_opt = CHATS.with(|c| c.borrow().get(&req.chat_id).map(|w| w.0.clone()));
    let chat = chat_opt.ok_or(CanisterError::ChatNotFound)?;

    if chat.owner != caller {
        return Err(CanisterError::Unauthorized);
    }

    // Get old user message
    let old_user_msg = MESSAGES
        .with(|m| m.borrow().get(&req.old_user_message_id).map(|w| w.0.clone()))
        .ok_or(CanisterError::MessageNotFound)?;

    if old_user_msg.role != Role::User {
        return Err(CanisterError::InvalidInput(
            "Cannot edit a non-user message.".to_string(),
        ));
    }
    if old_user_msg.chat_id != req.chat_id {
        return Err(CanisterError::InvalidInput(
            "User message does not belong to the specified chat.".to_string(),
        ));
    }

    validate_generation_request(
        req.chat_id,
        req.node_id,
        &req.model_id,
        &req.tools,
        req.custom_prompt.as_ref(),
    )?;

    let timestamp = api::time();
    let new_user_id = get_next_message_id();
    let new_user_msg = Message {
        message_id: new_user_id,
        chat_id: req.chat_id,
        parent_message_id: old_user_msg.parent_message_id,
        role: Role::User,
        content: req.new_content.clone(),
        created_at: timestamp,
        updated_at: timestamp,
        error_status: None,
        attachments: req.attachments,
        tool_calls: None,
        tool_results: None,
        tool_call_id: None,
        requires_client_action: false,
        usage: None,
    };

    let gen_params = GenerationParams {
        chat_id: req.chat_id,
        user_message_id: new_user_id,
        node_id: req.node_id,
        model_id: &req.model_id,
        temperature: req.temperature,
        max_completion_tokens: req.max_completion_tokens,
        max_context: req.max_context,
        custom_prompt: req.custom_prompt.clone(),
        tools: req.tools.clone(),
        reasoning_effort: req.reasoning_effort,
        encrypted_chat_key: req.encrypted_chat_key,
    };
    let (ai_msg, job) = create_generation_entities(gen_params, timestamp);

    MESSAGES.with(|m| {
        let mut msgs = m.borrow_mut();
        msgs.remove(&req.old_user_message_id);
        msgs.insert(new_user_id, CandidWrapper(new_user_msg.clone()));
        msgs.insert(ai_msg.message_id, CandidWrapper(ai_msg.clone()));
    });

    CHAT_JOBS.with(|cj| {
        cj.borrow_mut().insert(job.job_id, CandidWrapper(job.clone()));
    });

    CHATS.with(|c| {
        let mut chats = c.borrow_mut();
        if let Some(chat_wrapper) = chats.get(&req.chat_id) {
            let mut chat = chat_wrapper.0.clone();
            if let Some(pos) = chat
                .message_ids
                .iter()
                .position(|&id| id == req.old_user_message_id)
            {
                chat.message_ids.remove(pos);
            }
            chat.message_ids.push(new_user_id);
            chat.message_ids.push(ai_msg.message_id);
            chat.job_ids.push(job.job_id);
            chat.active_job_id = Some(job.job_id);
            chat.updated_at = timestamp;
            chats.insert(req.chat_id, CandidWrapper(chat));
        }
    });

    Ok(EditUserMessageResponse {
        new_user_message: new_user_msg,
        new_ai_message: ai_msg,
        job,
    })
}
