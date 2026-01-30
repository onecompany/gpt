// This is the main library for the `gpt_user` canister. Each instance of this canister
// is dedicated to a single user, storing their chats, messages, files, and jobs.
// It is controlled by the central `gpt_index` canister, which creates one canister per user.

use candid::Principal;
use ic_cdk::export_candid;
use ic_cdk_macros::init;

use gpt_types::prelude::*;

mod config;
mod handlers;
mod helpers;
mod storage;
mod timers;

/// The canister's initialization function, called only on creation.
/// It stores the principal of its parent `gpt_index` canister, which is the only
/// principal authorized to manage this canister.
#[init]
fn init(parent_canister_id: Principal) {
    ic_cdk::println!(
        "gpt_user init called. Setting parent_canister to {}",
        parent_canister_id
    );
    storage::set_parent_canister(parent_canister_id);
    // Set up periodic background tasks (e.g., syncing with index).
    timers::manager::setup_periodic_tasks_timer();
    // Trigger immediate sync so models/nodes are available right away.
    timers::manager::trigger_immediate_sync();
    ic_cdk::println!("gpt_user init completed.");
}

// Exposes the public Candid interface for this canister, making its methods callable.
export_candid!();
