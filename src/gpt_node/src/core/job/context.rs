use super::types::MessageData;
use gpt_types::{api::ClaimJobResponse, domain::tool::Tool};
use ic_agent::export::Principal;

/// Encapsulates all data required to process an AI generation job.
/// This acts as a Request Object to prevent high-arity functions.
#[derive(Debug, Clone)]
pub struct JobProcessingContext {
    pub job_id: u64,
    pub user_canister: Principal,
    pub claim_response: ClaimJobResponse,
    pub conversation_history: Vec<MessageData>,
    pub tools: Option<Vec<Tool>>,
    pub stream_key: String,
    pub chat_key: Vec<u8>,
}
