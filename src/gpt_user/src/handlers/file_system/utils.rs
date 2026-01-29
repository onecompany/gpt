use crate::config::{MAX_FILENAME_LENGTH, MAX_FS_DEPTH, MAX_ITEMS_PER_FOLDER};
use crate::storage::{
    get_next_folder_id, get_root_folder_id, set_root_folder_id, CandidWrapper, FolderContents,
    FILES_METADATA, FOLDER_CONTENTS_INDEX, FOLDERS,
};
use gpt_types::{
    api::{FileInfo, FolderInfo, FsItemInfo, FsItemType},
    domain::{Folder, FolderId, ROOT_FOLDER_ID},
    error::{CanisterError, CanisterResult},
};
use ic_cdk::api;

/// Gets or creates the root folder for the single user.
/// Uses CONFIG.root_folder_id instead of per-user index.
pub fn get_or_create_root_folder_id() -> CanisterResult<FolderId> {
    // Check if root folder already exists in config
    if let Some(root_id) = get_root_folder_id() {
        return Ok(root_id);
    }

    let timestamp = api::time();
    let root_folder_id = get_next_folder_id();

    // Get the owner from config (for folder ownership)
    let owner = crate::storage::get_owner().ok_or(CanisterError::UserNotFound)?;

    let root_folder = Folder {
        id: root_folder_id,
        owner,
        name: "Home".to_string(),
        parent_folder_id: ROOT_FOLDER_ID,
        created_at: timestamp,
        updated_at: timestamp,
    };

    // Insert root folder into stable storage
    FOLDERS.with(|f| {
        f.borrow_mut()
            .insert(root_folder_id, CandidWrapper(root_folder));
    });

    // Initialize folder contents index for root folder
    FOLDER_CONTENTS_INDEX.with(|idx| {
        idx.borrow_mut().insert(
            root_folder_id,
            CandidWrapper(FolderContents::default()),
        );
    });

    // Store root folder ID in config
    set_root_folder_id(root_folder_id);

    Ok(root_folder_id)
}

pub fn validate_item_name(name: &str) -> CanisterResult<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(CanisterError::InvalidFileName(
            "Name cannot be empty.".to_string(),
        ));
    }
    if trimmed.len() > MAX_FILENAME_LENGTH {
        return Err(CanisterError::InvalidFileName(format!(
            "Name exceeds maximum length of {} characters.",
            MAX_FILENAME_LENGTH
        )));
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err(CanisterError::InvalidFileName(
            "Name cannot contain '/' or '\\' characters.".to_string(),
        ));
    }
    if trimmed == "." || trimmed == ".." {
        return Err(CanisterError::InvalidFileName(
            "'.' and '..' are reserved names.".to_string(),
        ));
    }
    Ok(())
}

pub fn validate_parent_folder_and_capacity(parent_folder_id: FolderId) -> CanisterResult<()> {
    let parent_folder = FOLDERS
        .with(|f| f.borrow().get(&parent_folder_id).map(|w| w.0.clone()))
        .ok_or(CanisterError::FolderNotFound)?;

    // Get owner from config - all folders belong to the single user
    let owner = crate::storage::get_owner().ok_or(CanisterError::UserNotFound)?;
    if parent_folder.owner != owner {
        return Err(CanisterError::Unauthorized);
    }

    let contents = FOLDER_CONTENTS_INDEX
        .with(|idx| idx.borrow().get(&parent_folder_id).map(|w| w.0.clone()))
        .unwrap_or_default();

    if contents.child_folder_ids.len() + contents.child_file_ids.len() >= MAX_ITEMS_PER_FOLDER {
        return Err(CanisterError::FileSystemLimitExceeded(
            "Parent folder is full.".to_string(),
        ));
    }

    Ok(())
}

pub fn validate_item_name_and_collision(
    name: &str,
    parent_folder_id: FolderId,
    item_type: &FsItemType,
) -> CanisterResult<()> {
    validate_item_name(name)?;

    let contents = FOLDER_CONTENTS_INDEX
        .with(|idx| idx.borrow().get(&parent_folder_id).map(|w| w.0.clone()))
        .unwrap_or_default();

    let collision_found = match item_type {
        FsItemType::Folder => FOLDERS.with(|f_map| {
            let all_folders = f_map.borrow();
            contents
                .child_folder_ids
                .iter()
                .any(|id| all_folders.get(id).is_some_and(|f| f.0.name == name))
        }),
        FsItemType::File => FILES_METADATA.with(|f_map| {
            let all_files = f_map.borrow();
            contents
                .child_file_ids
                .iter()
                .any(|id| all_files.get(id).is_some_and(|f| f.0.name == name))
        }),
    };

    if collision_found {
        let item_type_str = match item_type {
            FsItemType::Folder => "folder",
            FsItemType::File => "file",
        };
        return Err(CanisterError::ItemNameCollision(format!(
            "A {} with this name already exists in the folder.",
            item_type_str
        )));
    }

    Ok(())
}

pub fn get_folder_depth(folder_id: FolderId) -> CanisterResult<u32> {
    let mut depth = 0;
    let mut current_id = folder_id;

    while current_id != ROOT_FOLDER_ID {
        depth += 1;
        if depth > MAX_FS_DEPTH {
            return Err(CanisterError::InvalidPathDepth);
        }
        let folder = FOLDERS
            .with(|f| f.borrow().get(&current_id).map(|w| w.0.clone()))
            .ok_or(CanisterError::FolderNotFound)?;
        current_id = folder.parent_folder_id;
    }
    Ok(depth)
}

pub fn infer_mime_type_from_name(name: &str) -> Option<&'static str> {
    let ext = name.rsplit_once('.')?.1;
    match ext.to_lowercase().as_str() {
        "txt" => Some("text/plain"),
        "md" => Some("text/markdown"),
        "csv" => Some("text/csv"),
        "html" | "htm" => Some("text/html"),
        "css" => Some("text/css"),
        "js" => Some("application/javascript"),
        "ts" => Some("application/typescript"),
        "json" => Some("application/json"),
        "xml" => Some("application/xml"),
        "rs" => Some("text/x-rust"),
        "py" => Some("text/x-python"),
        "java" => Some("text/x-java-source"),
        "sh" => Some("application/x-sh"),
        "toml" => Some("application/toml"),
        "yaml" | "yml" => Some("application/yaml"),
        _ => None,
    }
}

pub fn resolve_path(path: &str) -> CanisterResult<FsItemInfo> {
    let root_id = get_or_create_root_folder_id()?;
    let trimmed_path = path.trim();

    if trimmed_path.is_empty() || trimmed_path == "/" {
        let root_folder = FOLDERS
            .with(|f| f.borrow().get(&root_id).map(|w| w.0.clone()))
            .ok_or(CanisterError::FolderNotFound)?;
        return Ok(FsItemInfo::Folder(FolderInfo {
            id: root_folder.id,
            name: root_folder.name,
            created_at: root_folder.created_at,
            updated_at: root_folder.updated_at,
        }));
    }

    let segments: Vec<&str> = trimmed_path.trim_start_matches('/').split('/').collect();
    let mut current_folder_id = root_id;

    for (i, segment) in segments.iter().enumerate() {
        if segment.is_empty() {
            return Err(CanisterError::InvalidInput(
                "Path contains empty segments.".to_string(),
            ));
        }

        let contents = FOLDER_CONTENTS_INDEX
            .with(|idx| idx.borrow().get(&current_folder_id).map(|w| w.0.clone()))
            .unwrap_or_default();

        let is_last_segment = i == segments.len() - 1;

        let found_folder_id = FOLDERS.with(|f_map| {
            let folders = f_map.borrow();
            contents
                .child_folder_ids
                .iter()
                .find(|id| folders.get(id).is_some_and(|f| &f.0.name == segment))
                .cloned()
        });

        if let Some(folder_id) = found_folder_id {
            if is_last_segment {
                let folder = FOLDERS
                    .with(|f| f.borrow().get(&folder_id).map(|w| w.0.clone()))
                    .unwrap();
                return Ok(FsItemInfo::Folder(FolderInfo {
                    id: folder.id,
                    name: folder.name,
                    created_at: folder.created_at,
                    updated_at: folder.updated_at,
                }));
            } else {
                current_folder_id = folder_id;
                continue;
            }
        }

        if is_last_segment {
            let found_file = FILES_METADATA.with(|f_map| {
                let files = f_map.borrow();
                contents
                    .child_file_ids
                    .iter()
                    .find(|id| files.get(id).is_some_and(|f| &f.0.name == segment))
                    .and_then(|id| files.get(id).map(|w| w.0.clone()))
            });

            if let Some(file) = found_file {
                return Ok(FsItemInfo::File(FileInfo {
                    id: file.id,
                    name: file.name,
                    mime_type: file.mime_type,
                    content_size_bytes: file.content_size_bytes,
                    created_at: file.created_at,
                    updated_at: file.updated_at,
                    parent_folder_id: file.parent_folder_id,
                    chunks: file.chunks,
                }));
            }
        }

        return Err(CanisterError::PathNotFound);
    }

    Err(CanisterError::PathNotFound)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_item_name_legal() {
        assert!(validate_item_name("document.pdf").is_ok());
        assert!(validate_item_name("My Folder").is_ok());
        assert!(validate_item_name("file-with-dashes_and_underscores.txt").is_ok());
        assert!(validate_item_name("  trimmed name  ").is_ok());
        assert!(validate_item_name("résumé-à-vérifier.pdf").is_ok());
    }

    #[test]
    fn test_validate_item_name_illegal() {
        assert!(validate_item_name("").is_err());
        assert!(validate_item_name("  ").is_err());
        assert!(validate_item_name("file/with/slash.txt").is_err());
        assert!(validate_item_name("file\\with\\backslash.txt").is_err());
        assert!(validate_item_name(".").is_err());
        assert!(validate_item_name("..").is_err());
        assert!(validate_item_name(&"a".repeat(300)).is_err());
    }

    #[test]
    fn test_infer_mime_type() {
        assert_eq!(infer_mime_type_from_name("file.txt"), Some("text/plain"));
        assert_eq!(infer_mime_type_from_name("archive.zip"), None);
        assert_eq!(
            infer_mime_type_from_name("document.MD"),
            Some("text/markdown")
        );
        assert_eq!(
            infer_mime_type_from_name("script.js"),
            Some("application/javascript")
        );
        assert_eq!(infer_mime_type_from_name("image.jpeg"), None);
        assert_eq!(infer_mime_type_from_name("no_extension"), None);
        assert_eq!(infer_mime_type_from_name(".config"), None);
        assert_eq!(infer_mime_type_from_name(".zshrc"), None);
        assert_eq!(infer_mime_type_from_name("main.rs"), Some("text/x-rust"));
    }
}
