use crate::helpers::user_helpers::verify_owner;
use crate::helpers::generation_helpers::{
    GenerationParams, create_generation_entities, validate_generation_request,
};
use crate::storage::{CandidWrapper, CHAT_JOBS, CHATS, MESSAGES};
use gpt_types::{
    api::{RetryAiMessageRequest, RetryAiMessageResponse, RetryAiMessageResult},
    domain::Role,
    error::CanisterError,
};
use ic_cdk::api;
use ic_cdk_macros::update;

#[update]
pub fn retry_ai_message(req: RetryAiMessageRequest) -> RetryAiMessageResult {
    ic_cdk::println!("retry_ai_message called");
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    // Verify chat ownership
    let chat_opt = CHATS.with(|c| c.borrow().get(&req.chat_id).map(|w| w.0.clone()));
    let chat = chat_opt.ok_or(CanisterError::ChatNotFound)?;

    if chat.owner != caller {
        return Err(CanisterError::Unauthorized);
    }

    // Get user message
    let user_msg = MESSAGES
        .with(|m| m.borrow().get(&req.user_message_id).map(|w| w.0.clone()))
        .ok_or(CanisterError::MessageNotFound)?;

    if user_msg.role != Role::User {
        return Err(CanisterError::InvalidInput(
            "retry_ai_message requires a user message as parent".to_string(),
        ));
    }
    if user_msg.chat_id != req.chat_id {
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
    let gen_params = GenerationParams {
        chat_id: req.chat_id,
        user_message_id: req.user_message_id,
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
        m.borrow_mut().insert(ai_msg.message_id, CandidWrapper(ai_msg.clone()));
    });

    CHAT_JOBS.with(|cj| {
        cj.borrow_mut().insert(job.job_id, CandidWrapper(job.clone()));
    });

    CHATS.with(|c| {
        let mut chats = c.borrow_mut();
        if let Some(chat_wrapper) = chats.get(&req.chat_id) {
            let mut chat = chat_wrapper.0.clone();
            chat.message_ids.push(ai_msg.message_id);
            chat.job_ids.push(job.job_id);
            chat.active_job_id = Some(job.job_id);
            chat.updated_at = timestamp;
            chats.insert(req.chat_id, CandidWrapper(chat));
        }
    });

    Ok(RetryAiMessageResponse {
        new_ai_message: ai_msg,
        job,
    })
}
