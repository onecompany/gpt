pub use crate::domain::chat::Chat;
pub use crate::domain::common::{ChatId, JobId, MessageId, ModelId, NodeId, SecretKey, UserId};
pub use crate::domain::common::{GenerationStatus, Role};
pub use crate::domain::file_system::{FileId, FileMetadata, Folder, FolderId};
pub use crate::domain::job::Job;
pub use crate::domain::message::{ImageAttachment, Message};
pub use crate::domain::model::Model;
pub use crate::domain::node::{AttestationRequirements, Node, PublicNodeInfo};
pub use crate::domain::text_chunk::TextChunk;
pub use crate::domain::user::User;
pub use crate::error::{CanisterError, CanisterResult};
pub use crate::api::common::{CanisterPoolEntry, CanisterPoolState};

// Export all API structs (Requests/Responses)
pub use crate::api::{
    AddManagerRequest, AddManagerResponse, AddMeasurementRequest, AddMeasurementResponse,
    AddMessageRequest, AddMessageResponse, AddModelRequest, AddModelResponse, ArchiveChatRequest,
    ArchiveChatResponse, ClaimJobRequest, ClaimJobResponse, ClaimManagerRoleResponse,
    CompleteJobRequest, CompleteJobResponse, ConfirmRegistrationRequest,
    ConfirmRegistrationResponse, ContinueFromToolResponseRequest, ContinueFromToolResponseResponse,
    CreateChatRequest, CreateChatResponse, CreateFolderRequest, CreateFolderResponse,
    CreateIndexNodeRequest, CreateIndexNodeResponse, CreateUserCanisterResponse, DeleteChatRequest,
    DeleteChatResponse, DeleteItemRequest, DeleteItemResponse, EditUserMessageRequest,
    EditUserMessageResponse, FinalizeRegistrationRequest, FinalizeRegistrationResponse,
    FileInfo, FolderInfo, FsItemInfo, FsItemType, GetAttestationRequirementsRequest,
    GetAttestationRequirementsResponse, GetChatJobsRequest, GetChatJobsResponse, GetChatRequest,
    GetChatResponse, GetFileContentRequest, GetFileContentResponse, GetFolderContentRequest,
    GetFolderContentResponse, GetItemByPathRequest, GetItemByPathResponse, GetMessageRequest,
    GetMessageResponse, GetModelsRequest, GetModelsResponse, GetNodeConfigRequest,
    GetNodeConfigResponse, GetProvisioningInfoRequest, GetProvisioningInfoResponse,
    GetUserAssignmentRequest, GetUserAssignmentResponse, GptUserAddUserRequest,
    GptUserAddUserResponse, GptUserListRegisteredUsersResponse, HeartbeatRequest,
    HeartbeatResponse, IsUserFinalizedRequest, IsUserFinalizedResponse, ListActiveNodesRequest,
    ListActiveNodesResponse, ListCanisterPoolResponse, ListChatsRequest, ListChatsResponse,
    ListMyNodesRequest, ListMyNodesResponse, ListUserCanistersResponse, NodeGetMessageRequest,
    NodeGetMessageResponse,
    NodeHeartbeatCommand, ProvisionCanistersRequest, ProvisionCanistersResponse, RawWhoAmIRequest,
    RawWhoAmIResponse, RegisterNodeRequest, RegisterNodeResponse, RegisterUserRequest,
    RegisterUserResponse, RemoveManagerRequest,
    RemoveManagerResponse, RemoveMeasurementRequest, RemoveMeasurementResponse, RenameChatRequest,
    RenameChatResponse, RenameItemRequest, RenameItemResponse, RetryAiMessageRequest,
    RetryAiMessageResponse, StoreToolResultsRequest, StoreToolResultsResponse,
    UnarchiveChatRequest, UnarchiveChatResponse, UnregisterNodeRequest, UnregisterNodeResponse,
    UpdateAttestationPoliciesRequest, UpdateAttestationPoliciesResponse,
    UpdateMeasurementStatusRequest, UpdateMeasurementStatusResponse,
    UpdateMessageAttachmentsRequest, UpdateMessageAttachmentsResponse, UpdateModelRequest,
    UpdateModelResponse, UploadFileRequest, UploadFileResponse, UserDetails, WhoAmIRequest,
    WhoAmIResponse, WhoAmIUserResponse,
};

// Export all specific Result types (aliases)
pub use crate::api::results::*;
