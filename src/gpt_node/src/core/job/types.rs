use gpt_types::{
    domain::{
        message::{ImageAttachment, TokenUsage},
        tool::Tool,
    },
    error::MessageErrorStatus,
};
use serde::{Deserialize, Serialize};

/// Function call within a tool call.
#[derive(Deserialize, Debug, Clone)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

/// Tool call returned by the AI provider.
#[derive(Deserialize, Debug, Clone)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub _type: String,
    pub function: FunctionCall,
}

/// OpenAI request structure for AI processing.
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OpenAIRequest {
    pub messages: Vec<MessageData>,
    pub max_completion_tokens: u32,
    pub temperature: f32,
    pub max_context: u32,
    pub tools: Option<Vec<Tool>>,
    pub extra_body_json: Option<String>,
    pub reasoning_effort: Option<String>,
}

/// Streamed response sent back to the client via WebSocket.
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StreamedResponse {
    pub text: String,
    pub is_complete: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_status: Option<MessageErrorStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<TokenUsage>,
}

/// Message data for conversation history.
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessageData {
    pub role: String,
    pub content: String,
    pub attachments: Option<Vec<ImageAttachment>>,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub tool_call_id: Option<String>,
}

/// Message with token count information (used for context management).
#[derive(Debug)]
pub struct TokenizedMessage {
    pub role: String,
    pub content: String,
    pub token_count: u32,
    pub attachments: Option<Vec<ImageAttachment>>,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub tool_call_id: Option<String>,
}
