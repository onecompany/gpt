use crate::storage::{
    get_next_job_id, get_next_message_id, StorableString,
    CHATS, MODELS, NODES,
};
use gpt_types::{
    domain::{GenerationStatus, Job, Message, ModelId, Role, tool::Tool},
    error::{CanisterError, CanisterResult, MessageErrorStatus},
};

pub struct GenerationParams<'a> {
    pub chat_id: u64,
    pub user_message_id: u64,
    pub node_id: u64,
    pub model_id: &'a ModelId,
    pub temperature: f32,
    pub max_completion_tokens: u32,
    pub max_context: u32,
    pub custom_prompt: Option<String>,
    pub tools: Option<Vec<Tool>>,
    pub reasoning_effort: Option<String>,
    pub encrypted_chat_key: Option<String>,
}

pub fn create_generation_entities(params: GenerationParams, timestamp: u64) -> (Message, Job) {
    let ai_message_id = get_next_message_id();

    let ai_msg = Message {
        message_id: ai_message_id,
        chat_id: params.chat_id,
        parent_message_id: Some(params.user_message_id),
        role: Role::Assistant,
        content: Vec::new(),
        created_at: timestamp,
        updated_at: timestamp,
        error_status: None,
        attachments: None,
        tool_calls: None,
        tool_results: None,
        tool_call_id: None,
        requires_client_action: false,
        usage: None,
    };

    let job_id = get_next_job_id();

    let extra_body_json = MODELS.with(|m| {
        m.borrow()
            .get(&StorableString(params.model_id.clone()))
            .and_then(|model| model.0.extra_body_json.clone())
    });

    let job = Job {
        job_id,
        chat_id: params.chat_id,
        generation_status: GenerationStatus::Pending,
        temperature: params.temperature,
        max_completion_tokens: params.max_completion_tokens,
        max_context: params.max_context,
        model_id: params.model_id.clone(),
        node_id: params.node_id,
        placeholder_message_id: ai_message_id,
        custom_prompt: params.custom_prompt,
        created_at: timestamp,
        updated_at: timestamp,
        tools: params.tools,
        extra_body_json,
        reasoning_effort: params.reasoning_effort,
        encrypted_chat_key: params.encrypted_chat_key,
    };

    (ai_msg, job)
}

pub fn validate_generation_request(
    chat_id: u64,
    node_id: u64,
    model_id: &str,
    tools: &Option<Vec<Tool>>,
    custom_prompt: Option<&String>,
) -> CanisterResult<()> {
    // Check if chat has an active job (skip for new chats where chat_id is 0)
    if chat_id > 0 {
        let active = CHATS.with(|c| {
            c.borrow()
                .get(&chat_id)
                .and_then(|w| w.0.active_job_id)
        });
        if active.is_some() {
            return Err(CanisterError::GenerationInProgress);
        }
    }

    let node = NODES
        .with(|n| n.borrow().get(&node_id).map(|w| w.0.clone()))
        .ok_or(CanisterError::NodeNotFound)?;

    if node.model_id != model_id {
        return Err(CanisterError::InvalidInput(format!(
            "Node {} does not support the specified model {}",
            node_id, model_id
        )));
    }
    if node.node_principal.is_none() {
        ic_cdk::println!(
            "Node {} is not currently active (no principal associated in local state).",
            node_id
        );
        return Err(CanisterError::NodeNotFound);
    }

    if let Some(tools) = tools {
        let model = MODELS
            .with(|m| m.borrow().get(&StorableString(model_id.to_string())).map(|w| w.0.clone()))
            .ok_or(CanisterError::ModelNotFound)?;

        if (tools.len() as u32) > model.max_tools {
            return Err(CanisterError::InvalidInput(format!(
                "Number of tools ({}) exceeds the model's limit of {}.",
                tools.len(),
                model.max_tools
            )));
        }
    }

    if let Some(prompt) = custom_prompt
        && prompt.len() > crate::config::MAX_CUSTOM_PROMPT_CHARS
    {
        return Err(CanisterError::InvalidInput(format!(
            "System prompt exceeds maximum allowed length of {} characters.",
            crate::config::MAX_CUSTOM_PROMPT_CHARS
        )));
    }

    Ok(())
}

pub fn fail_job(job_id: u64, reason: MessageErrorStatus) -> CanisterResult<()> {
    use crate::storage::{CandidWrapper, CHAT_JOBS, MESSAGES};

    let now = ic_cdk::api::time();

    // Get job and update it
    let (chat_id, placeholder_id) = CHAT_JOBS.with(|cj_ref| -> CanisterResult<(u64, u64)> {
        let mut jobs = cj_ref.borrow_mut();
        let job_wrapper = jobs.get(&job_id).ok_or(CanisterError::Other(format!(
            "Job {} not found for failure",
            job_id
        )))?;
        let mut job = job_wrapper.0.clone();

        if !matches!(
            job.generation_status,
            GenerationStatus::Pending | GenerationStatus::InProgress
        ) {
            return Err(CanisterError::InvalidInput(format!(
                "Job {} is not in a fail-able state ({:?})",
                job_id, job.generation_status
            )));
        }

        let chat_id = job.chat_id;
        let placeholder_id = job.placeholder_message_id;

        job.generation_status = GenerationStatus::Failed;
        job.updated_at = now;
        jobs.insert(job_id, CandidWrapper(job));

        Ok((chat_id, placeholder_id))
    })?;

    // Update message
    MESSAGES.with(|m| {
        let mut msgs = m.borrow_mut();
        if let Some(msg_wrapper) = msgs.get(&placeholder_id) {
            let mut msg = msg_wrapper.0.clone();
            msg.error_status = Some(reason);
            msg.updated_at = now;
            msg.requires_client_action = false;
            msgs.insert(placeholder_id, CandidWrapper(msg));
        }
    });

    // Update chat
    CHATS.with(|c| {
        let mut chats = c.borrow_mut();
        if let Some(chat_wrapper) = chats.get(&chat_id) {
            let mut chat = chat_wrapper.0.clone();
            if chat.active_job_id == Some(job_id) {
                chat.active_job_id = None;
                chat.updated_at = now;
                chats.insert(chat_id, CandidWrapper(chat));
            }
        }
    });

    ic_cdk::println!("[JOB] Failed job {}", job_id);
    Ok(())
}
