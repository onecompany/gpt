use crate::domain::chat::Chat;
use crate::domain::common::{ChatId, JobId, MessageId, ModelId};
use crate::domain::job::Job;
use crate::domain::message::ImageAttachment;
use crate::domain::tool::Tool;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ListChatsRequest {
    pub include_archived: bool,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ListChatsResponse {
    pub chats: Vec<Chat>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct CreateChatRequest {
    pub title: String,
    #[serde(with = "serde_bytes")]
    pub initial_message: Vec<u8>,
    pub temperature: f32,
    pub max_completion_tokens: u32,
    pub max_context: u32,
    pub model_id: ModelId,
    pub node_id: u64,
    pub custom_prompt: Option<String>,
    pub temporary: bool,
    pub attachments: Option<Vec<ImageAttachment>>,
    pub tools: Option<Vec<Tool>>,
    #[serde(with = "serde_bytes")]
    pub encryption_salt: Vec<u8>,
    pub encrypted_chat_key: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct CreateChatResponse {
    pub chat_id: ChatId,
    pub user_message_id: MessageId,
    pub ai_message_id: MessageId,
    pub job_id: JobId,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct DeleteChatRequest {
    pub chat_id: u64,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct DeleteChatResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ArchiveChatRequest {
    pub chat_id: u64,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct ArchiveChatResponse {
    pub chat: Chat,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UnarchiveChatRequest {
    pub chat_id: u64,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UnarchiveChatResponse {
    pub chat: Chat,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RenameChatRequest {
    pub chat_id: u64,
    pub new_title: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RenameChatResponse {
    pub chat: Chat,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetChatRequest {
    pub chat_id: ChatId,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetChatResponse {
    pub chat: Chat,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetChatJobsRequest {
    pub chat_id: ChatId,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetChatJobsResponse {
    pub jobs: Vec<Job>,
}
