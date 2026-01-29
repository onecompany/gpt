use crate::domain::common::GenerationStatus;
use crate::domain::common::{ChatId, JobId, MessageId, ModelId, NodeId};
use crate::domain::tool::Tool;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct Job {
    pub job_id: JobId,
    pub chat_id: ChatId,
    pub generation_status: GenerationStatus,
    pub temperature: f32,
    pub max_completion_tokens: u32,
    pub max_context: u32,
    pub model_id: ModelId,
    pub node_id: NodeId,
    pub placeholder_message_id: MessageId,
    pub custom_prompt: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub tools: Option<Vec<Tool>>,
    pub extra_body_json: Option<String>,
    pub reasoning_effort: Option<String>,
    pub encrypted_chat_key: Option<String>,
}
