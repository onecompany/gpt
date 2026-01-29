use gpt_types::{
    domain::{Chat, GenerationStatus},
    error::{CanisterError, CanisterResult},
};

use crate::storage::CHAT_JOBS;

pub fn ensure_no_conflict_incomplete(chat: &Chat, node_id: u64) -> CanisterResult<()> {
    if let Some(active_job_id) = chat.active_job_id {
        // Get job from stable storage using CandidWrapper pattern
        let job = CHAT_JOBS.with(|cj| cj.borrow().get(&active_job_id).map(|w| w.0.clone()));
        if let Some(job) = job
            && job.generation_status != GenerationStatus::Completed
            && job.node_id != node_id
        {
            ic_cdk::println!(
                "Conflict: chat {} has an active job assigned to a different node",
                chat.chat_id
            );
            return Err(CanisterError::Unauthorized);
        }
    }
    Ok(())
}
