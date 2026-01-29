use crate::helpers::user_helpers::verify_node_by_caller;
use crate::storage::{CandidWrapper, CHAT_JOBS, CHATS, MESSAGES};
use gpt_types::{
    api::{CompleteJobRequest, CompleteJobResponse, CompleteJobResult, JobCompletionResult},
    domain::GenerationStatus,
    error::CanisterError,
};
use ic_cdk::api;
use ic_cdk_macros::update;

/// The public update method for a node to submit the result of a generation job.
#[update]
pub fn complete_job(req: CompleteJobRequest) -> CompleteJobResult {
    ic_cdk::println!("complete_job called");

    // Authorization and Validation
    let node = verify_node_by_caller()?;
    let caller_node_id = node.node_id;
    let timestamp = api::time();

    // Retrieve the job from storage.
    let job = CHAT_JOBS
        .with(|cj| cj.borrow().get(&req.job_id).map(|w| w.0.clone()))
        .ok_or_else(|| {
            let msg = format!("Job {} not found", req.job_id);
            ic_cdk::println!("ERROR: complete_job error: {}", msg);
            CanisterError::Other(msg)
        })?;

    // Ensure the job was assigned to the calling node.
    if job.node_id != caller_node_id {
        return Err(CanisterError::Unauthorized);
    }

    // A job can only be completed if it's currently in progress.
    if job.generation_status != GenerationStatus::InProgress {
        let msg = format!(
            "Job {} is not in progress (current status: {:?}), cannot complete.",
            req.job_id, job.generation_status
        );
        return Err(CanisterError::InvalidInput(msg));
    }

    // Determine the final status based on the result.
    let final_status = match &req.result {
        JobCompletionResult::Success(_) => GenerationStatus::Completed,
        JobCompletionResult::Failure(_) => GenerationStatus::Failed,
        JobCompletionResult::ToolCall(_) => GenerationStatus::Completed,
    };

    // State Updates
    // 1. Update the job's status to its final state.
    CHAT_JOBS.with(|cj| {
        let mut jobs = cj.borrow_mut();
        if let Some(job_wrapper) = jobs.get(&req.job_id) {
            let mut job = job_wrapper.0.clone();
            job.generation_status = final_status;
            job.updated_at = timestamp;
            jobs.insert(req.job_id, CandidWrapper(job));
        }
    });

    // 2. Update the placeholder AI message with the final content, error, or tool calls.
    MESSAGES.with(|m| {
        let mut messages = m.borrow_mut();
        if let Some(msg_wrapper) = messages.get(&job.placeholder_message_id) {
            let mut msg = msg_wrapper.0.clone();
            msg.updated_at = timestamp;

            // Save usage data if present
            if let Some(u) = req.usage {
                msg.usage = Some(u);
            }

            match &req.result {
                JobCompletionResult::Success(content) => {
                    msg.content = content.clone();
                    msg.error_status = None;
                    msg.requires_client_action = false;
                }
                JobCompletionResult::Failure(error_status) => {
                    msg.error_status = Some(error_status.clone());
                    msg.requires_client_action = false;
                }
                JobCompletionResult::ToolCall(tool_calls) => {
                    msg.tool_calls = Some(tool_calls.clone());
                    msg.requires_client_action = true; // Signals to the UI that user input is needed.
                    msg.error_status = None;
                }
            }

            messages.insert(job.placeholder_message_id, CandidWrapper(msg));
        }
    });

    // 3. Update the parent chat to remove the active job ID, unblocking the chat for new messages.
    CHATS.with(|c| {
        let mut chats = c.borrow_mut();
        if let Some(chat_wrapper) = chats.get(&job.chat_id) {
            let mut chat = chat_wrapper.0.clone();
            if chat.active_job_id == Some(req.job_id) {
                chat.active_job_id = None;
                chat.updated_at = timestamp;
                chats.insert(job.chat_id, CandidWrapper(chat));
            }
        }
    });

    Ok(CompleteJobResponse)
}
