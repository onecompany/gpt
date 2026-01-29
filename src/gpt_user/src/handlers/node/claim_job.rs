use crate::helpers::user_helpers::verify_node_by_caller;
use crate::storage::{CandidWrapper, CHAT_JOBS, CHATS, MESSAGES};
use gpt_types::api::{ClaimJobRequest, ClaimJobResponse, ClaimJobResult};
use gpt_types::domain::GenerationStatus;
use gpt_types::error::CanisterError;
use ic_cdk::api;
use ic_cdk_macros::update;

#[update]
pub fn claim_job(req: ClaimJobRequest) -> ClaimJobResult {
    ic_cdk::println!("claim_job called with request: {:?}", req);

    let node = verify_node_by_caller()?;
    let caller_node_id = node.node_id;

    // Get job from stable storage
    let job = CHAT_JOBS
        .with(|cj| cj.borrow().get(&req.job_id).map(|w| w.0.clone()))
        .ok_or(CanisterError::Other("Job not found".to_string()))?;

    // Get chat from stable storage
    let chat = CHATS
        .with(|c| c.borrow().get(&job.chat_id).map(|w| w.0.clone()))
        .ok_or(CanisterError::ChatNotFound)?;

    if let Some(active_job) = chat.active_job_id {
        if active_job != req.job_id {
            return Err(CanisterError::Other(
                "Requested job is not the active job".to_string(),
            ));
        }
    } else {
        return Err(CanisterError::Other("No active job in chat".to_string()));
    }

    if job.generation_status != GenerationStatus::Pending {
        return Err(CanisterError::Other("Job is not pending".to_string()));
    }

    if job.node_id != caller_node_id {
        return Err(CanisterError::Unauthorized);
    }

    // Update job status (get -> modify -> insert pattern for StableBTreeMap)
    CHAT_JOBS.with(|cj| {
        let mut jobs = cj.borrow_mut();
        if let Some(job_wrapper) = jobs.get(&req.job_id) {
            let mut job = job_wrapper.0.clone();
            job.generation_status = GenerationStatus::InProgress;
            job.updated_at = api::time();
            jobs.insert(req.job_id, CandidWrapper(job));
        }
    });

    // Build message chain
    let message_chain_ids = {
        let mut chain = Vec::new();
        let mut current_message_id = job.placeholder_message_id;
        loop {
            let msg_opt = MESSAGES.with(|m| m.borrow().get(&current_message_id).map(|w| w.0.clone()));
            if let Some(msg) = msg_opt {
                chain.push(msg.message_id);
                if let Some(parent_id) = msg.parent_message_id {
                    current_message_id = parent_id;
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        chain.reverse();
        chain
    };

    // Get updated job
    let updated_job = CHAT_JOBS
        .with(|cj| cj.borrow().get(&req.job_id).map(|w| w.0.clone()))
        .unwrap();

    let tools = updated_job.tools.clone();

    Ok(ClaimJobResponse {
        chat,
        message_chain_ids,
        job: updated_job,
        tools,
    })
}
