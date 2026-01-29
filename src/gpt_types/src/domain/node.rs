use crate::domain::common::{ModelId, NodeId};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct TcbVersion {
    pub bootloader: u8,
    pub tee: u8,
    pub snp: u8,
    pub microcode: u8,
    #[serde(default)]
    pub fmc: u8,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GenTcbRequirements {
    pub min_tcb: TcbVersion,
    pub min_guest_svn: u32,
}

// Added Copy to avoid move errors in logic
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MeasurementStatus {
    Active,     // New registrations allowed
    Deprecated, // No new registrations, existing nodes drain
    Revoked,    // No new registrations, existing nodes abort
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AttestationMeasurement {
    pub measurement_hex: String,
    pub name: String,
    pub status: MeasurementStatus,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AttestationRequirements {
    pub min_report_version: u32,

    pub milan_policy: GenTcbRequirements,
    pub genoa_policy: GenTcbRequirements,
    pub turin_policy: GenTcbRequirements,

    pub require_smt_disabled: bool,
    pub require_tsme_disabled: bool,
    pub require_ecc_enabled: bool,
    pub require_rapl_disabled: bool,
    pub require_ciphertext_hiding_enabled: bool,

    pub measurements: Vec<AttestationMeasurement>,

    pub expected_measurement_len: u64,

    #[serde(default)]
    pub max_attestation_age_ns: u64,
}

// Added Copy to avoid move errors in logic
#[derive(CandidType, Deserialize, Clone, Copy, Debug, Serialize, PartialEq, Eq)]
pub enum NodeLifecycleStatus {
    Active,
    Draining,
    Inactive,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct Node {
    pub node_id: NodeId,
    pub owner: Principal,
    pub node_principal: Option<Principal>,
    pub hostname: String,
    pub model_id: ModelId,
    pub encrypted_api_key: String,

    pub lifecycle_status: NodeLifecycleStatus,

    pub authenticated_measurement: Option<String>,

    pub attestation_verified_at: Option<u64>,
    pub last_heartbeat_timestamp: Option<u64>,
    pub expected_chip_id: String,
    pub reported_measurement: Option<Vec<u8>>,
    pub reported_chip_id: Option<Vec<u8>>,
    pub reported_tcb: Option<TcbVersion>,
    pub reported_platform_info: Option<u64>,
    pub detected_generation: Option<String>,
    pub public_key: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct PublicNodeInfo {
    pub node_id: NodeId,
    pub owner: Principal,
    pub node_principal: Option<Principal>,
    pub hostname: String,
    pub model_id: ModelId,
    pub is_active: bool,
    pub attestation_verified_at: Option<u64>,
    pub last_heartbeat_timestamp: Option<u64>,
    pub reported_measurement_hex: Option<String>,
    pub reported_chip_id_hex: Option<String>,
    pub detected_generation: Option<String>,
    pub public_key: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct LocalNode {
    pub node_id: NodeId,
    pub node_principal: Option<Principal>,
    pub address: String,
    pub model_id: ModelId,
    // Synced from Index
    pub public_key: Option<String>,
}
