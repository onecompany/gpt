//! Extended usage types that capture provider-specific token and timing data.
//!
//! Each AI provider returns different additional data in their SSE stream responses.
//! This module defines types to capture all provider-specific information while
//! maintaining backward compatibility with the base `TokenUsage` type.

use gpt_types::domain::message::TokenUsage;
use serde::Serialize;

/// Mistral-specific usage data.
#[derive(Debug, Serialize, Clone, Default)]
pub struct MistralUsageExtension {
    /// Number of tokens served from Mistral's prompt cache.
    pub num_cached_tokens: Option<u32>,
}

/// Groq-specific timing and usage data from x_groq wrapper.
#[derive(Debug, Serialize, Clone, Default)]
pub struct GroqUsageExtension {
    /// Groq-specific request ID.
    pub groq_request_id: Option<String>,
    /// Time spent in queue before processing started (seconds).
    pub queue_time: Option<f64>,
    /// Time to process prompt tokens (seconds).
    pub prompt_time: Option<f64>,
    /// Time to generate completion tokens (seconds).
    pub completion_time: Option<f64>,
    /// Total processing time (seconds).
    pub total_time: Option<f64>,
}

/// Cerebras-specific detailed token breakdown and timing.
#[derive(Debug, Serialize, Clone, Default)]
pub struct CerebrasUsageExtension {
    /// Reasoning tokens within completion_tokens (for reasoning models).
    pub reasoning_tokens: Option<u32>,
    /// Cached tokens within prompt_tokens.
    pub cached_prompt_tokens: Option<u32>,
    /// Queue time before processing (seconds).
    pub queue_time: Option<f64>,
    /// Prompt processing time (seconds).
    pub prompt_time: Option<f64>,
    /// Completion generation time (seconds).
    pub completion_time: Option<f64>,
    /// Total time (seconds).
    pub total_time: Option<f64>,
    /// Unix timestamp when processing completed.
    pub created_timestamp: Option<f64>,
}

/// DeepInfra-specific extension.
#[derive(Debug, Serialize, Clone, Default)]
pub struct DeepInfraUsageExtension {
    /// Whether continuous usage stats were provided throughout the stream.
    pub had_continuous_usage: bool,
    /// Accumulated reasoning content length (for thinking models like Kimi).
    pub reasoning_content_length: usize,
}

/// Provider-specific usage extension data.
#[derive(Debug, Serialize, Clone)]
pub enum ProviderUsageExtension {
    /// No provider-specific extension data (OpenAI, OpenRouter, xAI, or unknown).
    None,
    /// Mistral-specific data.
    Mistral(MistralUsageExtension),
    /// Groq-specific timing data.
    Groq(GroqUsageExtension),
    /// Cerebras-specific token details and timing.
    Cerebras(CerebrasUsageExtension),
    /// DeepInfra-specific data.
    DeepInfra(DeepInfraUsageExtension),
}

impl Default for ProviderUsageExtension {
    fn default() -> Self {
        Self::None
    }
}

/// Extended token usage that includes base usage plus provider-specific data.
#[derive(Debug, Serialize, Clone)]
pub struct ExtendedTokenUsage {
    /// Standard usage (always available when usage is present).
    pub base: TokenUsage,
    /// Provider-specific extension data.
    pub extension: ProviderUsageExtension,
}

impl ExtendedTokenUsage {
    /// Create from base usage only (for providers without extensions).
    pub fn from_base(base: TokenUsage) -> Self {
        Self {
            base,
            extension: ProviderUsageExtension::None,
        }
    }

    /// Create with provider-specific extension.
    pub fn with_extension(base: TokenUsage, extension: ProviderUsageExtension) -> Self {
        Self { base, extension }
    }
}

impl From<ExtendedTokenUsage> for TokenUsage {
    fn from(extended: ExtendedTokenUsage) -> Self {
        extended.base
    }
}

impl AsRef<TokenUsage> for ExtendedTokenUsage {
    fn as_ref(&self) -> &TokenUsage {
        &self.base
    }
}
