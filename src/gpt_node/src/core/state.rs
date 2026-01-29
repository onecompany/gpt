use crate::{
    core::error::NodeError,
    core::metrics::Metrics,
    clients::canister::instrumented_canister_call,
    core::job::types::StreamedResponse,
};
use age::x25519::Identity as X25519Identity;
use async_openai::Client;
use candid::{Decode, Encode};
use governor::RateLimiter;
use governor::clock::DefaultClock;
use governor::state::{InMemoryState, NotKeyed};
use gpt_types::domain::Model;
use gpt_types::prelude::NodeId;
use ic_agent::Agent;
use k256::ecdsa::SigningKey;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::time::SystemTime;
use tokio::sync::{Mutex, Semaphore, broadcast};

#[allow(dead_code)]
pub struct AppState {
    pub node_id: NodeId,
    pub model_id: String,
    pub provider_model: String,
    pub canister_principal: String,
    pub network_type: String,
    pub start_time: SystemTime,
    pub ephemeral_key: SigningKey,
    pub host_x25519_identity: X25519Identity,
    pub node_x25519_identity: X25519Identity,
    pub node_public_key: String,
    pub openai_client: Client<async_openai::config::OpenAIConfig>,
    pub agent: Agent,
    pub request_semaphore: Arc<Semaphore>,
    pub rate_limiter: Option<Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>>,
    pub job_streams: Arc<Mutex<HashMap<String, broadcast::Sender<StreamedResponse>>>>,
    pub metrics: Arc<Metrics>,
    pub shutdown: Arc<AtomicBool>,
    pub is_draining: Arc<AtomicBool>,
}

impl AppState {
    pub async fn get_model_details(&self) -> Result<Model, NodeError> {
        let index_principal = self.canister_principal.parse().map_err(|_| {
            NodeError::Configuration("Invalid index canister principal in state.".to_string())
        })?;

        let req_bytes = Encode!(&gpt_types::api::GetModelsRequest {}).map_err(NodeError::Candid)?;

        let operation = || {
            self.agent
                .query(&index_principal, "get_models")
                .with_arg(req_bytes.clone())
                .call()
        };

        let res_bytes = instrumented_canister_call(
            "get_model_details",
            false,
            &index_principal,
            "get_models",
            operation,
            None,
        )
        .await?;

        let response: gpt_types::api::GetModelsResponse =
            Decode!(&res_bytes, gpt_types::api::GetModelsResponse).map_err(NodeError::Candid)?;

        response
            .models
            .into_iter()
            .find(|m| m.model_id == self.model_id)
            .ok_or_else(|| {
                NodeError::Configuration(format!("Model '{}' not found in index.", self.model_id))
            })
    }
}

pub type SharedState = Arc<AppState>;
