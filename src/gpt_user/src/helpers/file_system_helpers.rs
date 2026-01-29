use candid::Encode;
use gpt_types::domain::FileMetadata;
use gpt_types::domain::Folder;

pub fn folder_size_bytes(folder: &Folder) -> u64 {
    Encode!(folder)
        .expect("Failed to encode folder for size calculation")
        .len() as u64
}

pub fn file_size_bytes(metadata: &FileMetadata, content: &Vec<u8>) -> u64 {
    let metadata_size = Encode!(metadata)
        .expect("Failed to encode file metadata for size calculation")
        .len() as u64;
    let content_size = content.len() as u64;
    metadata_size + content_size
}
