use crate::core::state::SharedState;
use axum::{Json, extract::State, response::IntoResponse};
use serde::Serialize;
use std::sync::atomic::Ordering;
use std::time::SystemTime;
use tracing::info;

#[derive(Serialize, Debug)]
struct StatusResponse {
    status: String,
    node_id: u64,
    index_canister_principal: String,
    network_type: String,
    configured_model_id: String,
    provider_model_name: String,
    uptime_seconds: u64,
    is_draining: bool,
    total_requests: u64,
    successful_requests: u64,
    failed_requests: u64,
    tokens_processed: u64,
    current_active_requests: u64,
    avg_response_time_ms: u64,
    peak_concurrent_requests: u64,
    rpm_limit: u64,
    concurrency_limit: u64,
    available_permits: u64,
    system_memory_mb: u64,
}

pub async fn status_handler(State(state): State<SharedState>) -> impl IntoResponse {
    let now = SystemTime::now();
    let uptime = now
        .duration_since(state.start_time)
        .unwrap_or_default()
        .as_secs();

    let available_permits = state.request_semaphore.available_permits() as u64;

    let system_memory_mb = get_approximate_memory_usage();

    let is_draining = state.is_draining.load(Ordering::Relaxed);

    let status_response = StatusResponse {
        status: if is_draining {
            "DRAINING".to_string()
        } else {
            "OK".to_string()
        },
        node_id: state.node_id,
        index_canister_principal: state.canister_principal.clone(),
        network_type: state.network_type.clone(),
        configured_model_id: state.model_id.clone(),
        provider_model_name: state.provider_model.clone(),
        uptime_seconds: uptime,
        is_draining,

        total_requests: state.metrics.requests_total.load(Ordering::Relaxed),
        successful_requests: state.metrics.requests_succeeded.load(Ordering::Relaxed),
        failed_requests: state.metrics.requests_failed.load(Ordering::Relaxed),
        tokens_processed: state.metrics.tokens_processed.load(Ordering::Relaxed),
        current_active_requests: state
            .metrics
            .current_active_requests
            .load(Ordering::Relaxed),
        avg_response_time_ms: state.metrics.avg_response_time_ms.load(Ordering::Relaxed),
        peak_concurrent_requests: state
            .metrics
            .peak_concurrent_requests
            .load(Ordering::Relaxed),

        rpm_limit: state.metrics.rpm_limit.load(Ordering::Relaxed),
        concurrency_limit: state.metrics.concurrency_limit.load(Ordering::Relaxed),
        available_permits,

        system_memory_mb,
    };

    if is_draining {
        info!(status = ?status_response, "Status endpoint requested (DRAINING)");
    }

    Json(status_response)
}

fn get_approximate_memory_usage() -> u64 {
    let mut usage: u64 = 0;

    if let Ok(statm) = std::fs::read_to_string("/proc/self/statm")
        && let Some(first_value) = statm.split_whitespace().next()
        && let Ok(pages) = first_value.parse::<u64>()
    {
        // Assuming 4K pages
        usage = pages * 4 / 1024;
    }

    usage
}
