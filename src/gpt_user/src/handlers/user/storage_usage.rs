use gpt_types::api::{GetUserStorageUsageResponse, GetUserStorageUsageResult};
use ic_cdk::stable::stable_size;
use ic_cdk_macros::query;

const STORAGE_LIMIT_BYTES: u64 = 7 * 1024 * 1024 * 1024; // 7 GiB

#[query]
pub fn get_user_storage_usage() -> GetUserStorageUsageResult {
    // Get stable memory size in WASM pages (64KB each)
    let stable_pages = stable_size();
    let usage_bytes = stable_pages * 65536; // Convert to bytes

    Ok(GetUserStorageUsageResponse {
        usage_bytes,
        limit_bytes: STORAGE_LIMIT_BYTES,
    })
}
