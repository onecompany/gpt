mod config;
mod handlers;
mod storage;
mod wasm_assets;

use candid::Principal;
use gpt_types::api::common::CanisterPoolState;
use gpt_types::prelude::*;
use ic_cdk::export_candid;
use ic_cdk_timers::{TimerId, set_timer};

use crate::storage::{
    AVAILABLE_CANISTERS, CANISTER_POOL, CONFIG, PENDING_USERS, StorablePrincipal, TRIAL_EXPIRIES,
    USERS,
};
pub use handlers::*;

/// Sets up a periodic timer to perform:
/// 1. Garbage collection on expired pending registrations
/// 2. Expiry of trial canisters (returns them to pool)
/// 3. Pool replenishment (maintains minimum available canisters)
pub fn setup_rebalancer_timer() {
    ic_cdk::println!(
        "Setting up GC timer: First tick after {:?}, subsequent ticks every {:?}.",
        config::REBALANCER_FIRST_DELAY,
        config::REBALANCER_INTERVAL
    );
    let _timer_id: TimerId = set_timer(config::REBALANCER_FIRST_DELAY, || {
        ic_cdk::futures::spawn(gc_tick_handler());
    });
}

async fn gc_tick_handler() {
    ic_cdk::println!("GC tick handler executing...");

    let _next_timer_id: TimerId = set_timer(config::REBALANCER_INTERVAL, || {
        ic_cdk::futures::spawn(gc_tick_handler());
    });
    ic_cdk::println!(
        "Scheduled next GC tick in {:?}.",
        config::REBALANCER_INTERVAL
    );

    ic_cdk::futures::spawn(async {
        ic_cdk::println!("Spawning gc_tick_inner...");
        match gc_tick_inner().await {
            Ok(()) => {
                ic_cdk::println!("gc_tick_inner completed successfully.");
            }
            Err(e) => {
                ic_cdk::println!("ERROR during gc_tick_inner: {:?}", e);
            }
        }
    });
}

async fn gc_tick_inner() -> CanisterResult<()> {
    let current_time = ic_cdk::api::time();

    // === PART 1: Handle Expired Pending Registrations ===
    // Users who started registration but never finalized within 15 minutes
    let expired_pending_users = PENDING_USERS.with(|pending| {
        let mut map = pending.borrow_mut();
        let mut expired = Vec::new();
        let mut keys_to_remove = Vec::new();

        for (principal, timestamp) in map.iter() {
            if current_time.saturating_sub(*timestamp) > config::PENDING_USER_TIMEOUT_NS {
                expired.push(*principal);
                keys_to_remove.push(*principal);
            }
        }

        for k in keys_to_remove {
            map.remove(&k);
        }
        expired
    });

    if !expired_pending_users.is_empty() {
        ic_cdk::println!(
            "GC: Found {} expired pending users. Cleaning up...",
            expired_pending_users.len()
        );

        for principal in expired_pending_users {
            handle_expired_pending_user(principal).await;
        }
    } else {
        ic_cdk::println!("GC: No expired pending users found.");
    }

    // === PART 2: Handle Expired Trial Canisters ===
    // Trial users whose 1-hour trial has expired
    let expired_trials: Vec<Principal> = TRIAL_EXPIRIES.with(|trials| {
        let map = trials.borrow();
        map.iter()
            .filter(|(_, expires_at)| current_time >= **expires_at)
            .map(|(canister_id, _)| *canister_id)
            .collect()
    });

    if !expired_trials.is_empty() {
        ic_cdk::println!(
            "GC: Found {} expired trial canisters. Processing...",
            expired_trials.len()
        );

        for canister_id in expired_trials {
            handle_expired_trial_canister(canister_id).await;
        }
    } else {
        ic_cdk::println!("GC: No expired trial canisters found.");
    }

    // === PART 3: Replenish Pool ===
    // Ensure we have at least pool_target_size available canisters
    replenish_pool().await;

    Ok(())
}

/// Handles cleanup of a user whose pending registration has expired.
async fn handle_expired_pending_user(principal: Principal) {
    ic_cdk::println!("GC: Cleaning up expired pending user {}", principal);

    // Get user's canister and clean up
    if let Some(user_wrapper) =
        USERS.with(|users| users.borrow_mut().remove(&StorablePrincipal(principal)))
    {
        let user = user_wrapper.0;
        let canister_id = user.user_canister_id;

        ic_cdk::println!(
            "GC: Expired pending user {}, returning canister {} to pool",
            principal,
            canister_id
        );

        // Return canister to pool (uninstall code)
        return_canister_to_pool(canister_id).await;
    }
}

/// Handles expiry of a trial canister.
/// Uninstalls code and returns the canister to the available pool.
async fn handle_expired_trial_canister(canister_id: Principal) {
    ic_cdk::println!("GC: Trial canister {} expired, returning to pool", canister_id);

    // Find the owner from CANISTER_POOL
    let owner = CANISTER_POOL.with(|pool| {
        if let Some(wrapper) = pool.borrow().get(&StorablePrincipal(canister_id)) {
            if let CanisterPoolState::Assigned { owner, .. } = &wrapper.0.state {
                return Some(*owner);
            }
        }
        None
    });

    if let Some(owner_principal) = owner {
        // Remove user record
        USERS.with(|users| {
            users.borrow_mut().remove(&StorablePrincipal(owner_principal));
        });
        // Also clean from PENDING_USERS if present
        PENDING_USERS.with(|pending| {
            pending.borrow_mut().remove(&owner_principal);
        });
        ic_cdk::println!(
            "GC: Removed user {} associated with expired trial canister {}",
            owner_principal,
            canister_id
        );
    }

    // Return canister to pool (uninstall code, update state, add to available)
    return_canister_to_pool(canister_id).await;
}

/// Ensures the pool has pool_target_size total canisters (available + assigned).
/// Only creates new canisters if total is below the target.
async fn replenish_pool() {
    let current_available = AVAILABLE_CANISTERS.with(|a| a.borrow().len());
    let total_in_pool = CANISTER_POOL.with(|p| p.borrow().len()) as usize;
    let target = CONFIG.with(|c| c.borrow().get().0.pool_target_size) as usize;

    if total_in_pool < target {
        let to_create = target - total_in_pool;
        ic_cdk::println!(
            "GC: Pool has {} total ({} available), target is {}. Creating {} canisters.",
            total_in_pool,
            current_available,
            target,
            to_create
        );

        for i in 0..to_create {
            match create_empty_canister_for_pool().await {
                Ok(cid) => {
                    ic_cdk::println!(
                        "GC: Created canister {} for pool ({}/{})",
                        cid,
                        i + 1,
                        to_create
                    );
                }
                Err(e) => {
                    ic_cdk::println!(
                        "GC: Failed to create canister for pool: {:?}. Stopping replenishment.",
                        e
                    );
                    break; // Stop on failure (likely out of cycles)
                }
            }
        }
    } else {
        ic_cdk::println!(
            "GC: Pool size OK ({} total, {} available, target {})",
            total_in_pool,
            current_available,
            target
        );
    }
}

// Exposes the public Candid interface for this canister.
export_candid!();
