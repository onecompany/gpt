use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type UserId = u64;
pub type ChatId = u64;
pub type MessageId = u64;
pub type ModelId = String;
pub type NodeId = u64;
pub type SecretKey = String;
pub type JobId = u64;

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq)]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq)]
pub enum GenerationStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}
