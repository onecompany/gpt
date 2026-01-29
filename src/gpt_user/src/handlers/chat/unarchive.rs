use crate::helpers::user_helpers::verify_owner;
use crate::storage::{CandidWrapper, CHATS};
use gpt_types::api::{UnarchiveChatRequest, UnarchiveChatResponse, UnarchiveChatResult};
use gpt_types::error::CanisterError;
use ic_cdk::api;
use ic_cdk_macros::update;

#[update]
pub fn unarchive_chat(req: UnarchiveChatRequest) -> UnarchiveChatResult {
    ic_cdk::println!("unarchive_chat called with request: {:?}", req);

    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    let updated_chat = CHATS.with(|c| {
        let mut chats = c.borrow_mut();

        // Get the chat
        let chat_opt = chats.get(&req.chat_id);
        let mut chat = match chat_opt {
            Some(w) => w.0.clone(),
            None => return Err(CanisterError::ChatNotFound),
        };

        if chat.owner != caller {
            return Err(CanisterError::Unauthorized);
        }

        chat.archived = false;
        chat.updated_at = api::time();

        // Insert the updated chat back
        chats.insert(req.chat_id, CandidWrapper(chat.clone()));
        Ok(chat)
    })?;

    Ok(UnarchiveChatResponse { chat: updated_chat })
}
