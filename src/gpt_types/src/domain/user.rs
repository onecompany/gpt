use crate::domain::common::UserId;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq, Eq)]
pub enum UserStatus {
    Active,
    Pending(u64), // Timestamp in nanoseconds
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct User {
    pub user_id: UserId,
    pub principal: Principal,
    pub username: String,
    pub user_canister_id: Principal,
    // Cryptographic security fields for Client-Side Vault
    pub enc_salt: Option<Vec<u8>>, // 16 bytes random salt for Argon2id
    pub enc_validator: Option<String>, // Age-encrypted string verifying the PIN
    pub status: UserStatus,
}
