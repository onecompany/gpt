use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct GetUserStorageUsageResponse {
    pub usage_bytes: u64,
    pub limit_bytes: u64,
}
