use crate::helpers::user_helpers::verify_owner;
use crate::helpers::generation_helpers::{
    GenerationParams, create_generation_entities, validate_generation_request,
};
use crate::helpers::message_helpers::validate_attachments;
use crate::storage::{
    get_next_chat_id, get_next_message_id, CandidWrapper, StorableString,
    CHAT_JOBS, CHATS, MESSAGES, MODELS,
};
use gpt_types::api::{CreateChatRequest, CreateChatResponse, CreateChatResult};
use gpt_types::domain::{Chat, Message, ModelStatus, Role};
use gpt_types::error::CanisterError;
use ic_cdk::api;
use ic_cdk_macros::update;

#[update]
pub fn create_chat(req: CreateChatRequest) -> CreateChatResult {
    ic_cdk::println!("create_chat called with request");
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    // Check Model Status
    MODELS.with(|models| {
        let m = models.borrow();
        let model = m.get(&StorableString(req.model_id.clone())).ok_or(CanisterError::ModelNotFound)?;
        if model.0.status == ModelStatus::Paused {
            return Err(CanisterError::InvalidInput(format!(
                "Model {} is currently paused.",
                req.model_id
            )));
        }
        Ok(())
    })?;

    if req.initial_message.is_empty() && req.attachments.is_none() {
        return Err(CanisterError::InvalidInput(
            "Initial message cannot be empty without attachments".to_string(),
        ));
    }

    if req.encryption_salt.len() != 32 {
        return Err(CanisterError::InvalidInput(
            "Encryption salt must be 32 bytes".to_string(),
        ));
    }

    validate_attachments(&req.attachments, &req.model_id)?;
    validate_generation_request(
        0,
        req.node_id,
        &req.model_id,
        &req.tools,
        req.custom_prompt.as_ref(),
    )?;

    let timestamp = api::time();
    let chat_id = get_next_chat_id();
    let user_message_id = get_next_message_id();

    let user_message = Message {
        message_id: user_message_id,
        chat_id,
        parent_message_id: None,
        role: Role::User,
        content: req.initial_message.clone(),
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

    let gen_params = GenerationParams {
        chat_id,
        user_message_id,
        node_id: req.node_id,
        model_id: &req.model_id,
        temperature: req.temperature,
        max_completion_tokens: req.max_completion_tokens,
        max_context: req.max_context,
        custom_prompt: req.custom_prompt.clone(),
        tools: req.tools.clone(),
        reasoning_effort: None,
        encrypted_chat_key: req.encrypted_chat_key,
    };
    let (ai_message, job) = create_generation_entities(gen_params, timestamp);
    let ai_message_id = ai_message.message_id;
    let job_id = job.job_id;

    let chat = Chat {
        chat_id,
        owner: caller,
        title: if req.title.trim().is_empty() {
            format!("Chat {}", chat_id)
        } else {
            req.title.clone()
        },
        message_ids: vec![user_message_id, ai_message_id],
        job_ids: vec![job_id],
        active_job_id: Some(job_id),
        created_at: timestamp,
        updated_at: timestamp,
        archived: false,
        temporary: req.temporary,
        encryption_salt: req.encryption_salt,
    };

    MESSAGES.with(|m| {
        let mut msgs = m.borrow_mut();
        msgs.insert(user_message_id, CandidWrapper(user_message));
        msgs.insert(ai_message_id, CandidWrapper(ai_message));
    });

    CHAT_JOBS.with(|cj| {
        cj.borrow_mut().insert(job_id, CandidWrapper(job));
    });

    CHATS.with(|c| {
        c.borrow_mut().insert(chat_id, CandidWrapper(chat));
    });

    // No CHATS_INDEX needed - single user canister

    Ok(CreateChatResponse {
        chat_id,
        user_message_id,
        ai_message_id,
        job_id,
    })
}
