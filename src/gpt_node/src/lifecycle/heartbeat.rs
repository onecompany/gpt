use crate::{core::error::NodeError, clients::canister::instrumented_canister_call, core::state::SharedState};
use candid::{Decode, Encode};
use gpt_types::{
    api::{HeartbeatRequest, HeartbeatResponse, HeartbeatResult, NodeHeartbeatCommand},
    error::{CanisterError, CanisterResult},
};
use ic_agent::export::Principal;
use std::sync::atomic::Ordering as AtomicOrdering;
use std::time::{Duration, Instant};
use tracing::{error, info, warn};

const HEARTBEAT_INTERVAL_S: u64 = 540;
const HEARTBEAT_ATTEMPT_TIMEOUT: Duration = Duration::from_secs(65);
const HEARTBEAT_INTERNAL_RETRY_DELAY: Duration = Duration::from_secs(5);

pub fn spawn_heartbeat_task(state: SharedState, index_principal: Principal) {
    let interval_s = HEARTBEAT_INTERVAL_S;
    let attempt_timeout = HEARTBEAT_ATTEMPT_TIMEOUT;
    info!(
        interval_s,
        attempt_timeout_s = attempt_timeout.as_secs(),
        "Spawning background heartbeat task"
    );

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(interval_s));
        interval.tick().await;

        loop {
            interval.tick().await;
            if state.shutdown.load(AtomicOrdering::Relaxed) {
                info!("Heartbeat task shutting down due to shutdown flag.");
                break;
            }

            if !perform_single_heartbeat_attempt(&state, &index_principal).await {
                warn!("Heartbeat attempt indicated stop/shutdown. Signaling node shutdown.");
                state.shutdown.store(true, AtomicOrdering::SeqCst);
                break;
            }
        }
        info!("Heartbeat task loop finished.");
    });
}

async fn perform_single_heartbeat_attempt(
    state: &SharedState,
    index_principal: &Principal,
) -> bool {
    info!("Initiating heartbeat attempt...");
    let attempt_start_time = Instant::now();

    loop {
        if attempt_start_time.elapsed() >= HEARTBEAT_ATTEMPT_TIMEOUT {
            error!(
                timeout_s = HEARTBEAT_ATTEMPT_TIMEOUT.as_secs(),
                "Heartbeat attempt timed out"
            );
            return false;
        }
        if state.shutdown.load(AtomicOrdering::Relaxed) {
            info!("Shutdown detected during heartbeat attempt; aborting.");
            return true;
        }

        match send_heartbeat_update(state, index_principal).await {
            Ok(response) => {
                match response.command {
                    NodeHeartbeatCommand::Continue => {
                        info!("Heartbeat successful. Command: Continue.");
                        return true;
                    }
                    NodeHeartbeatCommand::DrainAndShutdown => {
                        info!("Received DrainAndShutdown command from Index.");
                        state.is_draining.store(true, AtomicOrdering::SeqCst);

                        let active_streams = state.job_streams.lock().await.len();
                        if active_streams == 0 {
                            info!("No active streams. Signaling immediate shutdown.");
                            state.shutdown.store(true, AtomicOrdering::SeqCst);
                        } else {
                            info!(
                                "Draining mode enabled. Waiting for {} streams to complete.",
                                active_streams
                            );
                            // Signal shutdown locally. Main loop handles graceful wait.
                            state.shutdown.store(true, AtomicOrdering::SeqCst);
                        }
                        return false;
                    }
                    NodeHeartbeatCommand::Abort => {
                        error!("Received Abort command. Exiting immediately.");
                        std::process::exit(1);
                    }
                }
            }
            Err(NodeError::Canister(CanisterError::Unauthorized | CanisterError::NodeNotFound)) => {
                error!(
                    error = "Unauthorized or NodeNotFound",
                    "Received critical, non-retryable error during heartbeat. Shutting down."
                );
                return false;
            }
            Err(e) => {
                warn!(
                    error = %e,
                    retry_delay_s = HEARTBEAT_INTERNAL_RETRY_DELAY.as_secs(),
                    "Heartbeat call failed, retrying..."
                );
                tokio::time::sleep(HEARTBEAT_INTERNAL_RETRY_DELAY).await;
            }
        }
    }
}

async fn send_heartbeat_update(
    state: &SharedState,
    index_principal: &Principal,
) -> Result<HeartbeatResponse, NodeError> {
    let args = Encode!(&HeartbeatRequest {}).map_err(NodeError::Candid)?;

    let operation = || {
        state
            .agent
            .update(index_principal, "heartbeat")
            .with_arg(args.clone())
            .call_and_wait()
    };

    let response_bytes = instrumented_canister_call(
        "heartbeat",
        true,
        index_principal,
        "heartbeat",
        operation,
        Some(1),
    )
    .await?;

    let decoded_result: HeartbeatResult =
        Decode!(&response_bytes, HeartbeatResult).map_err(NodeError::Candid)?;

    let result: CanisterResult<HeartbeatResponse> = decoded_result.into();
    result.map_err(NodeError::Canister)
}
