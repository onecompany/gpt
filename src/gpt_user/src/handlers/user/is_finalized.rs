use crate::storage::get_config;
use gpt_types::api::{IsUserFinalizedRequest, IsUserFinalizedResponse};
use ic_cdk_macros::query;

/// Checks if a user is finalized (i.e., the canister is bound to them with vault data).
/// For a single-user canister, this checks if the owner matches and has vault data.
#[query]
pub fn is_user_finalized(req: IsUserFinalizedRequest) -> IsUserFinalizedResponse {
    let user_principal = req.user_principal;
    ic_cdk::println!("is_user_finalized called for principal: {}", user_principal);

    let config = get_config();

    // User is finalized if:
    // 1. This canister is bound to the requested user
    // 2. Vault data (enc_salt and enc_validator) is present
    let is_finalized = match config.owner {
        Some(owner) if owner == user_principal => {
            config.enc_salt.is_some() && config.enc_validator.is_some()
        }
        _ => false,
    };

    ic_cdk::println!(
        "Finalization status for principal {}: {}",
        user_principal,
        is_finalized
    );

    IsUserFinalizedResponse { is_finalized }
}
