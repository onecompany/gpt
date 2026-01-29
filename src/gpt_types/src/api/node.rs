use crate::domain::message::Message;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct NodeGetMessageRequest {
    pub message_id: u64,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct NodeGetMessageResponse {
    pub message: Message,
}
