use super::utils::{validate_item_name_and_collision, validate_parent_folder_and_capacity};
use crate::config::{
    ALLOWED_MIME_TYPES, MAX_FILE_UPLOAD_SIZE_BYTES, MAX_FILES_PER_USER, MAX_FOLDERS_PER_USER,
    MAX_FS_DEPTH,
};
use crate::handlers::file_system::utils::get_folder_depth;
use crate::handlers::file_system::utils::infer_mime_type_from_name;
use crate::helpers::user_helpers::verify_owner;
use crate::storage::{
    get_next_file_id, get_next_folder_id, CandidWrapper, FolderContents, FILES_CONTENT,
    FILES_METADATA, FOLDER_CONTENTS_INDEX, FOLDERS,
};
use gpt_types::{
    api::{
        CreateFolderRequest, CreateFolderResponse, CreateFolderResult, FileInfo, FolderInfo,
        FsItemType, UploadFileRequest, UploadFileResponse, UploadFileResult,
    },
    domain::{FileMetadata, Folder},
    error::CanisterError,
};
use ic_cdk::api;
use ic_cdk_macros::update;

#[update]
pub fn create_folder(req: CreateFolderRequest) -> CreateFolderResult {
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    validate_parent_folder_and_capacity(req.parent_folder_id)?;
    validate_item_name_and_collision(&req.name, req.parent_folder_id, &FsItemType::Folder)?;

    // Count folders owned by the user (single user = all folders)
    if FOLDERS.with(|f| f.borrow().len()) as usize >= MAX_FOLDERS_PER_USER {
        return Err(CanisterError::FileSystemLimitExceeded(
            "Maximum number of folders reached.".to_string(),
        ));
    }

    let depth = get_folder_depth(req.parent_folder_id)?;

    if depth >= MAX_FS_DEPTH {
        return Err(CanisterError::InvalidPathDepth);
    }

    let timestamp = api::time();
    let folder_id = get_next_folder_id();

    let new_folder = Folder {
        id: folder_id,
        owner: caller,
        name: req.name.trim().to_string(),
        parent_folder_id: req.parent_folder_id,
        created_at: timestamp,
        updated_at: timestamp,
    };

    // Insert folder into stable storage
    FOLDERS.with(|f| {
        f.borrow_mut()
            .insert(folder_id, CandidWrapper(new_folder.clone()));
    });

    // Update parent folder's contents index
    FOLDER_CONTENTS_INDEX.with(|idx| {
        let mut index_mut = idx.borrow_mut();

        // Get or create parent folder contents
        let mut parent_contents = index_mut
            .get(&req.parent_folder_id)
            .map(|w| w.0.clone())
            .unwrap_or_default();
        parent_contents.child_folder_ids.push(folder_id);
        index_mut.insert(req.parent_folder_id, CandidWrapper(parent_contents));

        // Initialize new folder's contents
        index_mut.insert(folder_id, CandidWrapper(FolderContents::default()));
    });

    Ok(CreateFolderResponse {
        folder: FolderInfo {
            id: new_folder.id,
            name: new_folder.name,
            created_at: new_folder.created_at,
            updated_at: new_folder.updated_at,
        },
    })
}

#[update]
pub fn upload_file(req: UploadFileRequest) -> UploadFileResult {
    ic_cdk::println!("[UploadFile] Received request for file: '{}'", req.name);
    let caller = ic_cdk::api::msg_caller();
    verify_owner(caller)?;

    validate_parent_folder_and_capacity(req.parent_folder_id)?;
    validate_item_name_and_collision(&req.name, req.parent_folder_id, &FsItemType::File)?;

    if req.content.len() > MAX_FILE_UPLOAD_SIZE_BYTES {
        return Err(CanisterError::InvalidInput(format!(
            "File size exceeds the limit of {} bytes.",
            MAX_FILE_UPLOAD_SIZE_BYTES
        )));
    }

    let mime_type = if req.mime_type.is_empty() {
        infer_mime_type_from_name(&req.name)
            .unwrap_or_default()
            .to_string()
    } else {
        req.mime_type.clone()
    };
    ic_cdk::println!("[UploadFile] Inferred MIME type: '{}'", mime_type);

    if !ALLOWED_MIME_TYPES.contains(&mime_type.as_str()) {
        return Err(CanisterError::UnsupportedMimeType(req.mime_type));
    }

    // Count files owned by the user (single user = all files)
    if FILES_METADATA.with(|f| f.borrow().len()) as usize >= MAX_FILES_PER_USER {
        return Err(CanisterError::FileSystemLimitExceeded(
            "Maximum number of files reached.".to_string(),
        ));
    }

    let timestamp = api::time();
    let file_id = get_next_file_id();

    let new_file_metadata = FileMetadata {
        id: file_id,
        owner: caller,
        name: req.name.trim().to_string(),
        parent_folder_id: req.parent_folder_id,
        mime_type,
        content_size_bytes: req.content.len() as u64,
        chunks: req.chunks.unwrap_or_default(),
        created_at: timestamp,
        updated_at: timestamp,
    };

    ic_cdk::println!(
        "[UploadFile] Created metadata for file_id: {}, with {} chunks.",
        file_id,
        new_file_metadata.chunks.len()
    );

    // Insert file metadata
    FILES_METADATA.with(|f| {
        f.borrow_mut()
            .insert(file_id, CandidWrapper(new_file_metadata.clone()));
    });

    // Insert file content
    FILES_CONTENT.with(|c| {
        c.borrow_mut().insert(file_id, CandidWrapper(req.content));
    });

    // Update parent folder's contents index
    FOLDER_CONTENTS_INDEX.with(|idx| {
        let mut index_mut = idx.borrow_mut();
        let mut parent_contents = index_mut
            .get(&req.parent_folder_id)
            .map(|w| w.0.clone())
            .unwrap_or_default();
        parent_contents.child_file_ids.push(file_id);
        index_mut.insert(req.parent_folder_id, CandidWrapper(parent_contents));
    });

    Ok(UploadFileResponse {
        file: FileInfo {
            id: new_file_metadata.id,
            name: new_file_metadata.name,
            mime_type: new_file_metadata.mime_type,
            content_size_bytes: new_file_metadata.content_size_bytes,
            created_at: new_file_metadata.created_at,
            updated_at: new_file_metadata.updated_at,
            parent_folder_id: new_file_metadata.parent_folder_id,
            chunks: new_file_metadata.chunks,
        },
    })
}
