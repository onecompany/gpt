use crate::{
    core::error::{NodeError, map_node_error_to_message_status},
    clients::ai_provider::{AIResponse, resilient_types::ResilientChatCompletionStreamResponse, types::ExtendedChatCompletionRequest},
    core::job::types::StreamedResponse,
};
use async_openai::{
    Client,
    config::OpenAIConfig,
    error::OpenAIError,
    types::chat::{
        ChatCompletionMessageToolCall, ChatCompletionMessageToolCallChunk, FinishReason,
        FunctionCall,
    },
};
use futures::{Stream, StreamExt};
use gpt_types::domain::message::TokenUsage;
use std::{
    collections::BTreeMap,
    pin::Pin,
    time::{Duration, Instant},
};
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

const MAX_STREAMING_RETRIES: u32 = 3;
const STREAMING_RETRY_DELAY_MS: u64 = 1000;

type ChatResponseStream =
    Pin<Box<dyn Stream<Item = Result<ResilientChatCompletionStreamResponse, OpenAIError>> + Send>>;

pub(super) async fn handle_stream(
    client: &Client<OpenAIConfig>,
    req: ExtendedChatCompletionRequest,
    stream_key: &str,
    tx: broadcast::Sender<StreamedResponse>,
) -> Result<AIResponse, NodeError> {
    info!(stream_key, "Initializing provider stream.");
    let stream = initialize_stream_with_retry(client, req, stream_key).await?;
    info!(stream_key, "Stream initialized, beginning processing.");
    process_stream(stream, stream_key.to_string(), tx).await
}

async fn process_stream(
    mut stream: ChatResponseStream,
    stream_key: String,
    tx: broadcast::Sender<StreamedResponse>,
) -> Result<AIResponse, NodeError> {
    let start_time = Instant::now();
    let mut full_response_text = String::new();
    let mut final_node_error: Option<NodeError> = None;
    let mut tool_calls_aggregator: BTreeMap<u32, ChatCompletionMessageToolCall> = BTreeMap::new();
    let mut final_finish_reason: Option<FinishReason> = None;
    let mut final_usage: Option<TokenUsage> = None;
    let mut chunk_count = 0;

    while let Some(chunk_result) = stream.next().await {
        chunk_count += 1;
        match handle_stream_chunk(
            chunk_result,
            &mut full_response_text,
            &mut tool_calls_aggregator,
            &tx,
            &stream_key,
            &mut final_usage,
        ) {
            Ok(Some(finish_reason)) => {
                final_finish_reason = Some(finish_reason);
            }
            Ok(None) => continue,
            Err(e) => {
                final_node_error = Some(e);
                break;
            }
        }
    }

    let elapsed = start_time.elapsed();
    info!(
        stream_key,
        duration_ms = elapsed.as_millis(),
        chunks_processed = chunk_count,
        finish_reason = ?final_finish_reason,
        has_error = final_node_error.is_some(),
        has_usage = final_usage.is_some(),
        "Stream processing finished."
    );

    let final_payload = if let Some(ref err) = final_node_error {
        StreamedResponse {
            text: String::new(),
            is_complete: true,
            error_status: Some(map_node_error_to_message_status(err)),
            usage: None,
        }
    } else {
        StreamedResponse {
            text: full_response_text.clone(),
            is_complete: true,
            error_status: None,
            usage: final_usage.clone(),
        }
    };

    // Ensure final message is sent even if previous chunks failed to send
    if tx.receiver_count() > 0 {
        if let Err(e) = tx.send(final_payload) {
            warn!(
                stream_key,
                error = %e,
                "Final broadcast failed (client likely disconnected)."
            );
        } else {
            debug!(
                stream_key,
                "Final completion/error message broadcast successfully."
            );
        }
    }

    if let Some(err) = final_node_error {
        Err(err)
    } else if !tool_calls_aggregator.is_empty() {
        let final_tool_calls: Vec<ChatCompletionMessageToolCall> =
            tool_calls_aggregator.into_values().collect();
        info!(
            stream_key,
            num_tool_calls = final_tool_calls.len(),
            "Aggregated tool calls. Returning structured AIResponse::ToolCall."
        );
        Ok(AIResponse::ToolCall(final_tool_calls, final_usage))
    } else {
        info!(
            stream_key,
            response_len_chars = full_response_text.len(),
            "No tool calls. Returning final aggregated text as AIResponse::Text."
        );
        Ok(AIResponse::Text(full_response_text, final_usage))
    }
}

// Helper to map string finish reasons from resilient response to strict enum
fn parse_finish_reason(reason: Option<String>) -> Option<FinishReason> {
    match reason?.as_str() {
        "stop" => Some(FinishReason::Stop),
        "length" => Some(FinishReason::Length),
        "tool_calls" => Some(FinishReason::ToolCalls),
        "content_filter" => Some(FinishReason::ContentFilter),
        "function_call" => Some(FinishReason::FunctionCall),
        _ => None,
    }
}

fn handle_stream_chunk(
    chunk_result: Result<ResilientChatCompletionStreamResponse, OpenAIError>,
    full_response_text: &mut String,
    tool_calls_aggregator: &mut BTreeMap<u32, ChatCompletionMessageToolCall>,
    tx: &broadcast::Sender<StreamedResponse>,
    stream_key: &str,
    final_usage: &mut Option<TokenUsage>,
) -> Result<Option<FinishReason>, NodeError> {
    match chunk_result {
        Ok(response) => {
            if let Some(usage) = response.usage {
                *final_usage = Some(TokenUsage::from(usage));
                debug!(
                    stream_key,
                    ?final_usage,
                    "Captured token usage from stream."
                );
            }

            // service_tier is ignored here (tolerated via ResilientChatCompletionStreamResponse)

            let mut finish_reason = None;
            for choice in response.choices {
                if let Some(content) = choice.delta.content.as_ref().filter(|c| !c.is_empty()) {
                    full_response_text.push_str(content);
                    let streamed_response = StreamedResponse {
                        text: full_response_text.clone(),
                        is_complete: false,
                        error_status: None,
                        usage: None,
                    };
                    // Use send, ignoring error if no receivers (optimistic broadcast)
                    let _ = tx.send(streamed_response);
                }

                if let Some(tool_calls_delta) = &choice.delta.tool_calls {
                    process_tool_calls_delta(tool_calls_delta, tool_calls_aggregator);
                }

                if let Some(reason) = parse_finish_reason(choice.finish_reason) {
                    finish_reason = Some(reason);
                }
            }
            Ok(finish_reason)
        }
        Err(e) => {
            error!(
                stream_key,
                error = %e,
                "Error receiving chunk from provider stream."
            );
            // Log the raw error details if available for debugging provider issues
            if let OpenAIError::JSONDeserialize(ref json_err, ref content) = e {
                warn!(
                    stream_key,
                    json_error = %json_err,
                    content = %content,
                    "Provider sent invalid JSON or error payload"
                );
            }
            let node_err = NodeError::from(e);
            Err(node_err)
        }
    }
}

fn process_tool_calls_delta(
    tool_calls_delta: &[ChatCompletionMessageToolCallChunk],
    tool_calls_aggregator: &mut BTreeMap<u32, ChatCompletionMessageToolCall>,
) {
    for tc_delta in tool_calls_delta {
        let entry = tool_calls_aggregator
            .entry(tc_delta.index)
            .or_insert_with(|| ChatCompletionMessageToolCall {
                id: tc_delta.id.clone().unwrap_or_default(),
                function: FunctionCall {
                    name: "".to_string(),
                    arguments: "".to_string(),
                },
            });

        if let Some(id) = &tc_delta.id {
            entry.id.clone_from(id);
        }
        if let Some(function) = &tc_delta.function {
            if let Some(name) = &function.name {
                entry.function.name.push_str(name);
            }
            if let Some(args) = &function.arguments {
                entry.function.arguments.push_str(args);
            }
        }
    }
}

async fn initialize_stream_with_retry(
    client: &Client<OpenAIConfig>,
    req: ExtendedChatCompletionRequest,
    stream_key: &str,
) -> Result<ChatResponseStream, NodeError> {
    for attempt in 1..=MAX_STREAMING_RETRIES {
        debug!(
            attempt,
            max_retries = MAX_STREAMING_RETRIES,
            stream_key,
            "Creating OpenAI streaming request"
        );

        match client
            .chat()
            .create_stream_byot::<ExtendedChatCompletionRequest, ResilientChatCompletionStreamResponse>(
                req.clone(),
            )
            .await
        {
            Ok(stream) => {
                info!(
                    attempt,
                    stream_key, "Successfully established provider stream"
                );
                return Ok(stream);
            }
            Err(e) => {
                let node_err = NodeError::from(e);
                if attempt >= MAX_STREAMING_RETRIES || !is_retryable_node_error(&node_err) {
                    let reason = if !is_retryable_node_error(&node_err) {
                        "non-retryable error"
                    } else {
                        "max retries reached"
                    };
                    error!(
                        stream_key,
                        error = %node_err,
                        reason,
                        "Failing stream initialization"
                    );
                    return Err(node_err);
                }
                warn!(
                    stream_key,
                    attempt,
                    error = %node_err,
                    delay_ms = STREAMING_RETRY_DELAY_MS,
                    "Retryable error initializing stream, retrying..."
                );
                tokio::time::sleep(Duration::from_millis(STREAMING_RETRY_DELAY_MS)).await;
            }
        }
    }
    unreachable!("Loop should have returned or errored.")
}

fn is_retryable_node_error(err: &NodeError) -> bool {
    match err {
        NodeError::Provider(OpenAIError::Reqwest(rq_err)) => {
            rq_err.is_timeout()
                || rq_err.is_connect()
                || rq_err
                    .status()
                    .is_some_and(|s| s.is_server_error() || s.as_u16() == 429)
        }
        NodeError::Provider(OpenAIError::StreamError(_)) => {
            // Boxed stream error implies connection drop or parsing issue, generally retryable
            true
        }
        NodeError::Provider(OpenAIError::ApiError(api_error)) => {
            let type_str = api_error.r#type.as_deref();
            let code_str = api_error.code.as_deref();
            type_str == Some("server_error")
                || type_str == Some("service_unavailable")
                || type_str == Some("rate_limit_exceeded")
                || code_str.is_some_and(|c| c == "429" || c.starts_with('5'))
        }
        NodeError::Timeout(_) | NodeError::Network(_) => true,
        NodeError::Agent(agent_err) => {
            matches!(agent_err, ic_agent::AgentError::TimeoutWaitingForResponse())
        }
        _ => false,
    }
}
