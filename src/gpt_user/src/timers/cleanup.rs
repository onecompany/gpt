use crate::handlers::chat::delete::delete_chat_internal;
use crate::helpers::generation_helpers::fail_job;
use crate::helpers::message_helpers::is_chat_in_generation;
use crate::storage::{CHAT_JOBS, CHATS};
use candid::Principal;
use gpt_types::{domain::GenerationStatus, error::MessageErrorStatus};
use ic_cdk::api;

pub async fn time_out_stale_jobs() {
    ic_cdk::println!("[TASK] Starting: Time out stale jobs...");
    let now = api::time();
    const PENDING_TIMEOUT_NS: u64 = 2 * 60 * 1_000_000_000;
    const INPROGRESS_TIMEOUT_NS: u64 = 5 * 60 * 1_000_000_000;

    let stale_job_ids: Vec<u64> = CHAT_JOBS.with(|cj_ref| {
        let jobs = cj_ref.borrow();
        let mut result = Vec::new();
        for entry in jobs.iter() {
            let job = &entry.value().0;
            let age = now.saturating_sub(job.updated_at);
            let is_stale = match job.generation_status {
                GenerationStatus::Pending => age > PENDING_TIMEOUT_NS,
                GenerationStatus::InProgress => age > INPROGRESS_TIMEOUT_NS,
                _ => false,
            };
            if is_stale {
                result.push(*entry.key());
            }
        }
        result
    });

    if stale_job_ids.is_empty() {
        ic_cdk::println!("[TASK] Completed: No stale jobs found.");
        return;
    }

    ic_cdk::println!(
        "[TASK] Found {} stale jobs to process.",
        stale_job_ids.len()
    );

    for job_id in stale_job_ids {
        if let Err(e) = fail_job(job_id, MessageErrorStatus::Timeout) {
            ic_cdk::println!("[TASK] WARN: Could not time out job {}: {:?}", job_id, e);
        }
    }
    ic_cdk::println!("[TASK] Completed: Finished processing stale jobs.");
}

pub async fn cleanup_old_chats() {
    ic_cdk::println!("[TASK] Starting: Cleanup of old chats...");
    let current_time = api::time();
    const TEMP_CHAT_TTL_NS: u64 = 10 * 60 * 1_000_000_000;
    const SEVEN_DAYS_NS: u64 = 7 * 24 * 60 * 60 * 1_000_000_000;
    const FOURTEEN_DAYS_NS: u64 = 14 * 24 * 60 * 60 * 1_000_000_000;

    let to_delete: Vec<(Principal, u64)> = CHATS.with(|c| {
        let chats = c.borrow();
        let mut result = Vec::new();
        for entry in chats.iter() {
            let chat = &entry.value().0;
            let cutoff = if chat.temporary {
                current_time.saturating_sub(TEMP_CHAT_TTL_NS)
            } else if chat.archived {
                current_time.saturating_sub(FOURTEEN_DAYS_NS)
            } else {
                current_time.saturating_sub(SEVEN_DAYS_NS)
            };
            if chat.updated_at < cutoff {
                result.push((chat.owner, chat.chat_id));
            }
        }
        result
    });

    if to_delete.is_empty() {
        ic_cdk::println!("[TASK] Completed: No chats found for deletion.");
        return;
    }

    ic_cdk::println!("[TASK] Found {} chats to delete.", to_delete.len());

    for (user, chat_id) in to_delete {
        if is_chat_in_generation(chat_id).unwrap_or(false) {
            ic_cdk::println!("[TASK] Skipping chat_id {} (in generation).", chat_id);
            continue;
        }
        match delete_chat_internal(user, chat_id) {
            Ok(_) => ic_cdk::println!("[TASK] Deleted chat_id {}.", chat_id),
            Err(e) => ic_cdk::println!("[TASK] FAILED to delete chat_id {}: {:?}", chat_id, e),
        }
    }
    ic_cdk::println!("[TASK] Completed: Finished chat cleanup cycle.");
}
