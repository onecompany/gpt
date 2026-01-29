use crate::helpers::user_helpers::verify_owner;
use crate::storage::CHATS;
use gpt_types::api::{GetChatRequest, GetChatResponse, GetChatResult};
use gpt_types::error::CanisterError;
use ic_cdk_macros::query;

#[query]
pub fn get_chat(req: GetChatRequest) -> GetChatResult {
    ic_cdk::println!("get_chat called with request: {:?}", req);

    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    let chat_opt = CHATS.with(|c| c.borrow().get(&req.chat_id).map(|w| w.0.clone()));
    match chat_opt {
        Some(chat) => {
            if chat.owner != caller {
                Err(CanisterError::Unauthorized)
            } else {
                Ok(GetChatResponse { chat })
            }
        }
        None => Err(CanisterError::ChatNotFound),
    }
}
