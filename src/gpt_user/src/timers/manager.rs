use super::{cleanup, sync};
use ic_cdk_timers::{set_timer, set_timer_interval};
use std::time::Duration;

const PERIODIC_INTERVAL_SECONDS: u64 = 120;

/// Triggers an immediate sync of models and nodes.
/// Uses set_timer with Duration::ZERO to run after init completes
/// (inter-canister calls can't be made during init itself).
pub fn trigger_immediate_sync() {
    ic_cdk::println!("Scheduling immediate sync of models and nodes...");
    set_timer(Duration::ZERO, || {
        ic_cdk::futures::spawn(perform_initial_sync());
    });
}

async fn perform_initial_sync() {
    ic_cdk::println!("Starting Initial Canister Sync...");
    sync::sync_nodes_with_index().await;
    sync::sync_models_with_index().await;
    ic_cdk::println!("Finished Initial Canister Sync");
}

pub fn setup_periodic_tasks_timer() {
    ic_cdk::println!(
        "Setting up periodic tasks timer to run every {} seconds.",
        PERIODIC_INTERVAL_SECONDS
    );
    set_timer_interval(Duration::from_secs(PERIODIC_INTERVAL_SECONDS), || {
        ic_cdk::futures::spawn(perform_periodic_tasks());
    });
}

async fn perform_periodic_tasks() {
    ic_cdk::println!("Starting Periodic Canister Tasks...");

    sync::sync_nodes_with_index().await;
    sync::sync_models_with_index().await;
    cleanup::time_out_stale_jobs().await;
    cleanup::cleanup_old_chats().await;

    ic_cdk::println!("Finished Periodic Canister Tasks");
}
