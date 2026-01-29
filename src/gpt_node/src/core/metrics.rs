use std::sync::atomic::AtomicU64;

/// Metrics tracking for node performance and request statistics.
pub struct Metrics {
    pub requests_total: AtomicU64,
    pub requests_succeeded: AtomicU64,
    pub requests_failed: AtomicU64,
    pub tokens_processed: AtomicU64,
    pub current_active_requests: AtomicU64,
    pub avg_response_time_ms: AtomicU64,
    pub total_response_time_ms: AtomicU64,
    pub peak_concurrent_requests: AtomicU64,
    pub rpm_limit: AtomicU64,
    pub concurrency_limit: AtomicU64,
}
