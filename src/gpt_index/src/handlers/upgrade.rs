use crate::config;
use crate::storage::{
    AVAILABLE_CANISTERS, CANISTER_POOL, CONFIG, NODE_OWNER_INDEX, NODE_PRINCIPAL_INDEX, NODES,
    PENDING_USERS, TRIAL_EXPIRIES, USERS,
};
use gpt_types::api::common::CanisterPoolState;
use gpt_types::domain::UserStatus;
use gpt_types::domain::node::{AttestationRequirements, GenTcbRequirements, TcbVersion};
use ic_cdk_macros::{init, post_upgrade, pre_upgrade};

#[init]
pub fn init_canister() {
    ic_cdk::println!("init_canister called");

    CONFIG.with(|c| {
        let mut wrapper = c.borrow().get().clone();

        if wrapper.0.next_user_id == 0 {
            wrapper.0.next_user_id = 1;
        }
        if wrapper.0.next_node_id == 0 {
            wrapper.0.next_node_id = 1;
        }
        if wrapper.0.attestation_requirements.is_none() {
            wrapper.0.attestation_requirements = Some(get_default_attestation_requirements());
        }
        // Initialize pool_target_size to default if not set
        if wrapper.0.pool_target_size == 0 {
            wrapper.0.pool_target_size = config::DEFAULT_POOL_TARGET_SIZE;
            ic_cdk::println!(
                "Initialized pool_target_size to {}",
                config::DEFAULT_POOL_TARGET_SIZE
            );
        }

        c.borrow_mut()
            .set(wrapper)
            .expect("Failed to update config");
    });

    crate::setup_rebalancer_timer();
    crate::handlers::liveness::setup_liveness_timer();

    ic_cdk::println!("init_canister completed");
}

#[pre_upgrade]
pub fn pre_upgrade_handler() {
    ic_cdk::println!("pre_upgrade_handler: State is stable.");
}

#[post_upgrade]
pub fn post_upgrade_handler() {
    ic_cdk::println!("post_upgrade_handler: Rebuilding indexes...");

    // Rebuild Node Indexes
    NODES.with(|nodes| {
        let nodes_map = nodes.borrow();

        NODE_OWNER_INDEX.with(|owner_idx| {
            let mut owners = owner_idx.borrow_mut();
            owners.clear();

            NODE_PRINCIPAL_INDEX.with(|princ_idx| {
                let mut principals = princ_idx.borrow_mut();
                principals.clear();

                for (node_id, node_wrapper) in nodes_map.iter() {
                    let node = &node_wrapper.0;

                    owners.entry(node.owner).or_default().insert(node_id);

                    if let Some(p) = node.node_principal
                        && node.lifecycle_status
                            != gpt_types::domain::node::NodeLifecycleStatus::Inactive
                    {
                        principals.insert(p, node_id);
                    }
                }
            });
        });
    });

    // Rebuild Pending Users Index
    USERS.with(|users| {
        let users_map = users.borrow();
        PENDING_USERS.with(|pending| {
            let mut pending_map = pending.borrow_mut();
            pending_map.clear();

            for (principal, user_wrapper) in users_map.iter() {
                if let UserStatus::Pending(ts) = user_wrapper.0.status {
                    pending_map.insert(principal.0, ts);
                }
            }
        });
    });

    // Rebuild Pool Indexes (AVAILABLE_CANISTERS and TRIAL_EXPIRIES)
    CANISTER_POOL.with(|pool| {
        let pool_map = pool.borrow();

        AVAILABLE_CANISTERS.with(|available| {
            let mut avail_set = available.borrow_mut();
            avail_set.clear();

            TRIAL_EXPIRIES.with(|trials| {
                let mut trial_map = trials.borrow_mut();
                trial_map.clear();

                for (key, wrapper) in pool_map.iter() {
                    let entry = &wrapper.0;
                    match &entry.state {
                        CanisterPoolState::Available => {
                            avail_set.insert(key.0);
                        }
                        CanisterPoolState::Assigned {
                            expires_at: Some(exp),
                            ..
                        } => {
                            trial_map.insert(key.0, *exp);
                        }
                        CanisterPoolState::Assigned {
                            expires_at: None, ..
                        } => {
                            // Manager canister - no expiry, no action needed
                        }
                    }
                }

                ic_cdk::println!(
                    "Pool indexes rebuilt: {} available, {} trial canisters",
                    avail_set.len(),
                    trial_map.len()
                );
            });
        });
    });

    // Ensure pool_target_size is set
    CONFIG.with(|c| {
        let mut wrapper = c.borrow().get().clone();
        if wrapper.0.pool_target_size == 0 {
            wrapper.0.pool_target_size = config::DEFAULT_POOL_TARGET_SIZE;
            c.borrow_mut()
                .set(wrapper)
                .expect("Failed to update config");
            ic_cdk::println!(
                "Set pool_target_size to {} during upgrade",
                config::DEFAULT_POOL_TARGET_SIZE
            );
        }
    });

    ic_cdk::println!("Indexes rebuilt successfully.");

    crate::setup_rebalancer_timer();
    crate::handlers::liveness::setup_liveness_timer();

    ic_cdk::println!("post_upgrade_handler completed.");
}

fn get_default_attestation_requirements() -> AttestationRequirements {
    AttestationRequirements {
        min_report_version: 2,
        milan_policy: GenTcbRequirements {
            min_tcb: TcbVersion {
                bootloader: 4,
                tee: 0,
                snp: 28,
                microcode: 222,
                fmc: 0,
            },
            min_guest_svn: 0,
        },
        genoa_policy: GenTcbRequirements {
            min_tcb: TcbVersion {
                bootloader: 10,
                tee: 0,
                snp: 24,
                microcode: 84,
                fmc: 0,
            },
            min_guest_svn: 0,
        },
        turin_policy: GenTcbRequirements {
            min_tcb: TcbVersion {
                bootloader: 255,
                tee: 255,
                snp: 255,
                microcode: 255,
                fmc: 255,
            },
            min_guest_svn: 255,
        },
        require_smt_disabled: true,
        require_tsme_disabled: true,
        require_ecc_enabled: true,
        require_rapl_disabled: false,
        require_ciphertext_hiding_enabled: false,
        measurements: vec![],
        expected_measurement_len: 48,
        max_attestation_age_ns: 300_000_000_000,
    }
}
