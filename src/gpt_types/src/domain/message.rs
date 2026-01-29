use crate::domain::common::{ChatId, MessageId, Role};
use crate::domain::tool::{ToolCall, ToolResult};
use crate::error::MessageErrorStatus;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes;

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct ImageAttachment {
    pub mime_type: String,
    #[serde(with = "serde_bytes")]
    pub data: Vec<u8>,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq, Default)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct Message {
    pub message_id: MessageId,
    pub chat_id: ChatId,
    pub parent_message_id: Option<MessageId>,
    pub role: Role,
    #[serde(with = "serde_bytes")]
    pub content: Vec<u8>,
    pub created_at: u64,
    pub updated_at: u64,
    pub error_status: Option<MessageErrorStatus>,
    pub attachments: Option<Vec<ImageAttachment>>,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub tool_results: Option<Vec<ToolResult>>,
    pub tool_call_id: Option<String>,
    pub requires_client_action: bool,
    pub usage: Option<TokenUsage>,
}
