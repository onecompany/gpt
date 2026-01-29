use crate::config;
use crate::handlers::user_canister::{install_user_wasm, return_canister_to_pool, take_canister_from_pool};
use crate::storage::{
    AVAILABLE_CANISTERS, CANISTER_POOL, CandidWrapper, CONFIG, MANAGERS, PENDING_USERS,
    StorablePrincipal, TRIAL_EXPIRIES, USERS,
};
use gpt_types::{
    api::{
        ConfirmRegistrationRequest, ConfirmRegistrationResponse, GetUserAssignmentRequest,
        GetUserAssignmentResponse, RawWhoAmIRequest, RawWhoAmIResponse, RegisterUserRequest,
        RegisterUserResponse, WhoAmIRequest, WhoAmIResponse,
    },
    api::common::CanisterPoolState,
    domain::{User, UserStatus},
    error::{CanisterError, CanisterResult},
};
use ic_cdk_macros::{query, update};

/// Registers a new user by assigning them a canister from the pool.
/// - Managers get permanent canisters (no expiry)
/// - All other users get trial canisters that expire after 1 hour
#[update]
pub async fn register_user(req: RegisterUserRequest) -> CanisterResult<RegisterUserResponse> {
    let principal = ic_cdk::api::msg_caller();
    let current_time = ic_cdk::api::time();
    ic_cdk::println!("register_user called by principal: {}", principal);
    ic_cdk::println!("Proposed username: {}", req.username);

    if req.username.trim().is_empty() {
        return Err(CanisterError::InvalidInput(
            "Username cannot be empty.".to_string(),
        ));
    }

    // Check if user already exists
    if let Some(existing_user_wrapper) =
        USERS.with(|users| users.borrow().get(&StorablePrincipal(principal)))
    {
        let existing_user = existing_user_wrapper.0;

        // Check if Pending and Expired
        if let UserStatus::Pending(ts) = existing_user.status {
            if current_time.saturating_sub(ts) > config::PENDING_USER_TIMEOUT_NS {
                ic_cdk::println!(
                    "User principal {} has expired pending registration. Re-allocating with new canister.",
                    principal
                );
                // Clean up the old pending canister - return it to pool
                return_canister_to_pool(existing_user.user_canister_id).await;
                // Remove old user record
                USERS.with(|users| {
                    users.borrow_mut().remove(&StorablePrincipal(principal));
                });
                // Fall through to create new registration
            } else {
                // Not expired, return existing pending assignment
                ic_cdk::println!(
                    "User principal {} is already pending registration. Returning existing assignment.",
                    principal
                );
                return Ok(RegisterUserResponse {
                    user_id: existing_user.user_id,
                    principal: existing_user.principal,
                    username: existing_user.username,
                    user_canister_id: existing_user.user_canister_id,
                });
            }
        } else {
            // Already Active
            ic_cdk::println!(
                "User principal {} is already active. Returning existing assignment.",
                principal
            );
            return Ok(RegisterUserResponse {
                user_id: existing_user.user_id,
                principal: existing_user.principal,
                username: existing_user.username,
                user_canister_id: existing_user.user_canister_id,
            });
        }
    }

    // Determine if caller is a manager
    let is_manager = MANAGERS.with(|m| m.borrow().contains_key(&StorablePrincipal(principal)));
    ic_cdk::println!(
        "User {} is manager: {}",
        principal,
        is_manager
    );

    // Allocate new user ID
    let new_user_id = CONFIG.with(|c| {
        let mut wrapper = c.borrow().get().clone();
        let id = wrapper.0.next_user_id;
        wrapper.0.next_user_id += 1;
        c.borrow_mut()
            .set(wrapper)
            .expect("Failed to update user id");
        id
    });

    // Take canister from pool (or create new if pool empty)
    ic_cdk::println!(
        "Taking canister from pool for user {} (principal: {})",
        new_user_id,
        principal
    );
    let assigned_canister_id = take_canister_from_pool().await?;
    ic_cdk::println!(
        "Got canister {} from pool for user {}",
        assigned_canister_id,
        new_user_id
    );

    // Remove from available set (already done by take_canister_from_pool)
    // But ensure it's not in the set
    AVAILABLE_CANISTERS.with(|available| {
        available.borrow_mut().remove(&assigned_canister_id);
    });

    // Install WASM on the canister (reinstall mode)
    ic_cdk::println!(
        "Installing WASM on canister {} for user {}",
        assigned_canister_id,
        new_user_id
    );
    install_user_wasm(assigned_canister_id).await?;
    ic_cdk::println!(
        "WASM installed on canister {} for user {}",
        assigned_canister_id,
        new_user_id
    );

    // Calculate expiry: None for managers, Some(now + 1hr) for trial users
    let expires_at = if is_manager {
        ic_cdk::println!("User {} is manager, no trial expiry", principal);
        None
    } else {
        let expiry = current_time + config::TRIAL_CANISTER_EXPIRY_NS;
        ic_cdk::println!(
            "User {} is trial user, expires at {} (in 1 hour)",
            principal,
            expiry
        );
        Some(expiry)
    };

    // Update pool entry to Assigned state
    CANISTER_POOL.with(|pool| {
        let mut pool_map = pool.borrow_mut();
        let key = StorablePrincipal(assigned_canister_id);
        if let Some(wrapper) = pool_map.get(&key) {
            let mut entry = wrapper.0.clone();
            entry.state = CanisterPoolState::Assigned {
                owner: principal,
                expires_at,
            };
            pool_map.insert(key, CandidWrapper(entry));
            ic_cdk::println!(
                "Updated canister {} to Assigned state for user {}",
                assigned_canister_id,
                principal
            );
        } else {
            ic_cdk::println!(
                "WARN: Could not find canister {} in CANISTER_POOL to update state.",
                assigned_canister_id
            );
        }
    });

    // Add to trial expiries if not a manager
    if let Some(exp) = expires_at {
        TRIAL_EXPIRIES.with(|trials| {
            trials.borrow_mut().insert(assigned_canister_id, exp);
        });
        ic_cdk::println!(
            "Added canister {} to trial expiries (expires at {})",
            assigned_canister_id,
            exp
        );
    }

    let new_user = User {
        user_id: new_user_id,
        principal,
        username: req.username.clone(),
        user_canister_id: assigned_canister_id,
        enc_salt: None,
        enc_validator: None,
        status: UserStatus::Pending(current_time),
    };

    // Store in Stable Storage
    USERS.with(|users| {
        users.borrow_mut().insert(
            StorablePrincipal(principal),
            CandidWrapper(new_user.clone()),
        );
    });

    // Track in Heap Index for GC
    PENDING_USERS.with(|pending| {
        pending.borrow_mut().insert(principal, current_time);
    });

    ic_cdk::println!(
        "Stored new user record for principal {} with user_id {} (Pending) on canister {}",
        principal,
        new_user_id,
        assigned_canister_id
    );

    Ok(RegisterUserResponse {
        user_id: new_user_id,
        principal,
        username: req.username,
        user_canister_id: assigned_canister_id,
    })
}

#[update]
pub fn confirm_registration(
    req: ConfirmRegistrationRequest,
) -> CanisterResult<ConfirmRegistrationResponse> {
    let caller = ic_cdk::api::msg_caller();
    let user_principal = req.user_principal;

    ic_cdk::println!(
        "confirm_registration called by canister {} for user {}",
        caller,
        user_principal
    );

    let mut user_to_update = USERS
        .with(|users| users.borrow().get(&StorablePrincipal(user_principal)))
        .ok_or(CanisterError::UserNotFound)?
        .0;

    // Security Check: Ensure the caller is indeed the assigned canister
    if user_to_update.user_canister_id != caller {
        ic_cdk::println!(
            "Security Alert: Unauthorized confirmation attempt. Expected {}, got {}",
            user_to_update.user_canister_id,
            caller
        );
        return Err(CanisterError::Unauthorized);
    }

    if user_to_update.status == UserStatus::Active {
        ic_cdk::println!("User {} is already active.", user_principal);
        return Ok(ConfirmRegistrationResponse {});
    }

    user_to_update.status = UserStatus::Active;

    USERS.with(|users| {
        users.borrow_mut().insert(
            StorablePrincipal(user_principal),
            CandidWrapper(user_to_update),
        )
    });

    // Remove from Pending Index
    PENDING_USERS.with(|pending| {
        pending.borrow_mut().remove(&user_principal);
    });

    ic_cdk::println!("User {} confirmed and active.", user_principal);
    Ok(ConfirmRegistrationResponse {})
}

#[query]
pub fn get_user_assignment(
    req: GetUserAssignmentRequest,
) -> CanisterResult<GetUserAssignmentResponse> {
    ic_cdk::println!(
        "get_user_assignment called for principal: {}",
        req.user_principal
    );
    let assignment = USERS.with(|users| {
        users
            .borrow()
            .get(&StorablePrincipal(req.user_principal))
            .map(|wrapper| wrapper.0.user_canister_id)
    });

    match assignment {
        Some(canister_id) => {
            ic_cdk::println!(
                "Found assignment for principal {}: {}",
                req.user_principal,
                canister_id
            );
            Ok(GetUserAssignmentResponse {
                assigned_canister: vec![canister_id],
            })
        }
        None => {
            ic_cdk::println!("No assignment found for principal {}", req.user_principal);
            Ok(GetUserAssignmentResponse {
                assigned_canister: vec![],
            })
        }
    }
}

#[query]
pub fn whoami(_req: WhoAmIRequest) -> WhoAmIResponse {
    let principal = ic_cdk::api::msg_caller();
    ic_cdk::println!("whoami called by principal: {}", principal);

    USERS.with(|users| {
        users
            .borrow()
            .get(&StorablePrincipal(principal))
            .map(|wrapper| WhoAmIResponse {
                principal,
                username: wrapper.0.username.clone(),
            })
            .unwrap_or_else(|| {
                ic_cdk::trap(format!(
                    "UserNotFound: principal {} is not registered. Call register_user first.",
                    principal
                ))
            })
    })
}

#[query]
pub fn raw_whoami(_req: RawWhoAmIRequest) -> RawWhoAmIResponse {
    let principal = ic_cdk::api::msg_caller();
    ic_cdk::println!("raw_whoami called by principal: {}", principal);
    RawWhoAmIResponse { principal }
}
