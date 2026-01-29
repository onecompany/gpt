use crate::domain::chat::Chat;
use crate::domain::common::{JobId, MessageId};
use crate::domain::job::Job;
use crate::domain::message::TokenUsage;
use crate::domain::tool::{Tool, ToolCall};
use crate::error::MessageErrorStatus;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub enum JobCompletionResult {
    Success(#[serde(with = "serde_bytes")] Vec<u8>),
    Failure(MessageErrorStatus),
    ToolCall(Vec<ToolCall>),
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ClaimJobRequest {
    pub job_id: JobId,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ClaimJobResponse {
    pub chat: Chat,
    pub message_chain_ids: Vec<MessageId>,
    pub job: Job,
    pub tools: Option<Vec<Tool>>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct CompleteJobRequest {
    pub job_id: JobId,
    pub result: JobCompletionResult,
    pub usage: Option<TokenUsage>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct CompleteJobResponse;
