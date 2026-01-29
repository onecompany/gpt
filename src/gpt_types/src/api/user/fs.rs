use crate::domain::text_chunk::TextChunk;
use crate::domain::{FileId, file_system::FolderId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct FolderInfo {
    pub id: FolderId,
    pub name: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct FileInfo {
    pub id: FileId,
    pub name: String,
    pub mime_type: String,
    pub content_size_bytes: u64,
    pub created_at: u64,
    pub updated_at: u64,
    pub parent_folder_id: FolderId,
    pub chunks: Vec<TextChunk>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetFolderContentRequest {
    pub folder_id: Option<FolderId>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetFolderContentResponse {
    pub folders: Vec<FolderInfo>,
    pub files: Vec<FileInfo>,
    pub folder_id: FolderId,
    pub folder_name: String,
    pub parent_folder_id: Option<FolderId>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetFileContentRequest {
    pub file_id: FileId,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetFileContentResponse {
    #[serde(with = "serde_bytes")]
    pub content: Vec<u8>,
    pub mime_type: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct CreateFolderRequest {
    pub name: String,
    pub parent_folder_id: FolderId,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct CreateFolderResponse {
    pub folder: FolderInfo,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UploadFileRequest {
    pub name: String,
    pub parent_folder_id: FolderId,
    pub mime_type: String,
    #[serde(with = "serde_bytes")]
    pub content: Vec<u8>,
    pub chunks: Option<Vec<TextChunk>>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UploadFileResponse {
    pub file: FileInfo,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub enum FsItemType {
    File,
    Folder,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RenameItemRequest {
    pub item_id: u64,
    pub item_type: FsItemType,
    pub new_name: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub enum FsItemInfo {
    File(FileInfo),
    Folder(FolderInfo),
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct RenameItemResponse {
    pub item: FsItemInfo,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct DeleteItemRequest {
    pub item_id: u64,
    pub item_type: FsItemType,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct DeleteItemResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetItemByPathRequest {
    pub path: String,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetItemByPathResponse {
    pub item: FsItemInfo,
}
