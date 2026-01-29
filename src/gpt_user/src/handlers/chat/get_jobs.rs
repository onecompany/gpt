use crate::helpers::user_helpers::verify_owner;
use crate::storage::CHAT_JOBS;
use gpt_types::api::{GetChatJobsRequest, GetChatJobsResponse, GetChatJobsResult};
use gpt_types::domain::Job;
use ic_cdk_macros::query;

#[query]
pub fn get_chat_jobs(req: GetChatJobsRequest) -> GetChatJobsResult {
    ic_cdk::println!("get_chat_jobs called with request: {:?}", req);

    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    let jobs: Vec<Job> = CHAT_JOBS.with(|cj| {
        let jobs_map = cj.borrow();
        let mut result = Vec::new();
        for entry in jobs_map.iter() {
            let job = entry.value().0.clone();
            if job.chat_id == req.chat_id {
                result.push(job);
            }
        }
        result
    });

    Ok(GetChatJobsResponse { jobs })
}
