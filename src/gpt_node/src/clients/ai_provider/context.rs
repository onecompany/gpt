use crate::core::job::types::{MessageData, TokenizedMessage};

const TOKENS_PER_IMAGE: u32 = 1000;
const TOKENS_PER_TOOL_CALL: u32 = 10;

fn count_tokens(text: &str) -> u32 {
    ((text.chars().count() as f64) / 4.0).ceil() as u32
}

pub(super) fn prepare_context(
    messages: &[MessageData],
    max_context_tokens: u32,
) -> Vec<TokenizedMessage> {
    let tokenized: Vec<TokenizedMessage> = messages
        .iter()
        .map(|msg| {
            let text_token_count = count_tokens(&msg.content);
            let image_token_count = msg
                .attachments
                .as_ref()
                .map_or(0, |v| (v.len() as u32) * TOKENS_PER_IMAGE);
            let tool_calls_token_count = msg.tool_calls.as_ref().map_or(0, |calls| {
                calls
                    .iter()
                    .map(|call| {
                        TOKENS_PER_TOOL_CALL
                            + count_tokens(&call.function.name)
                            + count_tokens(&call.function.arguments)
                    })
                    .sum()
            });

            TokenizedMessage {
                role: msg.role.clone(),
                content: msg.content.clone(),
                token_count: text_token_count + image_token_count + tool_calls_token_count,
                attachments: msg.attachments.clone(),
                tool_calls: msg.tool_calls.clone(),
                tool_call_id: msg.tool_call_id.clone(),
            }
        })
        .collect();

    let total_tokens: u32 = tokenized.iter().map(|m| m.token_count).sum();

    if total_tokens <= max_context_tokens {
        return tokenized;
    }

    let mut final_messages = Vec::new();
    let mut kept_messages = Vec::new();
    let mut current_tokens = 0u32;

    let (system_messages, other_messages): (Vec<_>, Vec<_>) =
        tokenized.into_iter().partition(|m| m.role == "system");

    for msg in system_messages {
        current_tokens += msg.token_count;
        final_messages.push(msg);
    }

    for msg in other_messages.into_iter().rev() {
        if current_tokens + msg.token_count <= max_context_tokens {
            current_tokens += msg.token_count;
            kept_messages.push(msg);
        } else {
            // This message doesn't fit, so we stop here.
            break;
        }
    }

    kept_messages.reverse();
    final_messages.extend(kept_messages);

    final_messages
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::job::types::{FunctionCall, MessageData, ToolCall};
    use gpt_types::domain::message::ImageAttachment;

    // Default impl for easier test struct creation
    impl Default for MessageData {
        fn default() -> Self {
            MessageData {
                role: "user".to_string(),
                content: "".to_string(),
                attachments: None,
                tool_calls: None,
                tool_call_id: None,
            }
        }
    }

    #[test]
    fn test_prepare_context_no_truncation() {
        let messages = vec![
            MessageData {
                role: "system".to_string(),
                content: "System prompt".to_string(),
                ..Default::default()
            },
            MessageData {
                role: "user".to_string(),
                content: "Hello".to_string(),
                ..Default::default()
            },
        ];
        let prepared = prepare_context(&messages, 100);
        assert_eq!(prepared.len(), 2);
    }

    #[test]
    fn test_prepare_context_with_truncation() {
        let messages = vec![
            MessageData {
                role: "system".to_string(),
                content: "This is a very long system prompt that takes up a lot of space."
                    .to_string(), // 16 tokens
                ..Default::default()
            },
            MessageData {
                role: "user".to_string(),
                content: "This is the first user message, which should be truncated.".to_string(), // 15 tokens
                ..Default::default()
            },
            MessageData {
                role: "user".to_string(),
                content: "This is the second, most recent user message, which should be kept."
                    .to_string(), // 18 tokens
                ..Default::default()
            },
        ];
        // Total tokens: 16 + 15 + 18 = 49.
        // Limit of 34 should keep system (16) and the most recent message (18). Total = 34.
        let prepared = prepare_context(&messages, 34);
        assert_eq!(prepared.len(), 2);
        assert_eq!(prepared[0].role, "system");
        assert!(prepared[1].content.contains("second, most recent"));
    }

    #[test]
    fn test_truncation_only_user_messages() {
        let messages = vec![
            MessageData {
                role: "user".to_string(),
                content: "Old message 1".to_string(), // 4 tokens
                ..Default::default()
            },
            MessageData {
                role: "user".to_string(),
                content: "Old message 2".to_string(), // 4 tokens
                ..Default::default()
            },
            MessageData {
                role: "user".to_string(),
                content: "Recent message".to_string(), // 4 tokens
                ..Default::default()
            },
        ];
        // Total tokens: 4 + 4 + 4 = 12. Limit is 8.
        // Should keep the last two messages.
        let prepared = prepare_context(&messages, 8);
        assert_eq!(prepared.len(), 2);
        assert!(prepared[0].content.contains("Old message 2"));
        assert!(prepared[1].content.contains("Recent message"));
    }

    #[test]
    fn test_prepare_context_with_image_tokens() {
        let messages = vec![
            MessageData {
                role: "user".to_string(),
                content: "Old message".to_string(), // 3 tokens
                ..Default::default()
            },
            MessageData {
                role: "user".to_string(),
                content: "Recent message with image".to_string(), // 6 tokens
                attachments: Some(vec![ImageAttachment {
                    mime_type: "image/png".to_string(),
                    data: vec![],
                }]), // +1000 tokens
                ..Default::default()
            },
        ];
        // Total tokens: 3 + 6 + 1000 = 1009. Limit = 1007.
        let prepared = prepare_context(&messages, 1007);
        assert_eq!(
            prepared.len(),
            1,
            "Should truncate the old message due to image cost"
        );
        assert!(prepared[0].content.contains("Recent message with image"));
    }

    #[test]
    fn test_prepare_context_with_tool_call_tokens() {
        let messages = vec![
            MessageData {
                role: "user".to_string(),
                content: "This message should be dropped".to_string(), // 7 tokens
                ..Default::default()
            },
            MessageData {
                role: "assistant".to_string(),
                content: "".to_string(),
                tool_calls: Some(vec![ToolCall {
                    id: "call_123".to_string(),
                    _type: "function".to_string(),
                    function: FunctionCall {
                        name: "get_weather".to_string(), // 3 tokens
                        arguments: "{\"location\": \"San Francisco\"}".to_string(), // 7 tokens
                    },
                }]), // 10 (base) + 3 + 7 = 20 tokens
                ..Default::default()
            },
        ];
        // Total tokens: 7 + 20 = 27. Limit is 21. Should keep only the tool call message.
        let prepared = prepare_context(&messages, 21);
        assert_eq!(
            prepared.len(),
            1,
            "Should truncate the old message due to tool call cost"
        );
        assert_eq!(prepared[0].role, "assistant");
    }

    #[test]
    fn test_prepare_context_empty_input() {
        let messages = vec![];
        let prepared = prepare_context(&messages, 100);
        assert!(prepared.is_empty());
    }

    #[test]
    fn test_prepare_context_limit_smaller_than_system_prompt() {
        let messages = vec![
            MessageData {
                role: "system".to_string(),
                content: "This is a long system prompt.".to_string(), // 6 tokens
                ..Default::default()
            },
            MessageData {
                role: "user".to_string(),
                content: "A user message.".to_string(),
                ..Default::default()
            },
        ];
        let prepared = prepare_context(&messages, 5); // Limit is less than system prompt
        assert_eq!(prepared.len(), 1);
        assert_eq!(prepared[0].role, "system");
    }

    #[test]
    fn test_prepare_context_single_large_message() {
        let messages = vec![
            MessageData {
                role: "system".to_string(),
                content: "Sys".to_string(),
                ..Default::default()
            }, // 1 token
            MessageData {
                role: "user".to_string(),
                content: "This user message is far too long to fit.".to_string(),
                ..Default::default()
            }, // 9 tokens
        ];
        let prepared = prepare_context(&messages, 5); // Limit allows system but not user message
        assert_eq!(prepared.len(), 1);
        assert_eq!(prepared[0].role, "system");
    }
}
