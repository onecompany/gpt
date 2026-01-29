use super::utils::validate_item_name_and_collision;
use crate::helpers::user_helpers::verify_owner;
use crate::storage::{CandidWrapper, FILES_METADATA, FOLDERS};
use gpt_types::{
    api::{
        FileInfo, FolderInfo, FsItemInfo, FsItemType, RenameItemRequest, RenameItemResponse,
        RenameItemResult,
    },
    error::{CanisterError, CanisterResult},
};
use ic_cdk::api;
use ic_cdk_macros::update;

#[update]
pub fn rename_item(req: RenameItemRequest) -> RenameItemResult {
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    match &req.item_type {
        FsItemType::File => {
            // Get file and verify ownership
            let file = FILES_METADATA
                .with(|f| f.borrow().get(&req.item_id).map(|w| w.0.clone()))
                .ok_or(CanisterError::FileNotFound)?;

            if file.owner != caller {
                return Err(CanisterError::Unauthorized);
            }

            let parent_folder_id = file.parent_folder_id;

            // Validate new name and check for collisions
            validate_item_name_and_collision(&req.new_name, parent_folder_id, &req.item_type)?;

            // Update file
            let updated_file = FILES_METADATA.with(|f_map| -> CanisterResult<_> {
                let mut files = f_map.borrow_mut();
                let mut file = files
                    .get(&req.item_id)
                    .map(|w| w.0.clone())
                    .ok_or(CanisterError::FileNotFound)?;

                file.name = req.new_name.trim().to_string();
                file.updated_at = api::time();

                files.insert(req.item_id, CandidWrapper(file.clone()));
                Ok(file)
            })?;

            Ok(RenameItemResponse {
                item: FsItemInfo::File(FileInfo {
                    id: updated_file.id,
                    name: updated_file.name,
                    mime_type: updated_file.mime_type,
                    content_size_bytes: updated_file.content_size_bytes,
                    created_at: updated_file.created_at,
                    updated_at: updated_file.updated_at,
                    parent_folder_id: updated_file.parent_folder_id,
                    chunks: updated_file.chunks,
                }),
            })
        }
        FsItemType::Folder => {
            // Get folder and verify ownership
            let folder = FOLDERS
                .with(|f| f.borrow().get(&req.item_id).map(|w| w.0.clone()))
                .ok_or(CanisterError::FolderNotFound)?;

            if folder.owner != caller {
                return Err(CanisterError::Unauthorized);
            }

            let parent_folder_id = folder.parent_folder_id;

            // Validate new name and check for collisions
            validate_item_name_and_collision(&req.new_name, parent_folder_id, &req.item_type)?;

            // Update folder
            let updated_folder = FOLDERS.with(|f_map| -> CanisterResult<_> {
                let mut folders = f_map.borrow_mut();
                let mut folder = folders
                    .get(&req.item_id)
                    .map(|w| w.0.clone())
                    .ok_or(CanisterError::FolderNotFound)?;

                folder.name = req.new_name.trim().to_string();
                folder.updated_at = api::time();

                folders.insert(req.item_id, CandidWrapper(folder.clone()));
                Ok(folder)
            })?;

            Ok(RenameItemResponse {
                item: FsItemInfo::Folder(FolderInfo {
                    id: updated_folder.id,
                    name: updated_folder.name,
                    created_at: updated_folder.created_at,
                    updated_at: updated_folder.updated_at,
                }),
            })
        }
    }
}
