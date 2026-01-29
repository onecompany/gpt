use crate::storage::get_config;
use gpt_types::api::{
    GptUserListRegisteredUsersResponse, GptUserListRegisteredUsersResult, UserDetails,
};
use ic_cdk_macros::query;

/// Returns the single owner of this canister (if bound).
/// For a single-user canister, this returns a list with at most one user.
#[query]
pub fn list_registered_users() -> GptUserListRegisteredUsersResult {
    ic_cdk::println!("list_registered_users called.");

    let config = get_config();

    let users = match config.owner {
        Some(owner) => vec![UserDetails {
            principal: owner,
            registered_at: config.registered_at,
            enc_salt: config.enc_salt,
            enc_validator: config.enc_validator,
        }],
        None => vec![],
    };

    Ok(GptUserListRegisteredUsersResponse { users })
}
