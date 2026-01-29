pub const MAX_ATTACHMENT_SIZE_BYTES: usize = 1_500_000;
pub const MAX_FILES_PER_USER: usize = 200;
pub const MAX_FOLDERS_PER_USER: usize = 50;
pub const MAX_FS_DEPTH: u32 = 5;
pub const MAX_ITEMS_PER_FOLDER: usize = 50;
pub const MAX_FILENAME_LENGTH: usize = 255;
pub const MAX_FILE_UPLOAD_SIZE_BYTES: usize = 1_900_000;
// Security constant for input validation
pub const MAX_CUSTOM_PROMPT_CHARS: usize = 32_000;

pub const ALLOWED_MIME_TYPES: &[&str] = &[
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
    "application/xml",
    "application/toml",
    "application/yaml",
    "text/yaml",
    "application/x-yaml",
    "text/x-yaml",
    "text/html",
    "text/css",
    "application/javascript",
    "application/typescript",
    "text/x-rust",
    "application/x-rust-crate",
    "text/x-python",
    "text/x-script.python",
    "application/x-python-code",
    "text/x-java-source",
    "application/x-shellscript",
    "application/x-sh",
];
pub const ALLOWED_IMAGE_MIME_TYPES: &[&str] =
    &["image/jpeg", "image/jpg", "image/png", "image/webp"];
