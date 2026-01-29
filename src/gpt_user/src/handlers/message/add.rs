use crate::helpers::user_helpers::verify_owner;
use crate::helpers::generation_helpers::{
    GenerationParams, create_generation_entities, validate_generation_request,
};
use crate::helpers::message_helpers::validate_attachments;
use crate::storage::{
    get_next_message_id, CandidWrapper, StorableString,
    CHAT_JOBS, CHATS, MESSAGES, MODELS,
};
use gpt_types::api::{AddMessageRequest, AddMessageResponse, AddMessageResult};
use gpt_types::domain::{Message, ModelStatus, Role};
use gpt_types::error::CanisterError;
use ic_cdk::api;
use ic_cdk_macros::update;

/// The public update method for a user to add a new message to a chat.
#[update]
pub fn add_message(req: AddMessageRequest) -> AddMessageResult {
    ic_cdk::println!("add_message called");
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    // Check Model Status and embedding-specific constraints
    MODELS.with(|models| {
        let m = models.borrow();
        let model = m.get(&StorableString(req.model_id.clone())).ok_or(CanisterError::ModelNotFound)?;
        if model.0.status == ModelStatus::Paused {
            return Err(CanisterError::InvalidInput(format!(
                "Model {} is currently paused.",
                req.model_id
            )));
        }
        // Embedding models have specific constraints
        if model.0.is_embedding {
            if req.attachments.is_some() {
                return Err(CanisterError::InvalidInput(
                    "Embedding models do not support attachments.".to_string(),
                ));
            }
            if req.reasoning_effort.is_some() {
                return Err(CanisterError::InvalidInput(
                    "Embedding models do not support reasoning_effort.".to_string(),
                ));
            }
        }
        Ok(())
    })?;

    // Validation
    if req.content.is_empty() && req.attachments.is_none() {
        return Err(CanisterError::InvalidInput(
            "Message content cannot be empty without attachments".to_string(),
        ));
    }
    validate_attachments(&req.attachments, &req.model_id)?;
    if req.attachments.is_some() && req.role != Role::User {
        return Err(CanisterError::InvalidInput(
            "Attachments are only allowed for User roles.".to_string(),
        ));
    }

    // Verify ownership of the chat
    let chat_opt = CHATS.with(|c| c.borrow().get(&req.chat_id).map(|w| w.0.clone()));
    let chat = chat_opt.ok_or(CanisterError::ChatNotFound)?;

    if chat.owner != caller {
        return Err(CanisterError::Unauthorized);
    }

    // Validate the parent message if one is provided
    if let Some(parent_id) = req.parent_message_id {
        let is_invalid = MESSAGES.with(|m| {
            let msgs = m.borrow();
            match msgs.get(&parent_id) {
                Some(p) => p.0.chat_id != req.chat_id,
                None => true,
            }
        });

        if is_invalid {
            return Err(CanisterError::InvalidInput(
                "Parent message not found or belongs to a different chat".to_string(),
            ));
        }
    }

    // Validate the generation request parameters
    validate_generation_request(
        req.chat_id,
        req.node_id,
        &req.model_id,
        &req.tools,
        req.custom_prompt.as_ref(),
    )?;

    let timestamp = api::time();

    // Create User Message
    let user_message_id = get_next_message_id();
    let user_msg = Message {
        message_id: user_message_id,
        chat_id: req.chat_id,
        parent_message_id: req.parent_message_id,
        role: req.role,
        content: req.content.clone(),
        created_at: timestamp,
        updated_at: timestamp,
        error_status: None,
        attachments: req.attachments.clone(),
        tool_calls: None,
        tool_results: None,
        tool_call_id: None,
        requires_client_action: false,
        usage: None,
    };

    // Create AI Message (Placeholder) and Job
    let gen_params = GenerationParams {
        chat_id: req.chat_id,
        user_message_id,
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

    // Store the new message, placeholder, and job
    MESSAGES.with(|m| {
        let mut msgs = m.borrow_mut();
        msgs.insert(user_message_id, CandidWrapper(user_msg.clone()));
        msgs.insert(ai_msg.message_id, CandidWrapper(ai_msg.clone()));
    });

    CHAT_JOBS.with(|cj| {
        cj.borrow_mut().insert(job.job_id, CandidWrapper(job.clone()));
    });

    // Update the parent chat to link the new messages and job
    CHATS.with(|c| {
        let mut chats = c.borrow_mut();
        if let Some(chat_wrapper) = chats.get(&req.chat_id) {
            let mut chat = chat_wrapper.0.clone();
            chat.message_ids.push(user_message_id);
            chat.message_ids.push(ai_msg.message_id);
            chat.job_ids.push(job.job_id);
            chat.active_job_id = Some(job.job_id);
            chat.updated_at = timestamp;
            chats.insert(req.chat_id, CandidWrapper(chat));
        }
    });

    Ok(AddMessageResponse {
        message: user_msg,
        ai_message: ai_msg,
        job,
    })
}
