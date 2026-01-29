use crate::domain::common::UserId;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct WhoAmIRequest;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct WhoAmIResponse {
    pub principal: Principal,
    pub username: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RegisterUserRequest {
    pub username: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RegisterUserResponse {
    pub user_id: UserId,
    pub principal: Principal,
    pub username: String,
    pub user_canister_id: Principal,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RawWhoAmIRequest;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RawWhoAmIResponse {
    pub principal: Principal,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetUserAssignmentRequest {
    pub user_principal: Principal,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetUserAssignmentResponse {
    pub assigned_canister: Vec<Principal>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ConfirmRegistrationRequest {
    pub user_principal: Principal,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ConfirmRegistrationResponse;
