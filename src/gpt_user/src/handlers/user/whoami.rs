use crate::storage::get_config;
use gpt_types::api::WhoAmIUserResponse;
use ic_cdk_macros::query;

/// Returns the caller's identity and vault data.
/// For a single-user canister, this returns the bound owner's details.
#[query]
pub fn whoami() -> WhoAmIUserResponse {
    let caller = ic_cdk::api::msg_caller();
    ic_cdk::println!("whoami called by principal: {}", caller);

    let config = get_config();

    match config.owner {
        Some(owner) if owner == caller => WhoAmIUserResponse {
            principal: owner,
            enc_salt: config.enc_salt,
            enc_validator: config.enc_validator,
        },
        Some(_) => {
            ic_cdk::println!("Caller {} is not the owner of this canister", caller);
            ic_cdk::trap("Unauthorized: You are not the owner of this canister.")
        }
        None => {
            ic_cdk::println!("Canister not yet bound to any user");
            ic_cdk::trap("UserNotFound: This canister is not yet bound to any user.")
        }
    }
}
