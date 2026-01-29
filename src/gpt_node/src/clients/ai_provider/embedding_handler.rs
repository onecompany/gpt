//! Embedding request handler.
//!
//! This module handles embedding model requests, using the same streaming infrastructure
//! as chat completions but calling the embeddings API instead.

use crate::{
    core::error::NodeError,
    core::job::types::{OpenAIRequest, StreamedResponse},
    core::state::AppState,
};
use async_openai::types::embeddings::CreateEmbeddingRequestArgs;
use gpt_types::domain::message::TokenUsage;
use std::sync::atomic::Ordering;
use tokio::sync::broadcast;
use tracing::{info, instrument, warn};

use super::types::AIResponse;
use super::BROADCAST_CHANNEL_CAPACITY;

/// Process an embedding request.
///
/// Unlike chat completions, embeddings are not streamed. This function:
/// 1. Extracts the last user message as input text
/// 2. Calls the embedding API
/// 3. Broadcasts a single response with the embedding result as JSON
/// 4. Returns the embedding vector with usage information
///
/// Uses skip_all to prevent logging of input text content.
#[instrument(skip_all, fields(stream_key = %stream_key, provider_model = %state.provider_model))]
pub async fn process_embedding_request(
    request: OpenAIRequest,
    stream_key: String,
    state: &AppState,
) -> Result<AIResponse, NodeError> {
    info!(
        stream_key = %stream_key,
        provider_model = %state.provider_model,
        "Processing embedding request"
    );

    state.metrics.requests_total.fetch_add(1, Ordering::Relaxed);

    // Rate limiting
    if let Some(limiter) = &state.rate_limiter {
        limiter.until_ready().await;
    }

    // Acquire semaphore permit
    let _permit_guard = state
        .request_semaphore
        .clone()
        .acquire_owned()
        .await
        .map_err(|e| NodeError::Other(format!("Failed to acquire semaphore: {}", e)))?;

    // Get or create broadcast sender
    let tx = get_broadcast_sender(state, &stream_key).await;

    // Extract the last user message as embedding input
    let input_text = request
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.clone())
        .ok_or_else(|| {
            NodeError::Configuration("No user message found for embedding input.".to_string())
        })?;

    if input_text.is_empty() {
        return Err(NodeError::Configuration(
            "Empty user message for embedding input.".to_string(),
        ));
    }

    info!(
        stream_key = %stream_key,
        input_length = input_text.len(),
        "Building embedding request"
    );

    // Build embedding request
    let embedding_request = CreateEmbeddingRequestArgs::default()
        .model(&state.provider_model)
        .input(input_text)
        .build()
        .map_err(|e| NodeError::Configuration(format!("Failed to build embedding request: {}", e)))?;

    // Execute embedding request (non-streaming)
    let response = state
        .openai_client
        .embeddings()
        .create(embedding_request)
        .await
        .map_err(NodeError::Provider)?;

    // Extract embedding and usage
    let embedding = response
        .data
        .first()
        .ok_or_else(|| NodeError::Other("No embedding data returned from provider.".to_string()))?
        .embedding
        .clone();

    let usage = Some(TokenUsage {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: 0, // Embeddings don't have completion tokens
        total_tokens: response.usage.total_tokens,
    });

    info!(
        stream_key = %stream_key,
        embedding_dimensions = embedding.len(),
        prompt_tokens = response.usage.prompt_tokens,
        "Embedding request completed successfully"
    );

    // Serialize embedding as JSON for streaming response
    let embedding_json = serde_json::to_string(&embedding)
        .map_err(|e| NodeError::Other(format!("Failed to serialize embedding: {}", e)))?;

    // Broadcast the result
    let final_response = StreamedResponse {
        text: embedding_json.clone(),
        is_complete: true,
        error_status: None,
        usage: usage.clone(),
    };

    if let Err(e) = tx.send(final_response) {
        warn!(
            stream_key = %stream_key,
            error = %e,
            "Failed to broadcast embedding response (no listeners?)"
        );
    }

    // Update metrics
    state
        .metrics
        .requests_succeeded
        .fetch_add(1, Ordering::Relaxed);

    Ok(AIResponse::Embedding(embedding, usage))
}

async fn get_broadcast_sender(
    state: &AppState,
    stream_key: &str,
) -> broadcast::Sender<StreamedResponse> {
    let mut job_streams_lock = state.job_streams.lock().await;
    job_streams_lock
        .entry(stream_key.to_string())
        .or_insert_with(|| {
            info!(
                "Creating broadcast sender for embedding stream key: {}",
                stream_key
            );
            let (new_tx, _) = broadcast::channel::<StreamedResponse>(BROADCAST_CHANNEL_CAPACITY);
            new_tx
        })
        .clone()
}
