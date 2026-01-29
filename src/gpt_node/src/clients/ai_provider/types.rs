use async_openai::types::chat::{ChatCompletionMessageToolCall, CreateChatCompletionRequest};
use gpt_types::domain::message::TokenUsage;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;

/// Extended chat completion request that allows additional fields beyond the standard OpenAI API.
#[derive(Serialize, Debug, Clone)]
pub struct ExtendedChatCompletionRequest {
    #[serde(flatten)]
    pub standard_request: CreateChatCompletionRequest,

    #[serde(flatten)]
    pub extra_fields: HashMap<String, Value>,
}

pub enum AIResponse {
    Text(String, Option<TokenUsage>),
    ToolCall(Vec<ChatCompletionMessageToolCall>, Option<TokenUsage>),
}
