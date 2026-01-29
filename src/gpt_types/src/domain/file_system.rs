use super::text_chunk::TextChunk;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

pub type FolderId = u64;

pub type FileId = u64;

pub const ROOT_FOLDER_ID: FolderId = 0;

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct Folder {
    pub id: FolderId,
    pub owner: Principal,
    pub name: String,
    pub parent_folder_id: FolderId,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct FileMetadata {
    pub id: FileId,
    pub owner: Principal,
    pub name: String,
    pub parent_folder_id: FolderId,
    pub mime_type: String,
    pub content_size_bytes: u64,
    pub chunks: Vec<TextChunk>,
    pub created_at: u64,
    pub updated_at: u64,
}
