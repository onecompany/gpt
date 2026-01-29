use crate::domain::common::JobId;
use crate::domain::common::{MessageId, Role};
use crate::domain::job::Job;
use crate::domain::message::ImageAttachment;
use crate::domain::message::Message;
use crate::domain::tool::{Tool, ToolResult};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetMessageRequest {
    pub message_id: MessageId,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetMessageResponse {
    pub message: Message,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct AddMessageRequest {
    pub chat_id: u64,
    pub parent_message_id: Option<u64>,
    pub role: Role,
    #[serde(with = "serde_bytes")]
    pub content: Vec<u8>,
    pub model_id: String,
    pub node_id: u64,
    pub temperature: f32,
    pub max_completion_tokens: u32,
    pub max_context: u32,
    pub custom_prompt: Option<String>,
    pub attachments: Option<Vec<ImageAttachment>>,
    pub tools: Option<Vec<Tool>>,
    pub reasoning_effort: Option<String>,
    pub encrypted_chat_key: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct AddMessageResponse {
    pub message: Message,
    pub ai_message: Message,
    pub job: Job,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UpdateMessageAttachmentsRequest {
    pub message_id: MessageId,
    pub attachments: Option<Vec<ImageAttachment>>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UpdateMessageAttachmentsResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct DeleteMessageRequest {
    pub message_id: MessageId,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct DeleteMessageResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct EditUserMessageRequest {
    pub chat_id: u64,
    pub old_user_message_id: u64,
    #[serde(with = "serde_bytes")]
    pub new_content: Vec<u8>,
    pub model_id: String,
    pub node_id: u64,
    pub temperature: f32,
    pub max_completion_tokens: u32,
    pub max_context: u32,
    pub custom_prompt: Option<String>,
    pub attachments: Option<Vec<ImageAttachment>>,
    pub tools: Option<Vec<Tool>>,
    pub reasoning_effort: Option<String>,
    pub encrypted_chat_key: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct EditUserMessageResponse {
    pub new_user_message: Message,
    pub new_ai_message: Message,
    pub job: Job,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RetryAiMessageRequest {
    pub chat_id: u64,
    pub user_message_id: u64,
    pub model_id: String,
    pub node_id: u64,
    pub temperature: f32,
    pub max_completion_tokens: u32,
    pub max_context: u32,
    pub custom_prompt: Option<String>,
    pub tools: Option<Vec<Tool>>,
    pub reasoning_effort: Option<String>,
    pub encrypted_chat_key: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RetryAiMessageResponse {
    pub new_ai_message: Message,
    pub job: Job,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ToolResponseMessage {
    pub tool_call_id: String,
    pub content: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ContinueFromToolResponseRequest {
    pub chat_id: u64,
    pub assistant_message_id: u64,
    pub responses: Vec<ToolResponseMessage>,
    pub model_id: String,
    pub node_id: u64,
    pub temperature: f32,
    pub max_completion_tokens: u32,
    pub max_context: u32,
    pub custom_prompt: Option<String>,
    pub tools: Option<Vec<Tool>>,
    pub reasoning_effort: Option<String>,
    pub encrypted_chat_key: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ContinueFromToolResponseResponse {
    pub new_ai_message_id: MessageId,
    pub job_id: JobId,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct StoreToolResultsRequest {
    pub chat_id: u64,
    pub assistant_message_id: u64,
    pub results: Vec<ToolResult>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct StoreToolResultsResponse;
