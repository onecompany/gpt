use std::time::Duration;

pub const LIVENESS_CHECK_INTERVAL: Duration = Duration::from_secs(600);
pub const LIVENESS_TIMEOUT: Duration = LIVENESS_CHECK_INTERVAL;
pub const REBALANCER_FIRST_DELAY: Duration = Duration::from_secs(60);
pub const REBALANCER_INTERVAL: Duration = Duration::from_secs(300);
pub const CYCLES_FOR_USER_CANISTER_CREATION: u128 = 1_000_000_000_000;
pub const USER_CANISTER_RESERVED_CYCLES_LIMIT: u128 = 500_000_000_000;
pub const PENDING_USER_TIMEOUT_NS: u64 = 15 * 60 * 1_000_000_000; // 15 Minutes

// Pool and trial canister constants
pub const DEFAULT_POOL_TARGET_SIZE: u32 = 5;
pub const TRIAL_CANISTER_EXPIRY_NS: u64 = 60 * 60 * 1_000_000_000; // 1 hour in nanoseconds
