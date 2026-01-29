use crate::domain::common::NodeId;
use crate::domain::node::PublicNodeInfo;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ListMyNodesRequest;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ListMyNodesResponse {
    pub nodes: Vec<PublicNodeInfo>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ListActiveNodesRequest;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ListActiveNodesResponse {
    pub nodes: Vec<PublicNodeInfo>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct CreateIndexNodeRequest {
    pub hostname: String,
    pub model_id: String,
    pub encrypted_api_key: String,
    pub expected_chip_id: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct CreateIndexNodeResponse {
    pub node_id: NodeId,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RegisterNodeRequest {
    pub node_id: NodeId,
    #[serde(with = "serde_bytes")]
    pub attestation_report: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub ark_der: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub ask_der: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub vek_der: Vec<u8>,
    pub timestamp: u64,
    pub public_key: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RegisterNodeResponse {
    pub success: bool,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetNodeConfigRequest {
    pub node_id: NodeId,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetNodeConfigResponse {
    pub hostname: String,
    pub model_id: String,
    pub encrypted_api_key: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UnregisterNodeRequest;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UnregisterNodeResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub enum NodeHeartbeatCommand {
    Continue,
    DrainAndShutdown,
    Abort,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct HeartbeatRequest;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct HeartbeatResponse {
    pub command: NodeHeartbeatCommand,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetProvisioningInfoRequest {
    pub node_id: u64,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetProvisioningInfoResponse {
    pub hostname: String,
    pub model_id: String,
    pub owner: Principal,
    pub is_active: bool,
}
