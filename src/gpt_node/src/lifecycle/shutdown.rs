use crate::{core::error::NodeError, clients::canister::instrumented_canister_call, core::state::SharedState};
use candid::{Decode, Encode};
use gpt_types::{
    api::{UnregisterNodeRequest, UnregisterNodeResponse, UnregisterNodeResult},
    error::{CanisterError, CanisterResult},
    prelude::NodeId,
};
use ic_agent::{Agent, AgentError, export::Principal};
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering as AtomicOrdering},
    },
    time::{Duration, Instant},
};
use tracing::{error, info, warn};

pub async fn graceful_shutdown_signal(shutdown_flag: Arc<AtomicBool>) {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
        info!("Received Ctrl+C signal.");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
        info!("Received SIGTERM signal.");
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    let flag_monitor = async {
        loop {
            if shutdown_flag.load(AtomicOrdering::Relaxed) {
                info!("Internal shutdown flag detected.");
                break;
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    };

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
        _ = flag_monitor => {},
    }
    info!("Termination signal detected or triggered internally. Setting shutdown flag.");
    shutdown_flag.store(true, AtomicOrdering::SeqCst);
}

pub async fn wait_for_jobs_completion(shared_state: SharedState) {
    let max_wait = Duration::from_secs(120);
    let poll_interval = Duration::from_secs(2);
    let start_time = Instant::now();
    info!("Checking for active job streams before final shutdown...");
    loop {
        let num_active_streams = {
            let streams_lock = shared_state.job_streams.lock().await;
            streams_lock.len()
        };
        if num_active_streams == 0 {
            info!("All job streams completed and cleaned up.");
            break;
        }
        let elapsed = start_time.elapsed();
        if elapsed >= max_wait {
            warn!(
                num_streams = num_active_streams,
                timeout_s = max_wait.as_secs_f32(),
                "Timeout waiting for job stream(s) to complete cleanup. Forcing shutdown."
            );
            let remaining_keys: Vec<String> = {
                let streams_lock = shared_state.job_streams.lock().await;
                streams_lock.keys().cloned().collect()
            };
            warn!(
                "Remaining stream keys (handlers might be stuck or slow): {:?}",
                remaining_keys
            );
            break;
        }
        info!(
            active_streams = num_active_streams,
            elapsed_s = elapsed.as_secs_f32(),
            wait_s = max_wait.as_secs_f32(),
            "Waiting for active job stream handler(s) to finish..."
        );
        tokio::time::sleep(poll_interval).await;
    }
    info!("Finished waiting for job streams cleanup.");
}

pub async fn unregister_node(
    agent: &Agent,
    index_principal: &Principal,
    node_id: NodeId,
) -> Result<(), NodeError> {
    let node_principal = agent.get_principal().unwrap_or(Principal::anonymous());
    info!(
        node_id,
        index_canister = %index_principal,
        node_principal = %node_principal,
        "Attempting to unregister node from index canister"
    );

    let unregister_req = UnregisterNodeRequest {};
    let unregister_args = Encode!(&unregister_req).map_err(NodeError::Candid)?;

    let operation = || {
        agent
            .update(index_principal, "unregister_node")
            .with_arg(unregister_args.clone())
            .call_and_wait()
    };

    let unregister_response_bytes = instrumented_canister_call(
        "unregister_node",
        true,
        index_principal,
        "unregister_node",
        operation,
        None,
    )
    .await
    .map_err(|e| {
        error!(node_id, error = %e, "Agent error during unregister_node call");
        if let NodeError::Agent(AgentError::HttpError(payload)) = &e {
            error!(
                status = payload.status,
                content_type = ?payload.content_type,
                body = %String::from_utf8_lossy(&payload.content),
                " -> HTTP Error details"
            );
        }
        e
    })?;

    // Directly decode into the type alias Result
    let unregister_decoded: UnregisterNodeResult =
        Decode!(&unregister_response_bytes, UnregisterNodeResult).map_err(|e| {
            error!(node_id, error = %e, "Failed to decode UnregisterNodeResponse");
            NodeError::Candid(e)
        })?;

    // Convert type alias Result to native Result
    let result: CanisterResult<UnregisterNodeResponse> = unregister_decoded.into();

    match result {
        Ok(_) => {
            info!(
                node_id,
                "Successfully unregistered node from index canister."
            );
            Ok(())
        }
        Err(canister_err) => {
            error!(
                node_id,
                error = ?canister_err,
                "Index canister returned error during unregistration"
            );
            if matches!(&canister_err, CanisterError::Unauthorized) {
                error!(
                    "-> Possible cause: Unauthorized. Node's principal might not match registered principal."
                );
            } else if matches!(&canister_err, CanisterError::NodeNotFound) {
                error!("-> Possible cause: NodeNotFound. Node might already be unregistered.");
            }
            Err(NodeError::Canister(canister_err))
        }
    }
}

/// Triggers a fatal shutdown sequence due to an unrecoverable error.
pub async fn initiate_fatal_shutdown(state: SharedState, reason: String) {
    error!(reason = %reason, "CRITICAL: Initiating fatal shutdown sequence due to terminal error.");

    // 1. Immediately prevent new connections/jobs
    state.is_draining.store(true, AtomicOrdering::SeqCst);

    // 2. Resolve Index Principal
    let index_principal = match Principal::from_text(&state.canister_principal) {
        Ok(p) => p,
        Err(e) => {
            error!(
                "Failed to parse index canister principal during fatal shutdown: {}. Forcing exit.",
                e
            );
            std::process::exit(1);
        }
    };

    // 3. Attempt Unregistration with a strict timeout
    info!("Attempting emergency unregistration (timeout 10s)...");
    let unregister_future = unregister_node(&state.agent, &index_principal, state.node_id);

    match tokio::time::timeout(Duration::from_secs(10), unregister_future).await {
        Ok(Ok(_)) => info!("Emergency unregistration successful."),
        Ok(Err(e)) => error!("Emergency unregistration failed: {}", e),
        Err(_) => error!("Emergency unregistration timed out."),
    }

    // 4. Hard Exit
    error!("Exiting process now.");
    std::process::exit(1);
}
