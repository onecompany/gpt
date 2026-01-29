use crate::core::error::NodeError;
use crate::clients::canister::instrumented_canister_call;
use candid::{Decode, Encode};
use gpt_types::{
    api::{NodeGetMessageRequest, NodeGetMessageResponse, NodeGetMessageResult},
    domain::Message,
    error::CanisterResult,
};
use ic_agent::{Agent, export::Principal};
use tracing::{debug, error, warn};

pub async fn fetch_message(
    agent: &Agent,
    message_id: u64,
    chat_id: u64,
    user_canister_principal: Principal,
) -> Result<Option<Message>, NodeError> {
    debug!(message_id, chat_id, "Fetching message from user canister");

    let get_message_args = match Encode!(&NodeGetMessageRequest { message_id }) {
        Ok(args) => args,
        Err(e) => {
            error!(error = ?e, "Failed to encode NodeGetMessageRequest");
            return Err(NodeError::Candid(e));
        }
    };

    let operation = || async {
        agent
            .query(&user_canister_principal, "node_get_message")
            .with_arg(get_message_args.clone())
            .call()
            .await
    };

    let response_bytes = match instrumented_canister_call(
        "fetch_message",
        false,
        &user_canister_principal,
        "node_get_message",
        operation,
        Some(3),
    )
    .await
    {
        Ok(bytes) => bytes,
        Err(e) => {
            error!(
                message_id,
                error = %e,
                "Failed to fetch message after retries"
            );
            return Err(e);
        }
    };

    let decoded_result: NodeGetMessageResult = match Decode!(&response_bytes, NodeGetMessageResult)
    {
        Ok(res) => res,
        Err(e) => {
            error!(error = %e, "Failed to decode NodeGetMessageResponse");
            return Err(NodeError::Candid(e));
        }
    };

    let result: CanisterResult<NodeGetMessageResponse> = decoded_result.into();

    match result {
        Ok(resp) => {
            let msg = resp.message;
            if msg.chat_id != chat_id {
                warn!(
                    message_id,
                    reported_chat_id = msg.chat_id,
                    expected_chat_id = chat_id,
                    "Message belongs to a different chat"
                );
                return Ok(None);
            }
            // Redacted log: Do not log full message content
            debug!(
                message_id = msg.message_id,
                chat_id = msg.chat_id,
                role = ?msg.role,
                "Successfully fetched and validated message"
            );
            Ok(Some(msg))
        }
        Err(e) => {
            error!(
                message_id,
                error = ?e,
                "Canister error when fetching message"
            );
            Err(NodeError::Canister(e))
        }
    }
}
