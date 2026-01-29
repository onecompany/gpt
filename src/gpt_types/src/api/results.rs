use crate::api::*;
use crate::error::CanisterError;

// --- Index Canister Results ---

pub type AddManagerResult = Result<AddManagerResponse, CanisterError>;
pub type AddMeasurementResult = Result<AddMeasurementResponse, CanisterError>;
pub type AddModelResult = Result<AddModelResponse, CanisterError>;
pub type ClaimManagerRoleResult = Result<ClaimManagerRoleResponse, CanisterError>;
pub type ConfirmRegistrationResult = Result<ConfirmRegistrationResponse, CanisterError>;
pub type CreateIndexNodeResult = Result<CreateIndexNodeResponse, CanisterError>;
pub type CreateUserCanisterResult = Result<CreateUserCanisterResponse, CanisterError>;
pub type GetAttestationRequirementsResult =
    Result<GetAttestationRequirementsResponse, CanisterError>;
pub type GetNodeConfigResult = Result<GetNodeConfigResponse, CanisterError>;
pub type GetProvisioningInfoResult = Result<GetProvisioningInfoResponse, CanisterError>;
pub type GetUserAssignmentResult = Result<GetUserAssignmentResponse, CanisterError>;
pub type HeartbeatResult = Result<HeartbeatResponse, CanisterError>;
pub type IsManagerResult = Result<IsManagerResponse, CanisterError>;
pub type ListActiveNodesResult = Result<ListActiveNodesResponse, CanisterError>;
pub type ListManagersResult = Result<ListManagersResponse, CanisterError>;
pub type ListMyNodesResult = Result<ListMyNodesResponse, CanisterError>;
pub type ListUserCanistersResult = Result<ListUserCanistersResponse, CanisterError>;
pub type ListCanisterPoolResult = Result<ListCanisterPoolResponse, CanisterError>;
pub type ProvisionCanistersResult = Result<ProvisionCanistersResponse, CanisterError>;
pub type RegisterNodeResult = Result<RegisterNodeResponse, CanisterError>;
pub type RegisterUserResult = Result<RegisterUserResponse, CanisterError>;
pub type RemoveManagerResult = Result<RemoveManagerResponse, CanisterError>;
pub type RemoveMeasurementResult = Result<RemoveMeasurementResponse, CanisterError>;
pub type UnregisterNodeResult = Result<UnregisterNodeResponse, CanisterError>;
pub type UpdateAttestationPoliciesResult = Result<UpdateAttestationPoliciesResponse, CanisterError>;
pub type UpdateMeasurementStatusResult = Result<UpdateMeasurementStatusResponse, CanisterError>;
pub type UpdateModelResult = Result<UpdateModelResponse, CanisterError>;

// --- User Canister Results ---

pub type AddMessageResult = Result<AddMessageResponse, CanisterError>;
pub type GptUserAddUserResult = Result<GptUserAddUserResponse, CanisterError>;
pub type ArchiveChatResult = Result<ArchiveChatResponse, CanisterError>;
pub type ClaimJobResult = Result<ClaimJobResponse, CanisterError>;
pub type CompleteJobResult = Result<CompleteJobResponse, CanisterError>;
pub type ContinueFromToolResponseResult = Result<ContinueFromToolResponseResponse, CanisterError>;
pub type CreateChatResult = Result<CreateChatResponse, CanisterError>;
pub type CreateFolderResult = Result<CreateFolderResponse, CanisterError>;
pub type DeleteChatResult = Result<DeleteChatResponse, CanisterError>;
pub type DeleteItemResult = Result<DeleteItemResponse, CanisterError>;
pub type EditUserMessageResult = Result<EditUserMessageResponse, CanisterError>;
pub type FinalizeRegistrationResult = Result<FinalizeRegistrationResponse, CanisterError>;
pub type GetChatResult = Result<GetChatResponse, CanisterError>;
pub type GetChatJobsResult = Result<GetChatJobsResponse, CanisterError>;
pub type GetFileContentResult = Result<GetFileContentResponse, CanisterError>;
pub type GetFolderContentResult = Result<GetFolderContentResponse, CanisterError>;
pub type GetItemByPathResult = Result<GetItemByPathResponse, CanisterError>;
pub type GetMessageResult = Result<GetMessageResponse, CanisterError>;
pub type GetUserStorageUsageResult = Result<GetUserStorageUsageResponse, CanisterError>;
pub type GptUserGetNodesResult = Result<GptUserGetNodesResponse, CanisterError>;
pub type GptUserListRegisteredUsersResult =
    Result<GptUserListRegisteredUsersResponse, CanisterError>;
pub type IsUserFinalizedResult = Result<IsUserFinalizedResponse, CanisterError>;
pub type ListChatsResult = Result<ListChatsResponse, CanisterError>;
pub type NodeGetMessageResult = Result<NodeGetMessageResponse, CanisterError>;
pub type RenameChatResult = Result<RenameChatResponse, CanisterError>;
pub type RenameItemResult = Result<RenameItemResponse, CanisterError>;
pub type RetryAiMessageResult = Result<RetryAiMessageResponse, CanisterError>;
pub type StoreToolResultsResult = Result<StoreToolResultsResponse, CanisterError>;
pub type UnarchiveChatResult = Result<UnarchiveChatResponse, CanisterError>;
pub type UpdateMessageAttachmentsResult = Result<UpdateMessageAttachmentsResponse, CanisterError>;
pub type UploadFileResult = Result<UploadFileResponse, CanisterError>;
