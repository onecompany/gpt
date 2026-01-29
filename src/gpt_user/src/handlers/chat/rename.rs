use crate::helpers::user_helpers::verify_owner;
use crate::storage::{CandidWrapper, CHATS};
use gpt_types::api::{RenameChatRequest, RenameChatResponse, RenameChatResult};
use gpt_types::error::CanisterError;
use ic_cdk::api;
use ic_cdk_macros::update;

#[update]
pub fn rename_chat(req: RenameChatRequest) -> RenameChatResult {
    ic_cdk::println!("rename_chat called with request: {:?}", req);

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

        chat.title = req.new_title.clone();
        chat.updated_at = api::time();

        // Insert the updated chat back
        chats.insert(req.chat_id, CandidWrapper(chat.clone()));
        Ok(chat)
    })?;

    Ok(RenameChatResponse { chat: updated_chat })
}
