use crate::helpers::user_helpers::verify_owner;
use crate::storage::{CHATS, MESSAGES};
use gpt_types::api::{GetMessageRequest, GetMessageResponse, GetMessageResult};
use gpt_types::error::CanisterError;
use ic_cdk_macros::query;

#[query]
pub fn get_message(req: GetMessageRequest) -> GetMessageResult {
    ic_cdk::println!("get_message called with request: {:?}", req);

    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    let msg_opt = MESSAGES.with(|m| m.borrow().get(&req.message_id).map(|w| w.0.clone()));
    let msg = match msg_opt {
        Some(m) => m,
        None => return Err(CanisterError::MessageNotFound),
    };

    let chat_opt = CHATS.with(|c| c.borrow().get(&msg.chat_id).map(|w| w.0.clone()));
    let chat = match chat_opt {
        Some(ch) => ch,
        None => return Err(CanisterError::ChatNotFound),
    };

    if chat.owner != caller {
        return Err(CanisterError::Unauthorized);
    }

    Ok(GetMessageResponse { message: msg })
}
