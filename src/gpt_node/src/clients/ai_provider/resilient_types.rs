use async_openai::types::chat::{ChatCompletionMessageToolCallChunk, FunctionCallStream};
use gpt_types::domain::message::TokenUsage;
use serde::{Deserialize, Serialize};

/// A resilient version of CreateChatCompletionStreamResponse.
/// It uses relaxed types (Option<String>, Option<serde_json::Value>) for fields
/// that vary between providers (like service_tier, finish_reason) to prevent
/// deserialization failures.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ResilientChatCompletionStreamResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,

    // Groq sends "on_demand" which fails standard enum parsing.
    // We capture it as Value to ignore it safely.
    #[serde(default)]
    pub service_tier: Option<serde_json::Value>,

    #[serde(default)]
    pub system_fingerprint: Option<String>,

    pub choices: Vec<ResilientChatChoice>,

    #[serde(default)]
    pub usage: Option<ResilientUsage>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ResilientChatChoice {
    pub index: u32,
    pub delta: ResilientChatCompletionStreamResponseDelta,

    // Some providers might send non-standard finish reasons.
    // We capture as String to handle safely.
    #[serde(default)]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ResilientChatCompletionStreamResponseDelta {
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub tool_calls: Option<Vec<ChatCompletionMessageToolCallChunk>>,
    #[serde(default)]
    #[deprecated]
    pub function_call: Option<FunctionCallStream>,
    #[serde(default)]
    pub refusal: Option<String>,
}

// DeepInfra/FastAPI Error Structures
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum ProviderErrorBody {
    // OpenAI standard error
    Standard { error: StandardErrorDetail },
    // FastAPI/DeepInfra style
    FastAPI { detail: Vec<FastAPIErrorDetail> },
    // Simple string detail
    Simple { detail: String },
}

#[derive(Debug, Deserialize)]
pub struct StandardErrorDetail {
    pub message: String,
    #[allow(dead_code)]
    pub r#type: Option<String>,
    #[allow(dead_code)]
    pub code: Option<serde_json::Value>, // Code can be string or int
}

#[derive(Debug, Deserialize)]
pub struct FastAPIErrorDetail {
    pub msg: String,
    #[allow(dead_code)]
    pub r#type: String,
    // loc is usually a list of strings/ints
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ResilientUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

impl From<ResilientUsage> for TokenUsage {
    fn from(val: ResilientUsage) -> Self {
        TokenUsage {
            prompt_tokens: val.prompt_tokens,
            completion_tokens: val.completion_tokens,
            total_tokens: val.total_tokens,
        }
    }
}
