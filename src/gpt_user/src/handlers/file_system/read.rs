use super::utils::{get_or_create_root_folder_id, resolve_path};
use crate::helpers::user_helpers::verify_owner;
use crate::storage::{FILES_CONTENT, FILES_METADATA, FOLDER_CONTENTS_INDEX, FOLDERS};
use gpt_types::{
    api::{
        FileInfo, FolderInfo, GetFileContentRequest, GetFileContentResponse, GetFileContentResult,
        GetFolderContentRequest, GetFolderContentResponse, GetFolderContentResult,
        GetItemByPathRequest, GetItemByPathResponse, GetItemByPathResult,
    },
    domain::ROOT_FOLDER_ID,
    error::CanisterError,
};
use ic_cdk_macros::query;

#[query]
pub fn get_folder_content(req: GetFolderContentRequest) -> GetFolderContentResult {
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    let target_folder_id = match req.folder_id {
        Some(id) => id,
        None => get_or_create_root_folder_id()?,
    };

    // Get folder
    let folder = FOLDERS
        .with(|f| f.borrow().get(&target_folder_id).map(|w| w.0.clone()))
        .ok_or(CanisterError::FolderNotFound)?;

    // Verify ownership
    if folder.owner != caller {
        return Err(CanisterError::Unauthorized);
    }

    // Get folder contents
    let contents = FOLDER_CONTENTS_INDEX
        .with(|idx| idx.borrow().get(&target_folder_id).map(|w| w.0.clone()))
        .unwrap_or_default();

    // Get child folders
    let folders = FOLDERS.with(|f_map| {
        let all_folders = f_map.borrow();
        contents
            .child_folder_ids
            .iter()
            .filter_map(|id| all_folders.get(id).map(|w| w.0.clone()))
            .map(|f| FolderInfo {
                id: f.id,
                name: f.name,
                created_at: f.created_at,
                updated_at: f.updated_at,
            })
            .collect()
    });

    // Get child files
    let files = FILES_METADATA.with(|f_map| {
        let all_files = f_map.borrow();
        contents
            .child_file_ids
            .iter()
            .filter_map(|id| all_files.get(id).map(|w| w.0.clone()))
            .map(|f| FileInfo {
                id: f.id,
                name: f.name,
                mime_type: f.mime_type,
                content_size_bytes: f.content_size_bytes,
                created_at: f.created_at,
                updated_at: f.updated_at,
                parent_folder_id: f.parent_folder_id,
                chunks: f.chunks,
            })
            .collect()
    });

    Ok(GetFolderContentResponse {
        folders,
        files,
        folder_id: folder.id,
        folder_name: folder.name,
        parent_folder_id: if folder.parent_folder_id == ROOT_FOLDER_ID {
            None
        } else {
            Some(folder.parent_folder_id)
        },
    })
}

#[query]
pub fn get_file_content(req: GetFileContentRequest) -> GetFileContentResult {
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    // Get file metadata
    let file_metadata = FILES_METADATA
        .with(|fm| fm.borrow().get(&req.file_id).map(|w| w.0.clone()))
        .ok_or(CanisterError::FileNotFound)?;

    // Verify ownership
    if file_metadata.owner != caller {
        return Err(CanisterError::Unauthorized);
    }

    // Get file content
    let file_content = FILES_CONTENT
        .with(|fc| fc.borrow().get(&req.file_id).map(|w| w.0.clone()))
        .ok_or(CanisterError::FileNotFound)?;

    Ok(GetFileContentResponse {
        content: file_content,
        mime_type: file_metadata.mime_type,
    })
}

#[query]
pub fn get_item_by_path(req: GetItemByPathRequest) -> GetItemByPathResult {
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    let result = resolve_path(&req.path);
    match result {
        Ok(item_info) => Ok(GetItemByPathResponse { item: item_info }),
        Err(e) => Err(e),
    }
}
