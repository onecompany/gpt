use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::{error::Error, fmt};

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq)]
pub enum CanisterError {
    UserNotFound,
    ChatNotFound,
    MessageNotFound,
    ModelNotFound,
    NodeNotFound,
    InvalidSecretKey,
    Unauthorized,
    InvalidInput(String),
    GenerationInProgress,
    Other(String),
    NoAvailableUserCanister,
    UserAlreadyRegistered,
    CallError(String),
    FolderNotFound,
    FileNotFound,
    ItemNameCollision(String),
    FileSystemLimitExceeded(String),
    InvalidFileName(String),
    DeleteNonEmptyFolder,
    CannotDeleteRootFolder,
    InvalidPathDepth,
    UnsupportedMimeType(String),
    PathNotFound,
    RoleAlreadyClaimed,
    TrialExpired,
    PoolExhausted,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq)]
pub enum ProviderErrorType {
    RateLimited,
    AuthenticationError,
    ServerError,
    ServiceUnavailable,
    BadRequest,
    ContextLengthExceeded,
    ContentPolicyViolation,
    NetworkError,
    Timeout,
    InvalidImage(String),
    Unknown(String),
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq)]
pub enum MessageErrorStatus {
    Timeout,
    NodeOffline,
    ProviderError(ProviderErrorType),
    CanisterCallError(String),
    InvalidState(String),
    ConfigurationError(String),
    Unknown(String),
}

impl fmt::Display for CanisterError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CanisterError::UserNotFound => write!(f, "User not found"),
            CanisterError::ChatNotFound => write!(f, "Chat not found"),
            CanisterError::MessageNotFound => write!(f, "Message not found"),
            CanisterError::ModelNotFound => write!(f, "Model not found"),
            CanisterError::NodeNotFound => write!(f, "Node not found"),
            CanisterError::InvalidSecretKey => write!(f, "Invalid secret key"),
            CanisterError::Unauthorized => write!(f, "Unauthorized access"),
            CanisterError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            CanisterError::GenerationInProgress => write!(f, "Generation is in progress"),
            CanisterError::Other(msg) => write!(f, "{}", msg),
            CanisterError::NoAvailableUserCanister => write!(f, "No available user canister"),
            CanisterError::UserAlreadyRegistered => write!(f, "User already registered"),
            CanisterError::CallError(msg) => write!(f, "Call error: {}", msg),
            CanisterError::FolderNotFound => write!(f, "Folder not found"),
            CanisterError::FileNotFound => write!(f, "File not found"),
            CanisterError::ItemNameCollision(msg) => write!(f, "Item name collision: {}", msg),
            CanisterError::FileSystemLimitExceeded(msg) => {
                write!(f, "File system limit exceeded: {}", msg)
            }
            CanisterError::InvalidFileName(msg) => write!(f, "Invalid file name: {}", msg),
            CanisterError::DeleteNonEmptyFolder => write!(f, "Cannot delete a non-empty folder"),
            CanisterError::CannotDeleteRootFolder => write!(f, "The root folder cannot be deleted"),
            CanisterError::InvalidPathDepth => write!(f, "Maximum folder depth exceeded"),
            CanisterError::UnsupportedMimeType(msg) => write!(f, "Unsupported MIME type: {}", msg),
            CanisterError::PathNotFound => write!(f, "The specified path does not exist"),
            CanisterError::RoleAlreadyClaimed => {
                write!(f, "The manager role has already been claimed.")
            }
            CanisterError::TrialExpired => write!(f, "Trial period has expired"),
            CanisterError::PoolExhausted => {
                write!(f, "Canister pool exhausted. No trial slots available.")
            }
        }
    }
}

impl Error for CanisterError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        None
    }
}

impl fmt::Display for ProviderErrorType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProviderErrorType::RateLimited => write!(f, "Provider rate limit exceeded"),
            ProviderErrorType::AuthenticationError => write!(f, "Provider authentication error"),
            ProviderErrorType::ServerError => write!(f, "Provider server error"),
            ProviderErrorType::ServiceUnavailable => write!(f, "Provider service unavailable"),
            ProviderErrorType::BadRequest => write!(f, "Provider bad request"),
            ProviderErrorType::ContextLengthExceeded => write!(f, "Context length exceeded"),
            ProviderErrorType::ContentPolicyViolation => write!(f, "Content policy violation"),
            ProviderErrorType::NetworkError => write!(f, "Network error contacting provider"),
            ProviderErrorType::Timeout => write!(f, "Timeout waiting for provider"),
            ProviderErrorType::InvalidImage(msg) => write!(f, "Invalid image: {}", msg),
            ProviderErrorType::Unknown(msg) => write!(f, "Unknown provider error: {}", msg),
        }
    }
}

impl fmt::Display for MessageErrorStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MessageErrorStatus::Timeout => write!(f, "Generation timed out"),
            MessageErrorStatus::NodeOffline => write!(f, "Assigned node appears offline"),
            MessageErrorStatus::ProviderError(pe) => write!(f, "Provider error: {}", pe),
            MessageErrorStatus::CanisterCallError(msg) => {
                write!(f, "Canister call error: {}", msg)
            }
            MessageErrorStatus::InvalidState(msg) => write!(f, "Invalid state: {}", msg),
            MessageErrorStatus::ConfigurationError(msg) => {
                write!(f, "Node configuration error: {}", msg)
            }
            MessageErrorStatus::Unknown(msg) => write!(f, "Unknown generation error: {}", msg),
        }
    }
}

pub type CanisterResult<T> = Result<T, CanisterError>;

impl From<ProviderErrorType> for MessageErrorStatus {
    fn from(pe: ProviderErrorType) -> Self {
        MessageErrorStatus::ProviderError(pe)
    }
}
