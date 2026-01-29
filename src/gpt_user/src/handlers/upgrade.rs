use ic_cdk_macros::{post_upgrade, pre_upgrade};

/// Pre-upgrade handler.
/// With stable-structures, data persists automatically across upgrades.
/// No serialization needed.
#[pre_upgrade]
fn pre_upgrade_handler() {
    ic_cdk::println!("gpt_user pre_upgrade: Stable structures persist automatically.");
}

/// Post-upgrade handler.
/// Reinitialize timers after upgrade.
#[post_upgrade]
fn post_upgrade_handler() {
    ic_cdk::println!("gpt_user post_upgrade: Reinitializing timers.");
    crate::timers::manager::setup_periodic_tasks_timer();
    ic_cdk::println!("gpt_user post_upgrade completed.");
}
