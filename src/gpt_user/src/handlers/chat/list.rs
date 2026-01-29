use crate::helpers::user_helpers::verify_owner;
use crate::storage::CHATS;
use gpt_types::api::{ListChatsRequest, ListChatsResponse, ListChatsResult};
use gpt_types::domain::Chat;
use ic_cdk_macros::query;

#[query]
pub fn list_chats(req: ListChatsRequest) -> ListChatsResult {
    ic_cdk::println!("list_chats called with request: {:?}", req);

    let caller = ic_cdk::api::msg_caller();
    if let Err(e) = verify_owner(caller) {
        ic_cdk::trap(format!("User not authorized: {:?}", e));
    }

    // Single user canister - all chats belong to the owner
    let mut chats: Vec<Chat> = CHATS.with(|c| {
        let chats_map = c.borrow();
        let mut result = Vec::new();
        for entry in chats_map.iter() {
            let chat = entry.value().0.clone();
            if req.include_archived || !chat.archived {
                result.push(chat);
            }
        }
        result
    });

    chats.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(ListChatsResponse { chats })
}
