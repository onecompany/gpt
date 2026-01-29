use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

/// State of a canister in the pool
#[derive(Clone, Debug, Serialize, Deserialize, CandidType, PartialEq, Eq)]
pub enum CanisterPoolState {
    /// Canister is in the pool with no code installed, ready for assignment
    Available,
    /// Canister is assigned to a user
    Assigned {
        owner: Principal,
        /// None = manager (no expiry), Some(timestamp) = trial user expiry time in nanoseconds
        expires_at: Option<u64>,
    },
}

/// Entry in the canister pool (replaces legacy CanisterStats)
#[derive(Clone, Debug, Serialize, Deserialize, CandidType)]
pub struct CanisterPoolEntry {
    pub canister_id: Principal,
    pub time_created: u64,
    pub state: CanisterPoolState,
}
