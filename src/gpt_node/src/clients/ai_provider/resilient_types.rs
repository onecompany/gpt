//! Resilient types for parsing provider SSE stream responses.
//!
//! These types use relaxed parsing (optional fields, `serde_json::Value` for unknown variants)
//! to handle differences between AI providers while preventing deserialization failures.
//!
//! Provider-specific fields are captured here and parsed by `usage_parser.rs`.

use async_openai::types::chat::{ChatCompletionMessageToolCallChunk, FunctionCallStream};
use gpt_types::domain::message::TokenUsage;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// A resilient version of CreateChatCompletionStreamResponse.
///
/// Captures ALL provider-specific fields to prevent deserialization failures.
/// Uses `#[serde(default)]` liberally to handle missing fields across providers.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ResilientChatCompletionStreamResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,

    /// OpenAI/Groq service tier (e.g., "on_demand").
    /// Captured as Value to handle non-standard values like Groq's string.
    #[serde(default)]
    pub service_tier: Option<Value>,

    /// System fingerprint (OpenAI, Groq, Cerebras).
    #[serde(default)]
    pub system_fingerprint: Option<String>,

    pub choices: Vec<ResilientChatChoice>,

    /// Standard usage data (when available).
    #[serde(default)]
    pub usage: Option<ResilientUsage>,

    // === PROVIDER-SPECIFIC FIELDS ===

    /// Groq-specific: x_groq wrapper with timing and usage data.
    /// Contains request ID and detailed timing metrics.
    #[serde(default)]
    pub x_groq: Option<GroqExtension>,

    /// Cerebras-specific: time_info with detailed timing breakdown.
    /// Contains queue_time, prompt_time, completion_time, total_time, created.
    #[serde(default)]
    pub time_info: Option<CerebrasTimeInfo>,
}

/// Groq's x_groq extension wrapper.
///
/// Present in final SSE chunk from Groq API with timing metrics.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GroqExtension {
    /// Groq-specific request ID (mirrors the X-Request-Id header).
    #[serde(default)]
    pub id: Option<String>,

    /// Groq usage with timing data.
    /// Mirrors top-level usage but includes timing fields.
    #[serde(default)]
    pub usage: Option<GroqUsage>,
}

/// Groq usage with timing information.
///
/// Extends standard usage with queue/prompt/completion timing.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GroqUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,

    /// Time spent in queue before processing started (seconds).
    #[serde(default)]
    pub queue_time: Option<f64>,

    /// Time to process prompt tokens (seconds).
    #[serde(default)]
    pub prompt_time: Option<f64>,

    /// Time to generate completion tokens (seconds).
    #[serde(default)]
    pub completion_time: Option<f64>,

    /// Total processing time (seconds).
    #[serde(default)]
    pub total_time: Option<f64>,
}

/// Cerebras time_info block.
///
/// Cerebras provides detailed timing in a separate top-level field.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct CerebrasTimeInfo {
    /// Queue time before processing (seconds).
    #[serde(default)]
    pub queue_time: Option<f64>,

    /// Prompt processing time (seconds).
    #[serde(default)]
    pub prompt_time: Option<f64>,

    /// Completion generation time (seconds).
    #[serde(default)]
    pub completion_time: Option<f64>,

    /// Total time (seconds).
    #[serde(default)]
    pub total_time: Option<f64>,

    /// Unix timestamp when processing completed.
    #[serde(default)]
    pub created: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ResilientChatChoice {
    pub index: u32,
    pub delta: ResilientChatCompletionStreamResponseDelta,

    /// Finish reason as string to handle non-standard values.
    /// Standard values: "stop", "length", "tool_calls", "content_filter".
    #[serde(default)]
    pub finish_reason: Option<String>,

    /// Log probabilities (often null, captured for completeness).
    #[serde(default)]
    pub logprobs: Option<Value>,
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

    // === PROVIDER-SPECIFIC DELTA FIELDS ===

    /// DeepInfra (Kimi-K2-Thinking, etc.): reasoning_content for chain-of-thought.
    /// Contains the model's internal reasoning/thinking process.
    #[serde(default)]
    pub reasoning_content: Option<String>,
}

/// Extended usage that captures all provider variants.
///
/// Includes standard fields plus provider-specific extensions.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ResilientUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,

    // === PROVIDER-SPECIFIC USAGE FIELDS ===

    /// Mistral: Number of tokens served from prompt cache.
    #[serde(default)]
    pub num_cached_tokens: Option<u32>,

    /// Cerebras: Detailed breakdown of completion tokens.
    /// Contains reasoning_tokens for reasoning models.
    #[serde(default)]
    pub completion_tokens_details: Option<TokenDetails>,

    /// Cerebras: Detailed breakdown of prompt tokens.
    /// Contains cached_tokens count.
    #[serde(default)]
    pub prompt_tokens_details: Option<PromptTokenDetails>,
}

/// Cerebras completion token breakdown.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TokenDetails {
    /// Number of tokens used for reasoning (in reasoning models).
    #[serde(default)]
    pub reasoning_tokens: Option<u32>,
}

/// Cerebras prompt token breakdown.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct PromptTokenDetails {
    /// Number of cached prompt tokens.
    #[serde(default)]
    pub cached_tokens: Option<u32>,
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

// === ERROR BODY TYPES ===
// Handle various error formats from different providers.

/// Provider error body variants.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum ProviderErrorBody {
    /// OpenAI standard error format.
    Standard { error: StandardErrorDetail },
    /// FastAPI/DeepInfra style errors with detail array.
    FastAPI { detail: Vec<FastAPIErrorDetail> },
    /// Simple string detail message.
    Simple { detail: String },
}

#[derive(Debug, Deserialize)]
pub struct StandardErrorDetail {
    pub message: String,
    #[allow(dead_code)]
    pub r#type: Option<String>,
    #[allow(dead_code)]
    pub code: Option<Value>, // Code can be string or int
}

#[derive(Debug, Deserialize)]
pub struct FastAPIErrorDetail {
    pub msg: String,
    #[allow(dead_code)]
    pub r#type: String,
    // loc is usually a list of strings/ints
}
