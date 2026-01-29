use crate::domain::node::{GenTcbRequirements, MeasurementStatus};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UpdateAttestationMeasurementRequest {
    pub new_measurement_hex: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UpdateAttestationMeasurementResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct AddManagerRequest {
    pub principal_to_add: Principal,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct AddManagerResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RemoveManagerRequest {
    pub principal_to_remove: Principal,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RemoveManagerResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ClaimManagerRoleResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct AddMeasurementRequest {
    pub measurement_hex: String,
    pub name: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct AddMeasurementResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UpdateMeasurementStatusRequest {
    pub measurement_hex: String,
    pub status: MeasurementStatus,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UpdateMeasurementStatusResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RemoveMeasurementRequest {
    pub measurement_hex: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RemoveMeasurementResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UpdateAttestationPoliciesRequest {
    pub min_report_version: u32,
    pub milan_policy: GenTcbRequirements,
    pub genoa_policy: GenTcbRequirements,
    pub turin_policy: GenTcbRequirements,
    pub require_smt_disabled: bool,
    pub require_tsme_disabled: bool,
    pub require_ecc_enabled: bool,
    pub require_rapl_disabled: bool,
    pub require_ciphertext_hiding_enabled: bool,
    pub expected_measurement_len: u64,
    pub max_attestation_age_ns: u64,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UpdateAttestationPoliciesResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct IsManagerResponse {
    pub is_manager: bool,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ListManagersResponse {
    pub managers: Vec<Principal>,
}
