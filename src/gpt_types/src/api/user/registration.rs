use crate::domain::node::LocalNode;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserDetails {
    pub principal: Principal,
    pub registered_at: u64,
    pub enc_salt: Option<Vec<u8>>,
    pub enc_validator: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct GptUserAddUserRequest {
    pub user_principal: Principal,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct GptUserAddUserResponse {
    pub success: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct FinalizeRegistrationRequest {
    pub enc_salt: Vec<u8>,
    pub enc_validator: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct FinalizeRegistrationResponse {
    pub success: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct IsUserFinalizedRequest {
    pub user_principal: Principal,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct IsUserFinalizedResponse {
    pub is_finalized: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct GptUserListRegisteredUsersResponse {
    pub users: Vec<UserDetails>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct WhoAmIUserResponse {
    pub principal: Principal,
    pub enc_salt: Option<Vec<u8>>,
    pub enc_validator: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GptUserGetNodesResponse {
    pub nodes: Vec<LocalNode>,
}
