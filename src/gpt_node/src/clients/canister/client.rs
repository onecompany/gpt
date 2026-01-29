use crate::core::error::NodeError;
use ic_agent::identity::Secp256k1Identity;
use ic_agent::{Agent, export::Principal};
use k256::ecdsa::SigningKey;
use std::time::{Duration, Instant};
use tracing::{Instrument, debug, error, info, info_span, warn};

const MAX_ROOT_KEY_RETRIES: u32 = 5;
const ROOT_KEY_RETRY_DELAY: Duration = Duration::from_secs(2);
const MAX_AGENT_CALL_RETRIES: u32 = 3;
const AGENT_CALL_RETRY_DELAY: Duration = Duration::from_secs(1);

pub async fn build_ic_agent(
    network_type: &str,
    replica_url: &str,
    signing_key: &SigningKey,
) -> Result<Agent, NodeError> {
    let ephemeral_identity = Secp256k1Identity::from_private_key(signing_key.clone().into());

    let url = match network_type {
        "local" => replica_url,
        "ic" => "https://icp-api.io",
        other => return Err(NodeError::Other(format!("Invalid network type: {}", other))),
    };

    info!("Building IC Agent for URL: {}", url);

    let agent = Agent::builder()
        .with_url(url)
        .with_identity(ephemeral_identity)
        .build()
        .map_err(|e| NodeError::Other(format!("Failed to build agent: {}", e)))?;

    if network_type == "local" {
        info!("Local network type detected. Fetching root key...");
        fetch_root_key_with_retry(&agent, MAX_ROOT_KEY_RETRIES).await?;
    }

    debug!(
        "IC agent successfully created and initialized for network {}",
        network_type
    );
    Ok(agent)
}

async fn fetch_root_key_with_retry(agent: &Agent, max_retries: u32) -> Result<(), NodeError> {
    for attempt in 1..=max_retries {
        debug!(
            "Attempting to fetch root key (attempt {}/{})",
            attempt, max_retries
        );

        match agent.fetch_root_key().await {
            Ok(_) => {
                if attempt > 1 {
                    info!(
                        "Successfully fetched root key on attempt {}/{}",
                        attempt, max_retries
                    );
                } else {
                    debug!("Successfully fetched root key on first attempt");
                }
                return Ok(());
            }
            Err(e) => {
                if attempt == max_retries {
                    error!(
                        "Failed to fetch root key after {} attempts: {}",
                        max_retries, e
                    );
                    return Err(NodeError::Other(format!(
                        "Failed to fetch root key after {} attempts: {}",
                        max_retries, e
                    )));
                }

                warn!(
                    "Attempt {}/{} to fetch root key failed: {}. Retrying in {:?}...",
                    attempt, max_retries, e, ROOT_KEY_RETRY_DELAY
                );

                tokio::time::sleep(ROOT_KEY_RETRY_DELAY).await;
            }
        }
    }

    Err(NodeError::Other(format!(
        "Failed to fetch root key after {} attempts (unexpected exit)",
        max_retries
    )))
}

fn log_node_error_structured(duration_ms: u128, attempt: u32, err: &NodeError, final_error: bool) {
    if final_error {
        match err {
            NodeError::Canister(ce) => {
                error!(
                    duration_ms,
                    attempt,
                    error.type = "Canister",
                    error.detail = %ce,
                    "Call failed"
                );
            }
            NodeError::Agent(ae) => {
                error!(
                    duration_ms,
                    attempt,
                    error.type = "Agent",
                    error.detail = %ae,
                    "Call failed"
                );
            }
            NodeError::Candid(e) => {
                error!(
                    duration_ms,
                    attempt,
                    error.type = "Candid",
                    error.detail = %e,
                    "Call failed"
                );
            }
            _ => {
                error!(
                    duration_ms,
                    attempt,
                    error.type = "Other",
                    error.detail = %err,
                    "Call failed"
                );
            }
        }
    } else {
        match err {
            NodeError::Canister(ce) => {
                warn!(
                    duration_ms,
                    attempt,
                    error.type = "Canister",
                    error.detail = %ce,
                    "Call failed"
                );
            }
            NodeError::Agent(ae) => {
                warn!(
                    duration_ms,
                    attempt,
                    error.type = "Agent",
                    error.detail = %ae,
                    "Call failed"
                );
            }
            NodeError::Candid(e) => {
                warn!(
                    duration_ms,
                    attempt,
                    error.type = "Candid",
                    error.detail = %e,
                    "Call failed"
                );
            }
            _ => {
                warn!(
                    duration_ms,
                    attempt,
                    error.type = "Other",
                    error.detail = %err,
                    "Call failed"
                );
            }
        }
    }
}

pub async fn instrumented_canister_call<F, Fut, T>(
    operation_name: &str,
    is_update: bool,
    canister_id: &Principal,
    method_name: &str,
    operation: F,
    max_retries: Option<u32>,
) -> Result<T, NodeError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, ic_agent::AgentError>>,
{
    let span = info_span!(
        "canister_call",
        call_type = if is_update { "update" } else { "query" },
        canister_id = %canister_id,
        method = method_name,
        operation = operation_name,
    );

    async move {
        let retries = max_retries.unwrap_or(MAX_AGENT_CALL_RETRIES);

        for attempt in 1..=retries {
            let start_time = Instant::now();
            match operation().await {
                Ok(result) => {
                    let duration_ms = start_time.elapsed().as_millis();
                    tracing::info!(duration_ms, attempt, "Call successful");
                    return Ok(result);
                }
                Err(e) => {
                    let duration_ms = start_time.elapsed().as_millis();
                    let node_error = NodeError::from(e);

                    if attempt >= retries {
                        log_node_error_structured(duration_ms, attempt, &node_error, true);
                        return Err(node_error);
                    }

                    log_node_error_structured(duration_ms, attempt, &node_error, false);
                    tokio::time::sleep(AGENT_CALL_RETRY_DELAY).await;
                }
            }
        }
        unreachable!("Loop must return or error.")
    }
    .instrument(span)
    .await
}
