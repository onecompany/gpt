//! # AI Provider Detection and Configuration
//!
//! This module handles provider-specific request building for OpenAI-compatible APIs.
//! Each provider has subtle differences in their API implementations that must be handled.
//!
//! ## Provider API Differences from OpenAI
//!
//! ### OpenAI (Default)
//! - **Token Limit**: `max_completion_tokens` (standard)
//! - **Stream Options**: Supports `stream_options.include_usage: true`
//! - **Reasoning**: `reasoning_effort` (low/medium/high) for o-series models
//! - **Tool Calling**: Standard `tools`, `tool_choice` (auto/none/required)
//! - **Endpoint**: `https://api.openai.com/v1`
//!
//! ### Mistral AI
//! - **Token Limit**: Uses `max_tokens` (NOT `max_completion_tokens`)
//! - **Stream Options**: NOT SUPPORTED (Only `stream: true`, usage sent in final data chunk implies standard SSE, but explicit `stream_options` object not listed in main spec)
//! - **Reasoning**: Uses `prompt_mode: "reasoning"` instead of `reasoning_effort`
//! - **Tool Calling**: `tool_choice` supports additional values: "any", "required"
//! - **Safety**: Has `safe_prompt: bool` for safety injection (default false)
//! - **Temperature**: Recommended range 0-0.7 (max 1.5)
//! - **Endpoint**: `https://api.mistral.ai/v1`
//!
//! ### Cerebras
//! - **Token Limit**: `max_completion_tokens` (same as OpenAI)
//! - **Stream Options**: Supports `stream_options.include_usage: true`
//! - **Reasoning**: `reasoning_effort` + `reasoning_format` (none/parsed/text_parsed/raw/hidden)
//! - **Tool Calling**: Standard, with `parallel_tool_calls: bool`
//! - **Endpoint**: `https://api.cerebras.ai/v1`
//!
//! ### Groq
//! - **Token Limit**: `max_completion_tokens` (preferred; `max_tokens` deprecated)
//! - **Stream Options**: SUPPORTED (`include_usage: true` sends an additional chunk before [DONE])
//! - **Reasoning**: `reasoning_effort` supported on specific models
//! - **Tool Calling**: Standard OpenAI-compatible
//! - **Endpoint**: `https://api.groq.com/openai/v1`
//!
//! ### DeepInfra
//! - **Token Limit**: `max_tokens` (OpenAI-compatible)
//! - **Stream Options**: Supports `stream_options` (`include_usage` and `continuous_usage_stats`)
//! - **Reasoning**: Model-dependent
//! - **Tool Calling**: Standard OpenAI-compatible
//! - **Endpoint**: `https://api.deepinfra.com/v1/openai`
//!
//! ### OpenRouter
//! - **Token Limit**: `max_tokens` (normalizes across providers)
//! - **Stream Options**: Limited support - varies by underlying provider
//! - **Endpoint**: `https://openrouter.ai/api/v1`
//!
//! ### xAI (Grok)
//! - **Token Limit**: Both `max_tokens` and `max_completion_tokens` work
//! - **Stream Options**: Supported
//! - **Restrictions**: Grok-4 doesn't support `presence_penalty`, `frequency_penalty`, `stop`
//! - **Endpoint**: `https://api.x.ai/v1`

use serde_json::Value;
use std::collections::HashMap;

/// Supported AI providers with OpenAI-compatible APIs.
/// Detection is based on the endpoint URL.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    /// OpenAI - The reference implementation.
    OpenAI,
    /// Mistral AI - Uses `max_tokens`, `prompt_mode` for reasoning.
    Mistral,
    /// Cerebras - High speed, supports `reasoning_format`.
    Cerebras,
    /// Groq - High speed, supports `stream_options`.
    Groq,
    /// DeepInfra - Hosts open weights, supports `continuous_usage_stats`.
    DeepInfra,
    /// OpenRouter - Aggregator.
    OpenRouter,
    /// xAI (Grok) - OpenAI-compatible.
    XAI,
}

impl Provider {
    /// Detect provider from endpoint URL (case-insensitive).
    pub fn from_endpoint(endpoint: &str) -> Self {
        let endpoint_lower = endpoint.to_lowercase();

        if endpoint_lower.contains("mistral") {
            Provider::Mistral
        } else if endpoint_lower.contains("cerebras") {
            Provider::Cerebras
        } else if endpoint_lower.contains("groq") {
            Provider::Groq
        } else if endpoint_lower.contains("deepinfra") {
            Provider::DeepInfra
        } else if endpoint_lower.contains("openrouter") {
            Provider::OpenRouter
        } else if endpoint_lower.contains("x.ai") {
            Provider::XAI
        } else {
            Provider::OpenAI
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            Provider::OpenAI => "OpenAI",
            Provider::Mistral => "Mistral",
            Provider::Cerebras => "Cerebras",
            Provider::Groq => "Groq",
            Provider::DeepInfra => "DeepInfra",
            Provider::OpenRouter => "OpenRouter",
            Provider::XAI => "xAI",
        }
    }
}

/// Provider-specific request configuration.
pub struct ProviderRequestConfig {
    /// Use `max_tokens` (true) vs `max_completion_tokens` (false).
    pub use_max_tokens: bool,

    /// Whether `stream_options.include_usage` is supported.
    pub supports_stream_options: bool,

    /// Provider-specific extra fields to merge into the request body.
    pub extra_fields: HashMap<String, Value>,
}

impl Provider {
    /// Get provider-specific request configuration.
    pub fn get_request_config(
        &self,
        is_reasoning_model: bool,
        reasoning_effort: Option<&str>,
        max_completion_tokens: u32,
    ) -> ProviderRequestConfig {
        match self {
            // OPENAI
            Provider::OpenAI => ProviderRequestConfig {
                use_max_tokens: false, // Uses max_completion_tokens
                supports_stream_options: true,
                extra_fields: HashMap::new(),
            },

            // MISTRAL - Uses max_tokens, prompt_mode
            Provider::Mistral => {
                let mut extra = HashMap::new();

                // Mistral uses `max_tokens`
                extra.insert(
                    "max_tokens".to_string(),
                    Value::Number(max_completion_tokens.into()),
                );

                // Mistral uses `prompt_mode: "reasoning"`
                if is_reasoning_model && reasoning_effort.is_some() {
                    extra.insert(
                        "prompt_mode".to_string(),
                        Value::String("reasoning".to_string()),
                    );
                }

                ProviderRequestConfig {
                    use_max_tokens: true,
                    // Mistral API spec for streaming is "data-only SSE".
                    // While they send usage at the end, they don't explicitly document
                    // the standard `stream_options` request object.
                    supports_stream_options: false,
                    extra_fields: extra,
                }
            }

            // CEREBRAS - Enhanced reasoning options
            Provider::Cerebras => {
                let mut extra = HashMap::new();

                if is_reasoning_model {
                    if let Some(effort) = reasoning_effort {
                        extra.insert(
                            "reasoning_effort".to_string(),
                            Value::String(effort.to_lowercase()),
                        );
                        // Cerebras supports: none, parsed, text_parsed, raw, hidden
                        // We default to 'parsed' to get structured thinking blocks
                        extra.insert(
                            "reasoning_format".to_string(),
                            Value::String("parsed".to_string()),
                        );
                    }
                }

                ProviderRequestConfig {
                    use_max_tokens: false, // Uses max_completion_tokens
                    supports_stream_options: true,
                    extra_fields: extra,
                }
            }

            // GROQ - Updated to support stream_options
            Provider::Groq => {
                // Groq uses `max_completion_tokens` (`max_tokens` deprecated)
                // Groq NOW supports `stream_options: { include_usage: true }`

                let mut extra = HashMap::new();

                // If reasoning is needed, Groq uses standard reasoning_effort
                // (though supported only on specific models like deepseek-r1-distill)
                if is_reasoning_model {
                    if let Some(effort) = reasoning_effort {
                        extra.insert(
                            "reasoning_effort".to_string(),
                            Value::String(effort.to_lowercase()),
                        );
                    }
                }

                ProviderRequestConfig {
                    use_max_tokens: false,
                    supports_stream_options: true,
                    extra_fields: extra,
                }
            }

            // DEEPINFRA - Uses max_tokens, requires continuous_usage_stats for usage data
            Provider::DeepInfra => {
                let mut extra = HashMap::new();

                // DeepInfra API docs explicitly list `max_tokens`
                extra.insert(
                    "max_tokens".to_string(),
                    Value::Number(max_completion_tokens.into()),
                );

                // DeepInfra requires both include_usage AND continuous_usage_stats to return
                // usage data in SSE streams. Without continuous_usage_stats, usage is null.
                // We add this as an extra_field since ChatCompletionStreamOptions doesn't
                // have the continuous_usage_stats field.
                let stream_options = serde_json::json!({
                    "include_usage": true,
                    "continuous_usage_stats": true
                });
                extra.insert("stream_options".to_string(), stream_options);

                ProviderRequestConfig {
                    use_max_tokens: true,
                    // Set to false - we handle stream_options via extra_fields for DeepInfra
                    // because we need continuous_usage_stats which isn't in the standard struct
                    supports_stream_options: false,
                    extra_fields: extra,
                }
            }

            // OPENROUTER - Aggregator (Uses max_tokens)
            Provider::OpenRouter => {
                let mut extra = HashMap::new();

                extra.insert(
                    "max_tokens".to_string(),
                    Value::Number(max_completion_tokens.into()),
                );

                ProviderRequestConfig {
                    use_max_tokens: true,
                    supports_stream_options: true,
                    extra_fields: extra,
                }
            }

            // XAI (GROK)
            Provider::XAI => {
                // xAI uses max_completion_tokens
                // Grok-4 ignores reasoning_effort, but we allow the builder to handle it
                ProviderRequestConfig {
                    use_max_tokens: false,
                    supports_stream_options: true,
                    extra_fields: HashMap::new(),
                }
            }
        }
    }
}
