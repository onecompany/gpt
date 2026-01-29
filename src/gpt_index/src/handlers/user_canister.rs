use crate::config;
use crate::handlers::governance::verify_manager;
use crate::storage::{
    AVAILABLE_CANISTERS, CANISTER_POOL, CandidWrapper, StorablePrincipal, TRIAL_EXPIRIES,
};
use crate::wasm_assets::GPT_USER_WASM;
use candid::{Encode, Principal};
use gpt_types::api::common::{CanisterPoolEntry, CanisterPoolState};
use gpt_types::api::{
    CreateUserCanisterResponse, ListCanisterPoolResponse, ListCanisterPoolResult,
    ListUserCanistersResponse, ListUserCanistersResult, ProvisionCanistersRequest,
    ProvisionCanistersResponse, ProvisionCanistersResult,
};
use gpt_types::error::{CanisterError, CanisterResult};
use ic_cdk::api::canister_self;
use ic_cdk::management_canister::{
    CanisterInstallMode, CanisterSettings, CreateCanisterArgs, InstallCodeArgs,
    UninstallCodeArgs, create_canister_with_extra_cycles, install_code, uninstall_code,
};
use ic_cdk_macros::{query, update};

/// Creates an empty canister for the pool (no WASM installed).
/// This canister is ready to be assigned to a user during registration.
pub async fn create_empty_canister_for_pool() -> CanisterResult<Principal> {
    ic_cdk::println!("Creating empty canister for pool...");

    let settings = CanisterSettings {
        controllers: Some(vec![canister_self()]),
        compute_allocation: None,
        memory_allocation: None,
        freezing_threshold: None,
        reserved_cycles_limit: Some(candid::Nat::from(
            config::USER_CANISTER_RESERVED_CYCLES_LIMIT,
        )),
        log_visibility: None,
        wasm_memory_limit: None,
        wasm_memory_threshold: None,
    };

    let create_args = CreateCanisterArgs {
        settings: Some(settings),
    };

    let cycles_for_new_canister = config::CYCLES_FOR_USER_CANISTER_CREATION;

    ic_cdk::println!(
        "Calling management canister create_canister_with_extra_cycles with {} cycles...",
        cycles_for_new_canister
    );
    let create_result =
        create_canister_with_extra_cycles(&create_args, cycles_for_new_canister).await;

    let canister_id_record = create_result.map_err(|e| {
        let error_str = format!("Failed to create canister: {}", e);
        ic_cdk::println!("ERROR: {}", error_str);
        CanisterError::CallError(error_str)
    })?;

    let canister_id = canister_id_record.canister_id;
    ic_cdk::println!("Created empty canister for pool: {}", canister_id);

    // Add to pool as Available
    let entry = CanisterPoolEntry {
        canister_id,
        time_created: ic_cdk::api::time(),
        state: CanisterPoolState::Available,
    };

    CANISTER_POOL.with(|pool| {
        pool.borrow_mut()
            .insert(StorablePrincipal(canister_id), CandidWrapper(entry));
    });

    AVAILABLE_CANISTERS.with(|available| {
        available.borrow_mut().insert(canister_id);
    });

    ic_cdk::println!(
        "Added empty canister {} to pool as Available",
        canister_id
    );

    Ok(canister_id)
}

/// Installs gpt_user WASM on a canister (reinstall mode, wipes any previous state).
pub async fn install_user_wasm(canister_id: Principal) -> CanisterResult<()> {
    let parent_principal = canister_self();
    let init_arg_bytes =
        Encode!(&parent_principal).expect("BUG: Failed to encode init argument (Principal)");

    ic_cdk::println!(
        "Installing Wasm code into canister {} (Reinstall mode)...",
        canister_id
    );

    let install_args = InstallCodeArgs {
        mode: CanisterInstallMode::Reinstall,
        canister_id,
        wasm_module: GPT_USER_WASM.to_vec(),
        arg: init_arg_bytes,
    };

    install_code(&install_args).await.map_err(|e| {
        let error_str = format!("Failed to install code into {}: {}", canister_id, e);
        ic_cdk::println!("ERROR: {}", error_str);
        CanisterError::CallError(error_str)
    })?;

    ic_cdk::println!("WASM installed successfully on canister: {}", canister_id);
    Ok(())
}

/// Uninstalls code from a canister (returns it to empty state for pool).
pub async fn uninstall_user_wasm(canister_id: Principal) -> CanisterResult<()> {
    ic_cdk::println!("Uninstalling code from canister {}...", canister_id);

    let args = UninstallCodeArgs { canister_id };

    uninstall_code(&args).await.map_err(|e| {
        let error_str = format!("Failed to uninstall code from {}: {}", canister_id, e);
        ic_cdk::println!("ERROR: {}", error_str);
        CanisterError::CallError(error_str)
    })?;

    ic_cdk::println!("Code uninstalled from canister: {}", canister_id);
    Ok(())
}

/// Returns a canister to the available pool after uninstalling its code.
pub async fn return_canister_to_pool(canister_id: Principal) {
    // 1. Uninstall code
    match uninstall_user_wasm(canister_id).await {
        Ok(_) => {
            ic_cdk::println!("Uninstalled code from {}", canister_id);
        }
        Err(e) => {
            ic_cdk::println!(
                "Failed to uninstall code from {} (may already be empty): {:?}",
                canister_id,
                e
            );
            // Continue anyway - canister might already have no code
        }
    }

    // 2. Update pool entry to Available
    CANISTER_POOL.with(|pool| {
        let mut pool_map = pool.borrow_mut();
        let key = StorablePrincipal(canister_id);
        if let Some(wrapper) = pool_map.get(&key) {
            let mut entry = wrapper.0.clone();
            entry.state = CanisterPoolState::Available;
            pool_map.insert(key, CandidWrapper(entry));
        }
    });

    // 3. Add back to available set
    AVAILABLE_CANISTERS.with(|available| {
        available.borrow_mut().insert(canister_id);
    });

    // 4. Remove from trial expiries
    TRIAL_EXPIRIES.with(|trials| {
        trials.borrow_mut().remove(&canister_id);
    });

    ic_cdk::println!("Canister {} returned to available pool", canister_id);
}

/// Takes an available canister from the pool.
/// Returns PoolExhausted error if no canisters are available.
pub async fn take_canister_from_pool() -> CanisterResult<Principal> {
    // Try to get from available pool
    let available_canister = AVAILABLE_CANISTERS.with(|available| {
        let mut set = available.borrow_mut();
        set.pop_first() // BTreeSet pop_first for deterministic ordering
    });

    match available_canister {
        Some(canister_id) => {
            ic_cdk::println!("Taking canister {} from pool", canister_id);
            Ok(canister_id)
        }
        None => {
            // Pool exhausted - no available canisters
            ic_cdk::println!("Pool exhausted - no available canisters for registration");
            Err(CanisterError::PoolExhausted)
        }
    }
}

/// Provisions additional canisters into the pool (manager-only).
#[update]
pub async fn provision_canisters(req: ProvisionCanistersRequest) -> ProvisionCanistersResult {
    verify_manager()?;

    ic_cdk::println!(
        "Manager provisioning {} canisters into pool...",
        req.count
    );

    let mut created = 0u32;
    for _ in 0..req.count {
        match create_empty_canister_for_pool().await {
            Ok(cid) => {
                ic_cdk::println!("Provisioned canister {} into pool", cid);
                created += 1;
            }
            Err(e) => {
                ic_cdk::println!("Failed to create canister during provisioning: {:?}", e);
                break; // Stop on failure (likely out of cycles)
            }
        }
    }

    let pool_size = AVAILABLE_CANISTERS.with(|a| a.borrow().len() as u32);

    ic_cdk::println!(
        "Provisioning complete. Created {} canisters. Pool size: {}",
        created,
        pool_size
    );

    Ok(ProvisionCanistersResponse {
        canisters_created: created,
        pool_size,
    })
}

/// Creates a new user canister and adds it to the pool (manager-only or self-call).
/// This is the legacy endpoint - for pool management, use provision_canisters.
#[update]
pub async fn create_user_canister() -> CanisterResult<CreateUserCanisterResponse> {
    let caller = ic_cdk::api::msg_caller();

    // Authorization: Allow if caller is the canister itself (auto-creation) OR if caller is a manager
    if caller != canister_self() && verify_manager().is_err() {
        let error_msg =
            "Unauthorized call to create_user_canister: Caller is neither self nor a manager."
                .to_string();
        ic_cdk::println!("ERROR: {}", error_msg);
        return Err(CanisterError::Unauthorized);
    }

    let canister_id = create_empty_canister_for_pool().await?;
    Ok(CreateUserCanisterResponse { canister_id })
}

/// Lists all canisters in the pool (available and assigned).
#[query]
pub fn list_user_canisters() -> ListUserCanistersResult {
    ic_cdk::println!("Listing all user canisters in pool.");

    let canisters = CANISTER_POOL.with(|pool| {
        pool.borrow()
            .iter()
            .map(|(_, wrapper)| wrapper.0.clone())
            .collect::<Vec<CanisterPoolEntry>>()
    });

    Ok(ListUserCanistersResponse { canisters })
}

/// Lists canister pool status with separation between available and assigned.
#[query]
pub fn list_canister_pool() -> ListCanisterPoolResult {
    ic_cdk::println!("Listing canister pool status.");

    let (available, assigned) = CANISTER_POOL.with(|pool| {
        let pool_map = pool.borrow();
        let mut avail = Vec::new();
        let mut assign = Vec::new();

        for (_, wrapper) in pool_map.iter() {
            let entry = wrapper.0.clone();
            match &entry.state {
                CanisterPoolState::Available => avail.push(entry),
                CanisterPoolState::Assigned { .. } => assign.push(entry),
            }
        }
        (avail, assign)
    });

    let pool_target_size = crate::storage::CONFIG.with(|c| c.borrow().get().0.pool_target_size);

    Ok(ListCanisterPoolResponse {
        available,
        assigned,
        pool_target_size,
    })
}
