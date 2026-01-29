use crate::domain::common::{ChatId, JobId, MessageId};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct Chat {
    pub chat_id: ChatId,
    pub owner: Principal,
    pub title: String,
    pub message_ids: Vec<MessageId>,
    pub job_ids: Vec<JobId>,
    pub active_job_id: Option<JobId>,
    pub created_at: u64,
    pub updated_at: u64,
    pub archived: bool,
    pub temporary: bool,
    #[serde(with = "serde_bytes")]
    pub encryption_salt: Vec<u8>,
}
