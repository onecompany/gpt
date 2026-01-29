use crate::api::common::CanisterPoolEntry;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, CandidType)]
pub struct ListUserCanistersResponse {
    pub canisters: Vec<CanisterPoolEntry>,
}

#[derive(Clone, Debug, Serialize, Deserialize, CandidType)]
pub struct CreateUserCanisterResponse {
    pub canister_id: Principal,
}

/// Request to provision additional canisters into the pool (manager-only)
#[derive(Clone, Debug, Serialize, Deserialize, CandidType)]
pub struct ProvisionCanistersRequest {
    pub count: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, CandidType)]
pub struct ProvisionCanistersResponse {
    pub canisters_created: u32,
    pub pool_size: u32,
}

/// Response for listing canister pool status
#[derive(Clone, Debug, Serialize, Deserialize, CandidType)]
pub struct ListCanisterPoolResponse {
    pub available: Vec<CanisterPoolEntry>,
    pub assigned: Vec<CanisterPoolEntry>,
    pub pool_target_size: u32,
}
