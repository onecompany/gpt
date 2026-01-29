use crate::{
    Args,
    core::state::{AppState, SharedState},
    core::metrics::Metrics,
};
use age::Decryptor;
use age::x25519::Identity as X25519Identity;
use async_openai::{Client as OpenAIClient, config::OpenAIConfig};
use base64::{Engine, engine::general_purpose::STANDARD};
use governor::{Quota, RateLimiter};
use gpt_types::{api::GetNodeConfigResponse, prelude::*};
use ic_agent::Agent;
use k256::ecdsa::SigningKey;
use std::{
    collections::HashMap,
    io::Read,
    iter,
    num::NonZeroU32,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU64},
    },
    time::SystemTime,
};
use tokio::sync::{Mutex, Semaphore};
use tracing::info;

use crate::core::error::NodeError;

pub(super) fn initialize_shared_state(
    args: &Args,
    node_id: NodeId,
    node_config: GetNodeConfigResponse,
    model_details: Model,
    agent: Agent,
    ephemeral_key: SigningKey,
    host_x25519_identity: X25519Identity,
    node_x25519_identity: X25519Identity,
    node_public_key: String,
) -> Result<SharedState, NodeError> {
    info!("Setting up Provider Client...");

    let endpoint = model_details.provider_endpoint.clone();
    info!("Using provider endpoint: {}", endpoint);

    // Log the identity we are about to use for decryption.
    let host_identity_public = host_x25519_identity.to_public();
    info!(
        "Host Identity (derived from host-data) for decryption: {}",
        host_identity_public
    );

    info!("Decrypting Provider API Key...");
    let encrypted_key_b64 = &node_config.encrypted_api_key;
    let encrypted_key_bytes = STANDARD
        .decode(encrypted_key_b64)
        .map_err(|e| NodeError::Configuration(format!("Failed to base64-decode API key: {}", e)))?;

    let decryptor = Decryptor::new(&encrypted_key_bytes[..])
        .map_err(|e| NodeError::Configuration(format!("Failed to initialize decryptor: {}", e)))?;

    let mut decrypted_reader = decryptor
        .decrypt(iter::once(&host_x25519_identity as &dyn age::Identity))
        .map_err(|e| {
            NodeError::Configuration(format!(
                "Failed to decrypt API key: {}. The node attempted to decrypt using Host Identity: {}. Ensure this matches the identity configured in the Index.",
                e, host_identity_public
            ))
        })?;

    let mut api_key = String::new();
    decrypted_reader.read_to_string(&mut api_key).map_err(|e| {
        NodeError::Configuration(format!("Failed to read decrypted key into string: {}", e))
    })?;

    if api_key.is_empty() {
        return Err(NodeError::Configuration(
            "Decrypted API key is empty.".to_string(),
        ));
    }

    info!("Successfully decrypted Provider API Key.");

    let provider_config = OpenAIConfig::new()
        .with_api_key(api_key)
        .with_api_base(endpoint);

    let openai_client = OpenAIClient::with_config(provider_config);

    let rate_limiter = args.rpm.map(|rpm| {
        Arc::new(RateLimiter::direct(Quota::per_minute(
            NonZeroU32::new(rpm).unwrap_or_else(|| NonZeroU32::new(1).unwrap()),
        )))
    });
    let request_semaphore = Arc::new(Semaphore::new(args.concurrency.unwrap_or(100000) as usize));

    let metrics = Arc::new(Metrics {
        requests_total: AtomicU64::new(0),
        requests_succeeded: AtomicU64::new(0),
        requests_failed: AtomicU64::new(0),
        tokens_processed: AtomicU64::new(0),
        current_active_requests: AtomicU64::new(0),
        avg_response_time_ms: AtomicU64::new(0),
        total_response_time_ms: AtomicU64::new(0),
        peak_concurrent_requests: AtomicU64::new(0),
        rpm_limit: AtomicU64::new(args.rpm.unwrap_or(0) as u64),
        concurrency_limit: AtomicU64::new(args.concurrency.unwrap_or(0) as u64),
    });

    Ok(Arc::new(AppState {
        node_id,
        model_id: node_config.model_id.clone(),
        provider_model: model_details.provider_model.clone(),
        canister_principal: args.canister_principal.clone(),
        network_type: args.network_type.clone(),
        start_time: SystemTime::now(),
        ephemeral_key,
        host_x25519_identity,
        node_x25519_identity,
        node_public_key,
        openai_client,
        agent,
        request_semaphore,
        rate_limiter,
        job_streams: Arc::new(Mutex::new(HashMap::new())),
        metrics,
        shutdown: Arc::new(AtomicBool::new(false)),
        is_draining: Arc::new(AtomicBool::new(false)),
    }))
}
