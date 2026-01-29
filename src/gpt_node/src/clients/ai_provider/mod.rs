//! AI provider client module.
//!
//! This module handles communication with AI providers (OpenAI and compatible APIs).
//! It includes:
//! - Request building with provider-specific configurations
//! - SSE stream handling with provider-specific response parsing
//! - Extended usage extraction for provider-specific metrics
//! - Broadcast channel management for WebSocket streaming

mod context;
mod embedding_handler;
mod extended_usage;
mod provider;
mod request_builder;
pub(crate) mod resilient_types;
mod stream_handler;
mod types;
mod usage_parser;

use crate::{
    core::error::{map_node_error_to_message_status, NodeError},
    core::job::types::{OpenAIRequest, StreamedResponse},
    core::state::AppState,
};
pub use types::AIResponse;

use provider::Provider;
use std::{sync::atomic::Ordering, time::Instant};
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

pub const BROADCAST_CHANNEL_CAPACITY: usize = 100;
const TOKEN_ESTIMATION_FACTOR: f64 = 4.0;

/// Processes an AI provider request (OpenAI or compatible endpoint).
///
/// This function:
/// 1. Detects the provider from the model endpoint
/// 2. Builds a provider-specific request
/// 3. Handles streaming responses with provider-specific parsing
/// 4. Returns the final response with usage information
pub async fn process_request(
    request: OpenAIRequest,
    stream_key: String,
    state: &AppState,
    custom_prompt: Option<String>,
) -> Result<AIResponse, NodeError> {
    info!(
        "Processing OpenAI request; provider_model: {}, stream_key: {}, custom_prompt provided: {}",
        state.provider_model,
        stream_key,
        custom_prompt.is_some()
    );

    let request_start_time = Instant::now();
    update_peak_concurrency(state);

    if let Some(limiter) = &state.rate_limiter {
        debug!("Applying rate limiting for stream key: {}", stream_key);
        limiter.until_ready().await;
    }

    let _permit_guard = match state.request_semaphore.clone().acquire_owned().await {
        Ok(permit) => {
            debug!("Semaphore permit acquired for stream key: {}", stream_key);
            permit
        }
        Err(e) => {
            let err_msg = format!("Failed to acquire semaphore permit: {}", e);
            error!("{}", err_msg);
            state.metrics.requests_total.fetch_add(1, Ordering::Relaxed);
            return Err(NodeError::Other(err_msg));
        }
    };

    let tx = get_broadcast_sender(state, &stream_key).await;

    // Detect provider from endpoint for provider-specific handling
    let model_details = state.get_model_details().await.map_err(|e| {
        warn!(error = ?e, "Could not fetch model details from state.");
        NodeError::Configuration("Could not retrieve model details.".to_string())
    })?;

    // Route embedding models to the embedding handler
    if model_details.is_embedding {
        info!(
            stream_key = %stream_key,
            model_id = %model_details.model_id,
            "Routing to embedding handler for embedding model."
        );
        return embedding_handler::process_embedding_request(request, stream_key, state).await;
    }

    let provider = Provider::from_endpoint(&model_details.provider_endpoint);
    info!(
        provider = %provider.name(),
        endpoint = %model_details.provider_endpoint,
        stream_key = %stream_key,
        "Detected AI provider for stream handling."
    );

    let openai_request = match request_builder::build_request(
        &request,
        state,
        custom_prompt,
        &stream_key,
        request.extra_body_json.clone(),
    )
    .await
    {
        Ok(req) => req,
        Err(e) => {
            return broadcast_and_return_error(e, &tx, state, &stream_key).await;
        }
    };

    // Pass provider to stream handler for provider-specific SSE parsing
    let result = stream_handler::handle_stream(
        &state.openai_client,
        openai_request,
        &stream_key,
        tx,
        provider,
    )
    .await;

    update_final_metrics(state, request_start_time, &result, &stream_key);

    result
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
                "Creating NEW broadcast sender for stream key: {}",
                stream_key
            );
            let (new_tx, _) = broadcast::channel::<StreamedResponse>(BROADCAST_CHANNEL_CAPACITY);
            new_tx
        })
        .clone()
}

fn update_peak_concurrency(state: &AppState) {
    state.metrics.requests_total.fetch_add(1, Ordering::Relaxed);
    let current_active = state
        .metrics
        .current_active_requests
        .fetch_add(1, Ordering::Relaxed)
        + 1;
    let mut peak = state
        .metrics
        .peak_concurrent_requests
        .load(Ordering::Relaxed);
    while current_active > peak {
        match state.metrics.peak_concurrent_requests.compare_exchange(
            peak,
            current_active,
            Ordering::Relaxed,
            Ordering::Relaxed,
        ) {
            Ok(_) => break,
            Err(actual_peak) => peak = actual_peak,
        }
    }
}

fn update_final_metrics(
    state: &AppState,
    start_time: Instant,
    result: &Result<AIResponse, NodeError>,
    stream_key: &str,
) {
    let duration = start_time.elapsed();
    let duration_ms = duration.as_millis() as u64;

    match result {
        Ok(response) => {
            state
                .metrics
                .requests_succeeded
                .fetch_add(1, Ordering::Relaxed);

            let estimated_tokens = match response {
                AIResponse::Text(text, _) => {
                    (text.len() as f64 / TOKEN_ESTIMATION_FACTOR).ceil() as u64
                }
                AIResponse::Embedding(embedding, _) => {
                    // Embeddings are fixed-size vectors, estimate based on dimensions
                    (embedding.len() as u64) / 4
                }
                _ => 0,
            };

            if estimated_tokens > 0 {
                state
                    .metrics
                    .tokens_processed
                    .fetch_add(estimated_tokens, Ordering::Relaxed);
            }

            let total_success = state.metrics.requests_succeeded.load(Ordering::Relaxed);
            if total_success > 0 {
                let new_total_time = state
                    .metrics
                    .total_response_time_ms
                    .fetch_add(duration_ms, Ordering::Relaxed)
                    + duration_ms;
                let new_avg = new_total_time / total_success;
                state
                    .metrics
                    .avg_response_time_ms
                    .store(new_avg, Ordering::Relaxed);
            }
            info!(
                "Request successful for key {}. Duration: {:?}, Est. Tokens: {}",
                stream_key, duration, estimated_tokens
            );
        }
        Err(e) => {
            state
                .metrics
                .requests_failed
                .fetch_add(1, Ordering::Relaxed);
            error!(
                "Request failed for key {}: {}. Duration: {:?}",
                stream_key, e, duration
            );
        }
    }
    state
        .metrics
        .current_active_requests
        .fetch_sub(1, Ordering::Relaxed);
}

async fn broadcast_and_return_error<T>(
    err: NodeError,
    tx: &broadcast::Sender<StreamedResponse>,
    state: &AppState,
    stream_key: &str,
) -> Result<T, NodeError> {
    let failure_status = map_node_error_to_message_status(&err);
    let error_response = StreamedResponse {
        text: String::new(),
        is_complete: true,
        error_status: Some(failure_status.clone()),
        usage: None,
    };
    warn!(
        "Broadcasting immediate error for stream key {}: {:?}",
        stream_key, failure_status
    );
    if let Err(e) = tx.send(error_response) {
        warn!(
            "Failed to broadcast initial error for stream key {}: {} (No listeners?)",
            stream_key, e
        );
    }
    state
        .metrics
        .requests_failed
        .fetch_add(1, Ordering::Relaxed);
    Err(err)
}
