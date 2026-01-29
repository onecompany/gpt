use crate::{
    api::websocket::types::ConversationRequest,
    clients::ai_provider::{AIResponse, process_request},
    clients::canister::{
        conversation::{claim_job, complete_job},
        message::fetch_message,
    },
    core::error::{ErrorSeverity, NodeError, map_node_error_to_message_status},
    core::job::{
        context::JobProcessingContext,
        encryption::{decrypt_chat_key, decrypt_content, encrypt_content},
        types::{MessageData, OpenAIRequest},
    },
    core::state::SharedState,
    lifecycle,
};
use gpt_types::{
    api::{ClaimJobResponse, JobCompletionResult},
    domain::{Role, tool::Tool},
};
use ic_agent::{Agent, export::Principal};
use std::time::Duration;
use tracing::{Instrument, debug, error, info, info_span, instrument, warn};

#[instrument(
    skip_all,
    fields(
        job_id = request.job_id,
        user_canister = %request.user_canister_id
    )
)]
pub async fn handle_conversation_job(
    request: ConversationRequest,
    state: &SharedState,
    stream_key: String,
) -> Result<Vec<u8>, NodeError> {
    info!("Starting job handling");

    let prep_result = prepare_for_ai_processing(state, &request).await;

    match prep_result {
        Ok((user_canister, claim_resp, conversation_messages, tools, chat_key)) => {
            let context = JobProcessingContext {
                job_id: request.job_id,
                user_canister,
                claim_response: claim_resp,
                conversation_history: conversation_messages,
                tools,
                stream_key,
                chat_key: chat_key.clone(),
            };

            spawn_ai_processing_task(state.clone(), context);
            info!("Initial handling complete, background AI processing task spawned.");

            // Return the chat key to the connection handler for stream encryption
            Ok(chat_key)
        }
        Err(e) => Err(e),
    }
}

async fn prepare_for_ai_processing(
    state: &SharedState,
    request: &ConversationRequest,
) -> Result<
    (
        Principal,
        ClaimJobResponse,
        Vec<MessageData>,
        Option<Vec<Tool>>,
        Vec<u8>,
    ),
    NodeError,
> {
    let agent = &state.agent;
    let user_canister = Principal::from_text(&request.user_canister_id)
        .map_err(|e| NodeError::Configuration(format!("Invalid user_canister_id format: {e}")))?;

    info!("Attempting to claim job from user canister...");
    let claim_resp = match claim_job(agent, request.job_id, user_canister).await {
        Ok(resp) => {
            info!(
                chat_id = resp.chat.chat_id,
                job_id = resp.job.job_id,
                "Successfully claimed job."
            );
            resp
        }
        Err(e) => {
            error!(error = ?e, "Failed to claim job. Aborting.");
            let failure_status = map_node_error_to_message_status(&e);
            // Spawn task to log failure without blocking flow
            let agent_clone = agent.clone();
            let job_id = request.job_id;
            let user_canister_clone = user_canister;
            tokio::spawn(async move {
                mark_job_as_failed_and_log(
                    &agent_clone,
                    job_id,
                    user_canister_clone,
                    failure_status,
                )
                .await;
            });
            return Err(e);
        }
    };

    // 1. Decrypt the symmetric chat key
    let chat_key = if let Some(encrypted_key_b64) = &claim_resp.job.encrypted_chat_key {
        decrypt_chat_key(encrypted_key_b64, &state.node_x25519_identity).map_err(|e| {
            error!("Failed to decrypt chat key: {}", e);
            let failure_status = map_node_error_to_message_status(&NodeError::Attestation(
                "Decryption of chat key failed".to_string(),
            ));
            let agent_clone = agent.clone();
            let job_id = request.job_id;
            let user_canister_clone = user_canister;
            tokio::spawn(async move {
                mark_job_as_failed_and_log(
                    &agent_clone,
                    job_id,
                    user_canister_clone,
                    failure_status,
                )
                .await;
            });
            NodeError::Attestation(format!("Chat key decryption error: {}", e))
        })?
    } else {
        error!("Job missing encrypted_chat_key. Cannot process securely.");
        let failure_status = map_node_error_to_message_status(&NodeError::Configuration(
            "Missing encryption key".to_string(),
        ));
        let agent_clone = agent.clone();
        let job_id = request.job_id;
        let user_canister_clone = user_canister;
        tokio::spawn(async move {
            mark_job_as_failed_and_log(&agent_clone, job_id, user_canister_clone, failure_status)
                .await;
        });
        return Err(NodeError::Configuration(
            "Missing encrypted_chat_key".to_string(),
        ));
    };

    let tools = claim_resp.tools.clone();

    info!("Fetching conversation history...");
    let conversation_messages =
        match fetch_conversation_history(agent, &claim_resp, user_canister, &chat_key).await {
            Ok(messages) => {
                info!(
                    message_count = messages.len(),
                    "Successfully fetched and decrypted conversation history."
                );
                messages
            }
            Err(e) => {
                error!(error = ?e, "Failed to fetch history for job. Aborting.");
                // If the error is a decryption error, explicitly map it to configuration error
                // so the user sees something intelligible rather than generic retry.
                let failure_status = if e.to_string().contains("History decryption failed") {
                    gpt_types::error::MessageErrorStatus::ConfigurationError(
                        "Conversation history corrupted or decryption failed.".to_string(),
                    )
                } else {
                    map_node_error_to_message_status(&e)
                };

                let agent_clone = agent.clone();
                let job_id = request.job_id;
                let user_canister_clone = user_canister;
                tokio::spawn(async move {
                    mark_job_as_failed_and_log(
                        &agent_clone,
                        job_id,
                        user_canister_clone,
                        failure_status,
                    )
                    .await;
                });
                return Err(e);
            }
        };

    Ok((
        user_canister,
        claim_resp,
        conversation_messages,
        tools,
        chat_key,
    ))
}

fn spawn_ai_processing_task(state: SharedState, ctx: JobProcessingContext) {
    let span = info_span!(
        "ai_processing",
        job_id = ctx.job_id,
        user_canister = %ctx.user_canister
    );

    tokio::spawn(
        async move {
            // Unpack context for use
            let job = &ctx.claim_response.job;
            let openai_req = OpenAIRequest {
                messages: ctx.conversation_history,
                max_completion_tokens: job.max_completion_tokens,
                temperature: job.temperature,
                max_context: job.max_context,
                tools: ctx.tools,
                extra_body_json: job.extra_body_json.clone(),
                reasoning_effort: job.reasoning_effort.clone(),
            };
            let custom_prompt = job.custom_prompt.clone();
            let stream_key = ctx.stream_key.clone();

            info!(
                max_tokens = openai_req.max_completion_tokens,
                temperature = openai_req.temperature,
                has_extra_json = openai_req.extra_body_json.is_some(),
                reasoning_effort = ?openai_req.reasoning_effort,
                "Starting AI processing with provider"
            );

            let processing_result =
                process_request(openai_req, stream_key.clone(), &state, custom_prompt).await;

            let (completion_payload, usage) = match processing_result {
                Ok(AIResponse::Text(text_response, usage)) => {
                    info!(
                        response_len = text_response.len(),
                        "AI processing finished with a text response."
                    );
                    // Encrypt the response before sending to canister
                    match encrypt_content(&text_response, &ctx.chat_key) {
                        Ok(encrypted_bytes) => {
                            (JobCompletionResult::Success(encrypted_bytes), usage)
                        }
                        Err(e) => {
                            error!("Failed to encrypt response text: {}", e);
                            (
                                JobCompletionResult::Failure(
                                    gpt_types::error::MessageErrorStatus::Unknown(
                                        "Encryption failed".to_string(),
                                    ),
                                ),
                                None,
                            )
                        }
                    }
                }
                Ok(AIResponse::ToolCall(api_tool_calls, usage)) => {
                    info!(
                        num_tool_calls = api_tool_calls.len(),
                        "AI processing finished with tool calls."
                    );
                    let gpt_tool_calls = api_tool_calls
                        .into_iter()
                        .map(|tc| gpt_types::domain::tool::ToolCall {
                            id: tc.id,
                            r#type: "function".to_string(),
                            function: gpt_types::domain::tool::FunctionCall {
                                name: tc.function.name,
                                arguments: tc.function.arguments,
                            },
                        })
                        .collect();
                    (JobCompletionResult::ToolCall(gpt_tool_calls), usage)
                }
                Err(ref node_err) => {
                    let severity = node_err.severity();
                    error!(error = ?node_err, ?severity, "AI processing failed.");

                    // Check for terminal errors to trigger node shutdown
                    if matches!(severity, ErrorSeverity::Terminal) {
                        let reason = node_err.to_string();
                        let state_clone = state.clone();
                        // Spawn detached task to handle shutdown so we don't block the job completion response
                        tokio::spawn(async move {
                            // Wait briefly to allow the job completion HTTP call below to flush to the network
                            tokio::time::sleep(Duration::from_millis(1000)).await;
                            lifecycle::initiate_fatal_shutdown(state_clone, reason).await;
                        });
                    }

                    (
                        JobCompletionResult::Failure(map_node_error_to_message_status(node_err)),
                        None,
                    )
                }
            };

            info!("Attempting to complete job on user canister...");
            if let Err(e) = complete_job(
                &state.agent,
                ctx.job_id,
                completion_payload,
                ctx.user_canister,
                usage,
            )
            .await
            {
                error!(
                    error = ?e,
                    "CRITICAL: Failed to call complete_job on canister."
                );
            } else {
                info!("Successfully called complete_job.");
            }

            state.job_streams.lock().await.remove(&stream_key);
            info!("Cleaned up job stream broadcast sender.");
        }
        .instrument(span),
    );
}

async fn fetch_conversation_history(
    agent: &Agent,
    claim_resp: &ClaimJobResponse,
    user_canister: Principal,
    chat_key: &[u8],
) -> Result<Vec<MessageData>, NodeError> {
    let mut messages = Vec::new();
    for msg_id in &claim_resp.message_chain_ids {
        match fetch_message(agent, *msg_id, claim_resp.chat.chat_id, user_canister).await {
            Ok(Some(message)) => {
                if message.error_status.is_some() {
                    warn!(
                        message_id = msg_id,
                        error = ?message.error_status,
                        "Skipping message in history due to previous error."
                    );
                    continue;
                }

                // Decrypt content if it exists
                let decrypted_content = if !message.content.is_empty() {
                    decrypt_content(&message.content, chat_key).map_err(|e| {
                        error!("Failed to decrypt history message {}: {}", msg_id, e);
                        NodeError::Attestation("History decryption failed".to_string())
                    })?
                } else {
                    String::new()
                };

                let final_content = match message.role {
                    Role::Assistant => strip_reasoning(&decrypted_content),
                    _ => decrypted_content,
                };

                let msg_data = MessageData {
                    role: match message.role {
                        Role::System => "system".to_string(),
                        Role::User => "user".to_string(),
                        Role::Assistant => "assistant".to_string(),
                        Role::Tool => "tool".to_string(),
                    },
                    content: final_content,
                    attachments: message.attachments,
                    tool_calls: message.tool_calls.map(|tcs| {
                        tcs.into_iter()
                            .map(|tc| crate::core::job::types::ToolCall {
                                id: tc.id,
                                _type: tc.r#type,
                                function: crate::core::job::types::FunctionCall {
                                    name: tc.function.name,
                                    arguments: tc.function.arguments,
                                },
                            })
                            .collect()
                    }),
                    tool_call_id: message.tool_call_id,
                };

                debug!(
                    role = %msg_data.role,
                    content_len = msg_data.content.len(),
                    num_attachments = msg_data.attachments.as_ref().map_or(0, |a| a.len()),
                    num_tool_calls = msg_data.tool_calls.as_ref().map_or(0, |t| t.len()),
                    "Adding message to conversation history."
                );
                messages.push(msg_data);
            }
            Ok(None) => warn!(
                message_id = msg_id,
                "Message not found during history fetch. Skipping."
            ),
            Err(e) => return Err(e),
        }
    }
    Ok(messages)
}

async fn mark_job_as_failed_and_log(
    agent: &Agent,
    job_id: u64,
    user_canister: Principal,
    failure_status: gpt_types::error::MessageErrorStatus,
) {
    info!(?failure_status, "Marking job as failed on canister.");
    let payload = JobCompletionResult::Failure(failure_status);
    if let Err(e) = complete_job(agent, job_id, payload, user_canister, None).await {
        error!(
            error = ?e,
            "Further error trying to mark job as failed."
        );
    } else {
        info!("Successfully marked job as failed after initial error.");
    }
}

fn find_case_insensitive(haystack: &str, needle: &str) -> Option<usize> {
    haystack
        .as_bytes()
        .windows(needle.len())
        .position(|window| window.eq_ignore_ascii_case(needle.as_bytes()))
}

fn strip_reasoning(content: &str) -> String {
    let start_tag = "<think>";
    let end_tag = "</think>";
    let mut processed_content = content.to_string();

    loop {
        let start_pos = find_case_insensitive(&processed_content, start_tag);
        let end_pos = find_case_insensitive(&processed_content, end_tag);

        if let (Some(start), Some(end)) = (start_pos, end_pos) {
            if end > start {
                let remove_end = end + end_tag.len();
                processed_content.drain(start..remove_end);
            } else {
                break;
            }
        } else {
            break;
        }
    }

    processed_content.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_reasoning_basic() {
        let input = "<think>Some reasoning here.</think> This is the real response.";
        let expected = "This is the real response.";
        assert_eq!(strip_reasoning(input), expected);
    }

    #[test]
    fn test_strip_reasoning_with_whitespace() {
        let input = " \n <think>\nAnother thought.\n</think> \n  The actual content.";
        let expected = "The actual content.";
        assert_eq!(strip_reasoning(input), expected);
    }

    #[test]
    fn test_strip_reasoning_no_tag() {
        let input = "This is just a regular response.";
        assert_eq!(strip_reasoning(input), input);
    }

    #[test]
    fn test_strip_reasoning_only_tag() {
        let input = "<think>All reasoning, no response.</think>";
        assert_eq!(strip_reasoning(input), "");
    }

    #[test]
    fn test_strip_multiple_reasoning_tags() {
        let input =
            "<think>First thought.</think>Some text. <think>Second thought.</think>More text.";
        let expected = "Some text. More text.";
        assert_eq!(strip_reasoning(input), expected);
    }

    #[test]
    fn test_strip_reasoning_case_insensitive() {
        let input = "<THINK>Case matters not.</THINK> The Force is with you.";
        let expected = "The Force is with you.";
        assert_eq!(strip_reasoning(input), expected);
    }

    #[test]
    fn test_strip_reasoning_unclosed_tag() {
        let input = "<think>This reasoning is never closed.";
        assert_eq!(
            strip_reasoning(input),
            input.trim(),
            "Should not strip content if tag is not closed."
        );
    }

    #[test]
    fn test_strip_reasoning_nested_tags() {
        let input = "<think>outer<think>inner</think></think> and then the result.";
        // This test documents the current, simple behavior. It finds the first <think> and the first </think>
        // and removes everything between them. The trim then cleans up the rest.
        let expected = "</think> and then the result.";
        assert_eq!(strip_reasoning(input), expected);
    }

    #[test]
    fn test_strip_reasoning_empty_tag() {
        let input = "<think></think>Some text.";
        let expected = "Some text.";
        assert_eq!(
            strip_reasoning(input),
            expected,
            "Should correctly strip an empty reasoning block."
        );
    }
}
