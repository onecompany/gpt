//! Provider-specific usage parsing from resilient response types.
//!
//! This module extracts extended usage information from SSE stream responses
//! based on the detected provider. Each provider has unique fields that are
//! captured and converted to a unified `ExtendedTokenUsage` type.

use super::extended_usage::{
    CerebrasUsageExtension, DeepInfraUsageExtension, ExtendedTokenUsage, GroqUsageExtension,
    MistralUsageExtension, ProviderUsageExtension,
};
use super::provider::Provider;
use super::resilient_types::ResilientChatCompletionStreamResponse;
use gpt_types::domain::message::TokenUsage;

/// Parse extended usage from a resilient response based on provider.
///
/// Returns `None` if the response has no usage data.
/// Returns `Some(ExtendedTokenUsage)` with base usage and any provider-specific extensions.
///
/// For DeepInfra with reasoning content tracking, use `parse_extended_usage_with_reasoning` instead.
#[allow(dead_code)]
pub fn parse_extended_usage(
    response: &ResilientChatCompletionStreamResponse,
    provider: Provider,
) -> Option<ExtendedTokenUsage> {
    parse_extended_usage_with_reasoning(response, provider, 0)
}

/// Parse extended usage with accumulated reasoning content length.
///
/// Use this variant when you've been tracking reasoning content throughout the stream.
pub fn parse_extended_usage_with_reasoning(
    response: &ResilientChatCompletionStreamResponse,
    provider: Provider,
    reasoning_content_length: usize,
) -> Option<ExtendedTokenUsage> {
    let base_usage = response.usage.as_ref().map(|u| TokenUsage {
        prompt_tokens: u.prompt_tokens,
        completion_tokens: u.completion_tokens,
        total_tokens: u.total_tokens,
    })?;

    let extension = match provider {
        Provider::DeepInfra => ProviderUsageExtension::DeepInfra(DeepInfraUsageExtension {
            had_continuous_usage: response.usage.is_some(),
            reasoning_content_length,
        }),
        _ => {
            // For other providers, use standard parsing
            match provider {
                Provider::Mistral => parse_mistral_extension(response),
                Provider::Groq => parse_groq_extension(response),
                Provider::Cerebras => parse_cerebras_extension(response),
                _ => ProviderUsageExtension::None,
            }
        }
    };

    Some(ExtendedTokenUsage::with_extension(base_usage, extension))
}

/// Extract Mistral-specific usage extension.
///
/// Mistral includes `num_cached_tokens` in usage for prompt caching.
fn parse_mistral_extension(
    response: &ResilientChatCompletionStreamResponse,
) -> ProviderUsageExtension {
    let ext = response.usage.as_ref().and_then(|u| {
        // Only create extension if we have cached tokens data
        u.num_cached_tokens.map(|cached| MistralUsageExtension {
            num_cached_tokens: Some(cached),
        })
    });

    match ext {
        Some(e) => ProviderUsageExtension::Mistral(e),
        None => ProviderUsageExtension::Mistral(MistralUsageExtension::default()),
    }
}

/// Extract Groq-specific usage extension.
///
/// Groq includes timing data in the `x_groq` wrapper:
/// - queue_time: Time waiting in queue
/// - prompt_time: Time processing prompt
/// - completion_time: Time generating completion
/// - total_time: Total processing time
fn parse_groq_extension(
    response: &ResilientChatCompletionStreamResponse,
) -> ProviderUsageExtension {
    let ext = response.x_groq.as_ref().map(|x| {
        let usage = x.usage.as_ref();
        GroqUsageExtension {
            groq_request_id: x.id.clone(),
            queue_time: usage.and_then(|u| u.queue_time),
            prompt_time: usage.and_then(|u| u.prompt_time),
            completion_time: usage.and_then(|u| u.completion_time),
            total_time: usage.and_then(|u| u.total_time),
        }
    });

    match ext {
        Some(e) => ProviderUsageExtension::Groq(e),
        None => ProviderUsageExtension::Groq(GroqUsageExtension::default()),
    }
}

/// Extract Cerebras-specific usage extension.
///
/// Cerebras includes:
/// - completion_tokens_details.reasoning_tokens: Tokens used for reasoning
/// - prompt_tokens_details.cached_tokens: Cached prompt tokens
/// - time_info: Detailed timing breakdown
fn parse_cerebras_extension(
    response: &ResilientChatCompletionStreamResponse,
) -> ProviderUsageExtension {
    let usage = response.usage.as_ref();
    let time_info = response.time_info.as_ref();

    let ext = CerebrasUsageExtension {
        reasoning_tokens: usage
            .and_then(|u| u.completion_tokens_details.as_ref())
            .and_then(|d| d.reasoning_tokens),
        cached_prompt_tokens: usage
            .and_then(|u| u.prompt_tokens_details.as_ref())
            .and_then(|d| d.cached_tokens),
        queue_time: time_info.and_then(|t| t.queue_time),
        prompt_time: time_info.and_then(|t| t.prompt_time),
        completion_time: time_info.and_then(|t| t.completion_time),
        total_time: time_info.and_then(|t| t.total_time),
        created_timestamp: time_info.and_then(|t| t.created),
    };

    ProviderUsageExtension::Cerebras(ext)
}

/// Extract reasoning content from delta if present.
///
/// DeepInfra models like Kimi-K2-Thinking send chain-of-thought in `reasoning_content`.
pub fn extract_reasoning_content(
    response: &ResilientChatCompletionStreamResponse,
) -> Option<String> {
    response
        .choices
        .first()
        .and_then(|c| c.delta.reasoning_content.clone())
        .filter(|s| !s.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clients::ai_provider::resilient_types::{
        CerebrasTimeInfo, GroqExtension, GroqUsage, PromptTokenDetails, ResilientChatChoice,
        ResilientChatCompletionStreamResponseDelta, ResilientUsage, TokenDetails,
    };

    fn make_base_response() -> ResilientChatCompletionStreamResponse {
        ResilientChatCompletionStreamResponse {
            id: "test-id".to_string(),
            object: "chat.completion.chunk".to_string(),
            created: 1234567890,
            model: "test-model".to_string(),
            service_tier: None,
            system_fingerprint: None,
            choices: vec![ResilientChatChoice {
                index: 0,
                delta: ResilientChatCompletionStreamResponseDelta {
                    role: None,
                    content: None,
                    tool_calls: None,
                    #[allow(deprecated)]
                    function_call: None,
                    refusal: None,
                    reasoning_content: None,
                },
                finish_reason: Some("stop".to_string()),
                logprobs: None,
            }],
            usage: Some(ResilientUsage {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
                num_cached_tokens: None,
                completion_tokens_details: None,
                prompt_tokens_details: None,
            }),
            x_groq: None,
            time_info: None,
        }
    }

    #[test]
    fn test_parse_base_usage_openai() {
        let response = make_base_response();
        let extended = parse_extended_usage(&response, Provider::OpenAI).unwrap();

        assert_eq!(extended.base.prompt_tokens, 10);
        assert_eq!(extended.base.completion_tokens, 20);
        assert_eq!(extended.base.total_tokens, 30);
        assert!(matches!(extended.extension, ProviderUsageExtension::None));
    }

    #[test]
    fn test_parse_mistral_cached_tokens() {
        let mut response = make_base_response();
        response.usage.as_mut().unwrap().num_cached_tokens = Some(5);

        let extended = parse_extended_usage(&response, Provider::Mistral).unwrap();

        match extended.extension {
            ProviderUsageExtension::Mistral(ext) => {
                assert_eq!(ext.num_cached_tokens, Some(5));
            }
            _ => panic!("Expected Mistral extension"),
        }
    }

    #[test]
    fn test_parse_groq_timing() {
        let mut response = make_base_response();
        response.x_groq = Some(GroqExtension {
            id: Some("req_123".to_string()),
            usage: Some(GroqUsage {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
                queue_time: Some(0.05),
                prompt_time: Some(0.01),
                completion_time: Some(0.08),
                total_time: Some(0.09),
            }),
        });

        let extended = parse_extended_usage(&response, Provider::Groq).unwrap();

        match extended.extension {
            ProviderUsageExtension::Groq(ext) => {
                assert_eq!(ext.groq_request_id, Some("req_123".to_string()));
                assert_eq!(ext.queue_time, Some(0.05));
                assert_eq!(ext.total_time, Some(0.09));
            }
            _ => panic!("Expected Groq extension"),
        }
    }

    #[test]
    fn test_parse_cerebras_details() {
        let mut response = make_base_response();
        response.usage.as_mut().unwrap().completion_tokens_details = Some(TokenDetails {
            reasoning_tokens: Some(15),
        });
        response.usage.as_mut().unwrap().prompt_tokens_details = Some(PromptTokenDetails {
            cached_tokens: Some(3),
        });
        response.time_info = Some(CerebrasTimeInfo {
            queue_time: Some(0.001),
            prompt_time: Some(0.002),
            completion_time: Some(0.017),
            total_time: Some(0.031),
            created: Some(1234567890.5),
        });

        let extended = parse_extended_usage(&response, Provider::Cerebras).unwrap();

        match extended.extension {
            ProviderUsageExtension::Cerebras(ext) => {
                assert_eq!(ext.reasoning_tokens, Some(15));
                assert_eq!(ext.cached_prompt_tokens, Some(3));
                assert_eq!(ext.total_time, Some(0.031));
                assert_eq!(ext.created_timestamp, Some(1234567890.5));
            }
            _ => panic!("Expected Cerebras extension"),
        }
    }

    #[test]
    fn test_parse_deepinfra_with_reasoning() {
        let mut response = make_base_response();
        response.choices[0].delta.reasoning_content = Some("thinking...".to_string());

        let reasoning = extract_reasoning_content(&response);
        assert_eq!(reasoning, Some("thinking...".to_string()));

        let extended =
            parse_extended_usage_with_reasoning(&response, Provider::DeepInfra, 42).unwrap();

        match extended.extension {
            ProviderUsageExtension::DeepInfra(ext) => {
                assert!(ext.had_continuous_usage);
                assert_eq!(ext.reasoning_content_length, 42);
            }
            _ => panic!("Expected DeepInfra extension"),
        }
    }

    #[test]
    fn test_no_usage_returns_none() {
        let mut response = make_base_response();
        response.usage = None;

        let extended = parse_extended_usage(&response, Provider::OpenAI);
        assert!(extended.is_none());
    }

    #[test]
    fn test_extended_to_base_conversion() {
        let response = make_base_response();
        let extended = parse_extended_usage(&response, Provider::OpenAI).unwrap();

        let base: TokenUsage = extended.into();
        assert_eq!(base.prompt_tokens, 10);
        assert_eq!(base.completion_tokens, 20);
        assert_eq!(base.total_tokens, 30);
    }
}
