use crate::helpers::user_helpers::verify_owner;
use crate::storage::{CandidWrapper, FILES_CONTENT, FILES_METADATA, FOLDER_CONTENTS_INDEX, FOLDERS};
use gpt_types::{
    api::{DeleteItemRequest, DeleteItemResponse, DeleteItemResult, FsItemType},
    domain::ROOT_FOLDER_ID,
    error::CanisterError,
};
use ic_cdk_macros::update;

#[update]
pub fn delete_item(req: DeleteItemRequest) -> DeleteItemResult {
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    match req.item_type {
        FsItemType::File => {
            // Get file metadata first
            let file_metadata = FILES_METADATA
                .with(|f| f.borrow().get(&req.item_id).map(|w| w.0.clone()))
                .ok_or(CanisterError::FileNotFound)?;

            // Verify ownership
            if file_metadata.owner != caller {
                return Err(CanisterError::Unauthorized);
            }

            // Remove file metadata
            FILES_METADATA.with(|f| f.borrow_mut().remove(&req.item_id));

            // Remove file content
            FILES_CONTENT.with(|c| c.borrow_mut().remove(&req.item_id));

            // Update parent folder's contents index
            FOLDER_CONTENTS_INDEX.with(|idx| {
                let mut index_mut = idx.borrow_mut();
                if let Some(parent_contents) = index_mut.get(&file_metadata.parent_folder_id) {
                    let mut contents = parent_contents.0.clone();
                    contents.child_file_ids.retain(|id| *id != req.item_id);
                    index_mut.insert(file_metadata.parent_folder_id, CandidWrapper(contents));
                }
            });

            Ok(DeleteItemResponse)
        }
        FsItemType::Folder => {
            // Get folder first
            let folder = FOLDERS
                .with(|f| f.borrow().get(&req.item_id).map(|w| w.0.clone()))
                .ok_or(CanisterError::FolderNotFound)?;

            // Verify ownership
            if folder.owner != caller {
                return Err(CanisterError::Unauthorized);
            }

            // Cannot delete root folder
            if folder.id == ROOT_FOLDER_ID
                || (folder.parent_folder_id == ROOT_FOLDER_ID && folder.name == "root")
            {
                return Err(CanisterError::CannotDeleteRootFolder);
            }

            // Check if folder is empty
            let contents = FOLDER_CONTENTS_INDEX
                .with(|idx| idx.borrow().get(&req.item_id).map(|w| w.0.clone()))
                .unwrap_or_default();

            if !contents.child_folder_ids.is_empty() || !contents.child_file_ids.is_empty() {
                return Err(CanisterError::DeleteNonEmptyFolder);
            }

            // Remove folder
            FOLDERS.with(|f| f.borrow_mut().remove(&req.item_id));

            // Update parent folder's contents index and remove this folder's index entry
            FOLDER_CONTENTS_INDEX.with(|idx| {
                let mut index_mut = idx.borrow_mut();

                // Update parent folder contents
                if let Some(parent_contents) = index_mut.get(&folder.parent_folder_id) {
                    let mut contents = parent_contents.0.clone();
                    contents.child_folder_ids.retain(|id| *id != req.item_id);
                    index_mut.insert(folder.parent_folder_id, CandidWrapper(contents));
                }

                // Remove this folder's index entry
                index_mut.remove(&req.item_id);
            });

            Ok(DeleteItemResponse)
        }
    }
}
