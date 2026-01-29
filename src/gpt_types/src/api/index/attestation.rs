use crate::domain::node::AttestationRequirements;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetAttestationRequirementsRequest;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetAttestationRequirementsResponse {
    pub requirements: AttestationRequirements,
}
