use crate::helpers::generation_helpers::validate_generation_request;
use crate::helpers::user_helpers::verify_owner;
use crate::storage::{
    CHAT_JOBS, CHATS, CandidWrapper, MESSAGES, MODELS, StorableString, get_next_job_id,
    get_next_message_id,
};
use gpt_types::{
    api::{
        ContinueFromToolResponseRequest, ContinueFromToolResponseResponse,
        ContinueFromToolResponseResult,
    },
    domain::{GenerationStatus, Job, Message, Role},
    error::{CanisterError, CanisterResult},
};
use ic_cdk::api;
use ic_cdk_macros::update;
use std::collections::HashSet;

#[update]
pub fn continue_from_tool_response(
    req: ContinueFromToolResponseRequest,
) -> ContinueFromToolResponseResult {
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    // Verify chat ownership
    let chat_opt = CHATS.with(|c| c.borrow().get(&req.chat_id).map(|w| w.0.clone()));
    let chat = chat_opt.ok_or(CanisterError::ChatNotFound)?;

    if chat.owner != caller {
        return Err(CanisterError::Unauthorized);
    }

    // Get valid tool call IDs from the assistant message
    let valid_tool_call_ids_res: CanisterResult<HashSet<String>> = MESSAGES.with(|m| {
        let msgs = m.borrow();
        let assistant_msg = msgs
            .get(&req.assistant_message_id)
            .map(|w| w.0.clone())
            .ok_or(CanisterError::MessageNotFound)?;

        if assistant_msg.chat_id != req.chat_id || assistant_msg.role != Role::Assistant {
            return Err(CanisterError::InvalidInput(
                "Provided assistant_message_id is invalid or not an assistant message.".to_string(),
            ));
        }

        assistant_msg
            .tool_calls
            .as_ref()
            .map(|calls| calls.iter().map(|c| c.id.clone()).collect())
            .ok_or_else(|| {
                CanisterError::InvalidInput(
                    "Parent assistant message does not contain tool calls.".to_string(),
                )
            })
    });

    let valid_tool_call_ids = valid_tool_call_ids_res?;

    for response in &req.responses {
        if !valid_tool_call_ids.contains(&response.tool_call_id) {
            return Err(CanisterError::InvalidInput(format!(
                "Provided tool_call_id '{}' is not valid for the parent message.",
                response.tool_call_id
            )));
        }
    }
    validate_generation_request(
        req.chat_id,
        req.node_id,
        &req.model_id,
        &req.tools,
        req.custom_prompt.as_ref(),
    )?;

    let timestamp = api::time();
    let mut prepared_tool_messages: Vec<Message> = Vec::new();

    for response in &req.responses {
        let tool_message = Message {
            message_id: 0, // Will be assigned later
            chat_id: req.chat_id,
            parent_message_id: Some(0), // Will be assigned later
            role: Role::Tool,
            content: response.content.as_bytes().to_vec(),
            tool_call_id: Some(response.tool_call_id.clone()),
            tool_calls: None,
            tool_results: None,
            requires_client_action: false,
            created_at: timestamp,
            updated_at: timestamp,
            error_status: None,
            attachments: None,
            usage: None,
        };
        prepared_tool_messages.push(tool_message);
    }

    // Get extra_body_json from model
    let extra_body_json = MODELS.with(|m| {
        m.borrow()
            .get(&StorableString(req.model_id.clone()))
            .and_then(|model| model.0.extra_body_json.clone())
    });

    let mut last_message_id = req.assistant_message_id;
    let mut all_new_message_ids: Vec<u64> = Vec::new();

    // Insert tool messages
    for mut tool_msg in prepared_tool_messages {
        let new_tool_msg_id = get_next_message_id();
        tool_msg.message_id = new_tool_msg_id;
        tool_msg.parent_message_id = Some(last_message_id);
        MESSAGES.with(|m| {
            m.borrow_mut()
                .insert(new_tool_msg_id, CandidWrapper(tool_msg));
        });
        all_new_message_ids.push(new_tool_msg_id);
        last_message_id = new_tool_msg_id;
    }

    // Create AI placeholder message
    let final_ai_message_id = get_next_message_id();
    let ai_msg = Message {
        message_id: final_ai_message_id,
        chat_id: req.chat_id,
        parent_message_id: Some(last_message_id),
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
    MESSAGES.with(|m| {
        m.borrow_mut()
            .insert(final_ai_message_id, CandidWrapper(ai_msg));
    });
    all_new_message_ids.push(final_ai_message_id);

    // Create job
    let final_job_id = get_next_job_id();
    let job = Job {
        job_id: final_job_id,
        chat_id: req.chat_id,
        generation_status: GenerationStatus::Pending,
        temperature: req.temperature,
        max_completion_tokens: req.max_completion_tokens,
        max_context: req.max_context,
        model_id: req.model_id.clone(),
        node_id: req.node_id,
        placeholder_message_id: final_ai_message_id,
        custom_prompt: req.custom_prompt,
        created_at: timestamp,
        updated_at: timestamp,
        tools: req.tools,
        extra_body_json,
        reasoning_effort: req.reasoning_effort,
        encrypted_chat_key: req.encrypted_chat_key,
    };
    CHAT_JOBS.with(|cj| {
        cj.borrow_mut().insert(final_job_id, CandidWrapper(job));
    });

    // Update chat
    CHATS.with(|c| {
        let mut chats = c.borrow_mut();
        if let Some(chat_wrapper) = chats.get(&req.chat_id) {
            let mut chat = chat_wrapper.0.clone();
            for msg_id in all_new_message_ids {
                if !chat.message_ids.contains(&msg_id) {
                    chat.message_ids.push(msg_id);
                }
            }
            chat.job_ids.push(final_job_id);
            chat.active_job_id = Some(final_job_id);
            chat.updated_at = timestamp;
            chats.insert(req.chat_id, CandidWrapper(chat));
        }
    });

    Ok(ContinueFromToolResponseResponse {
        new_ai_message_id: final_ai_message_id,
        job_id: final_job_id,
    })
}
