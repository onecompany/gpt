import type {
  Chat as BackendChat,
  Message as BackendMessage,
  ImageAttachment as BackendImageAttachment,
  FileInfo as BackendFileInfo,
  FolderInfo as BackendFolderInfo,
  TextChunk as BackendTextChunk,
  ToolCall as BackendToolCall,
  ToolResult as BackendToolResult,
  LocalNode as BackendLocalNode,
  Job as BackendJob,
} from "@candid/declarations/gpt_user.did";

import type {
  Model as BackendModel,
  PublicNodeInfo as BackendPublicNodeInfo,
  CanisterPoolEntry as BackendCanisterPoolEntry,
  CanisterPoolState as BackendCanisterPoolState,
  ListCanisterPoolResponse as BackendListCanisterPoolResponse,
} from "@candid/declarations/gpt_index.did";

import type {
  Chat,
  EncryptedMessage,
  ImageAttachment,
  ProviderErrorType,
  FileItem,
  Folder,
  TextChunk,
  ToolCall,
  ToolResult,
  TokenUsage,
  Model,
  ModelStatus,
  ModelType,
  Job,
  MessageErrorStatus,
  PublicNodeInfo,
} from "@/types";

import {
  fromBigInt,
  fromOpt,
  fromTimestamp,
  getVariantKey,
  deserializeEmbedding,
} from "./candidUtils";
import { Principal } from "@icp-sdk/core/principal";
import {
  toChatId,
  toMessageId,
  toJobId,
  toFolderId,
  toFileId,
  toNodeId,
  MessageId,
} from "@/types/brands";
import { CanisterInfo } from "@/components/settings/SettingsTypes";

// --- Error Status Mapping ---

export const normalizeErrorStatus = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  backendError?: any,
): MessageErrorStatus | undefined => {
  if (!backendError) return undefined;
  // Unwrap optional if nested
  const err = Array.isArray(backendError) ? backendError[0] : backendError;
  if (!err) return undefined;

  if ("NodeOffline" in err) return { type: "NodeOffline" };
  if ("Timeout" in err) return { type: "Timeout" };
  if ("CanisterCallError" in err)
    return { type: "CanisterCallError", message: err.CanisterCallError };
  if ("InvalidState" in err)
    return { type: "InvalidState", message: err.InvalidState };
  if ("ConfigurationError" in err)
    return {
      type: "ConfigurationError",
      message: err.ConfigurationError,
    };
  if ("Unknown" in err) return { type: "Unknown", message: err.Unknown };
  if ("ProviderError" in err) {
    return {
      type: "ProviderError",
      details: normalizeProviderError(err.ProviderError),
    };
  }

  return { type: "Unknown", message: "Unknown error kind" };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeProviderError = (error: any): ProviderErrorType => {
  if ("RateLimited" in error) return { type: "RateLimited" };
  if ("AuthenticationError" in error) return { type: "AuthenticationError" };
  if ("ServerError" in error) return { type: "ServerError" };
  if ("ServiceUnavailable" in error) return { type: "ServiceUnavailable" };
  if ("BadRequest" in error) return { type: "BadRequest" };
  if ("ContextLengthExceeded" in error)
    return { type: "ContextLengthExceeded" };
  if ("ContentPolicyViolation" in error)
    return { type: "ContentPolicyViolation" };
  if ("NetworkError" in error) return { type: "NetworkError" };
  if ("Timeout" in error) return { type: "Timeout" };
  if ("InvalidImage" in error)
    return { type: "InvalidImage", message: error.InvalidImage };
  if ("Unknown" in error) return { type: "Unknown", message: error.Unknown };

  return { type: "Unknown", message: "Unknown provider error" };
};

// --- Chat Mapping ---

export const mapBackendChatToFrontend = (backendChat: BackendChat): Chat => {
  return {
    chatId: toChatId(fromBigInt(backendChat.chat_id)),
    title: backendChat.title,
    messageIds: Array.from(backendChat.message_ids).map((id) =>
      toMessageId(fromBigInt(id)),
    ),
    jobIds: Array.from(backendChat.job_ids).map((id) =>
      toJobId(fromBigInt(id)),
    ),
    createdAt: new Date(fromTimestamp(backendChat.created_at)).toISOString(),
    updatedAt: new Date(fromTimestamp(backendChat.updated_at)).toISOString(),
    owner: backendChat.owner.toText(),
    activeJobId:
      fromOpt(backendChat.active_job_id) !== undefined
        ? toJobId(fromBigInt(fromOpt(backendChat.active_job_id)))
        : null,
    archived: backendChat.archived,
    temporary: backendChat.temporary,
    encryptionSalt:
      backendChat.encryption_salt instanceof Uint8Array
        ? backendChat.encryption_salt
        : new Uint8Array(backendChat.encryption_salt),
  };
};

// --- Message Mapping ---

const mapBackendAttachments = (
  backendAttachments: BackendImageAttachment[],
): ImageAttachment[] | undefined => {
  if (!backendAttachments || backendAttachments.length === 0) return undefined;
  return backendAttachments.map((att) => ({
    mime_type: att.mime_type,
    data: att.data instanceof Uint8Array ? att.data : new Uint8Array(att.data),
  }));
};

const mapBackendToolCalls = (
  backendToolCalls: BackendToolCall[],
): ToolCall[] | undefined => {
  if (!backendToolCalls || backendToolCalls.length === 0) return undefined;
  return backendToolCalls.map((call) => ({
    id: call.id,
    type: "function",
    function: {
      name: call.function.name,
      arguments: call.function.arguments,
    },
  }));
};

const mapBackendToolResults = (
  backendToolResults: BackendToolResult[],
): ToolResult[] | undefined => {
  if (!backendToolResults || backendToolResults.length === 0) return undefined;
  return backendToolResults.map((res) => ({
    tool_call_id: res.tool_call_id,
    content: res.content,
    error: fromOpt(res.error),
  }));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapBackendUsage = (backendMessage: any): TokenUsage | undefined => {
  const usage = fromOpt(backendMessage.usage);
  if (usage) {
    return {
      prompt_tokens: Number(usage.prompt_tokens),
      completion_tokens: Number(usage.completion_tokens),
      total_tokens: Number(usage.total_tokens),
    };
  }
  return undefined;
};

export const mapBackendMessageToFrontend = (
  backendMessage: BackendMessage,
): EncryptedMessage => {
  const errorStatus = fromOpt(backendMessage.error_status);
  const mappedErrorStatus = normalizeErrorStatus(errorStatus);

  const hasContent = backendMessage.content.length > 0;
  const toolResults = fromOpt(backendMessage.tool_results) ?? [];
  const hasToolResults = toolResults.length > 0;

  const isComplete =
    !!mappedErrorStatus ||
    (!backendMessage.requires_client_action && (hasContent || hasToolResults));

  let parentId: MessageId | undefined;
  const parentIdBigInt = fromOpt(backendMessage.parent_message_id);
  if (parentIdBigInt !== undefined) {
    parentId = toMessageId(fromBigInt(parentIdBigInt));
  }

  const roleKey = getVariantKey(backendMessage.role) as string;
  const role = roleKey.toLowerCase() as
    | "user"
    | "assistant"
    | "system"
    | "tool";

  return {
    id: toMessageId(fromBigInt(backendMessage.message_id)),
    backendId: toMessageId(fromBigInt(backendMessage.message_id)),
    chatId: toChatId(fromBigInt(backendMessage.chat_id)),
    encryptedContent:
      backendMessage.content instanceof Uint8Array
        ? backendMessage.content
        : new Uint8Array(backendMessage.content),
    role: role,
    parentMessageId: parentId,
    createdAt: new Date(fromTimestamp(backendMessage.created_at)).toISOString(),
    updatedAt: new Date(fromTimestamp(backendMessage.updated_at)).toISOString(),
    errorStatus: mappedErrorStatus,
    isComplete,
    attachments: mapBackendAttachments(
      fromOpt(backendMessage.attachments) ?? [],
    ),
    tool_calls: mapBackendToolCalls(fromOpt(backendMessage.tool_calls) ?? []),
    tool_results: mapBackendToolResults(
      fromOpt(backendMessage.tool_results) ?? [],
    ),
    tool_call_id: fromOpt(backendMessage.tool_call_id),
    requires_client_action: backendMessage.requires_client_action,
    usage: mapBackendUsage(backendMessage),
  };
};

// --- Job Mapping ---

export const mapBackendJobToFrontend = (backendJob: BackendJob): Job => {
  return {
    job_id: toJobId(fromBigInt(backendJob.job_id)),
    chat_id: toChatId(fromBigInt(backendJob.chat_id)),
    node_id: toNodeId(fromBigInt(backendJob.node_id)),
    model_id: backendJob.model_id,
    placeholder_message_id: toMessageId(
      fromBigInt(backendJob.placeholder_message_id),
    ),
    generation_status: backendJob.generation_status,
    temperature: backendJob.temperature,
    max_completion_tokens: backendJob.max_completion_tokens,
    max_context: backendJob.max_context,
    custom_prompt: fromOpt(backendJob.custom_prompt),
    tools: fromOpt(backendJob.tools)?.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
    extra_body_json: fromOpt(backendJob.extra_body_json),
    reasoning_effort: fromOpt(backendJob.reasoning_effort),
    created_at: fromTimestamp(backendJob.created_at),
    updated_at: fromTimestamp(backendJob.updated_at),
  };
};

// --- File System Mapping ---

const mapBackendTextChunk = (backendChunk: BackendTextChunk): TextChunk => ({
  chunk_index: Number(backendChunk.chunk_index),
  start_char: Number(backendChunk.start_char),
  end_char: Number(backendChunk.end_char),
  embedding: deserializeEmbedding(backendChunk.embedding), // Properly deserialize float32 array from bytes
});

export const mapBackendFile = (backendFile: BackendFileInfo): FileItem => ({
  id: toFileId(fromBigInt(backendFile.id)),
  name: backendFile.name,
  size: Number(backendFile.content_size_bytes),
  uploadedAt: new Date(fromTimestamp(backendFile.updated_at)),
  mimeType: backendFile.mime_type,
  parentId: toFolderId(fromBigInt(backendFile.parent_folder_id)),
  chunks: backendFile.chunks.map(mapBackendTextChunk),
});

export const mapBackendFolder = (
  backendFolder: BackendFolderInfo,
  parentId: string | null,
): Folder => ({
  id: toFolderId(fromBigInt(backendFolder.id)),
  name: backendFolder.name,
  parentId: parentId !== null ? toFolderId(parentId) : null,
});

// --- Model Mapping ---

export const mapBackendModelToFrontend = (
  backendModel: BackendModel & { is_featured: boolean },
): Model => {
  const statusKey = getVariantKey(backendModel.status);
  const statusEnum: ModelStatus = statusKey === "Active" ? "Active" : "Paused";

  return {
    modelId: backendModel.model_id,
    name: backendModel.name,
    provider: backendModel.provider,
    providerModel: backendModel.provider_model,
    providerEndpoint: backendModel.provider_endpoint,
    maker: backendModel.maker.toLowerCase() as ModelType,
    nodeCount: 0,
    maxContext: Number(backendModel.max_context),
    maxOutput: Number(backendModel.max_output),
    inputTokenPrice: backendModel.input_token_price,
    outputTokenPrice: backendModel.output_token_price,
    max_image_attachments: Number(backendModel.max_image_attachments),
    max_tools: Number(backendModel.max_tools),
    aaScore: fromOpt(backendModel.aa_score),
    releaseDate: fromOpt(backendModel.release_date),
    status: statusEnum,
    extra_body_json: fromOpt(backendModel.extra_body_json),
    isReasoning: backendModel.is_reasoning,
    isEmbedding: backendModel.is_embedding,
    isFeatured: backendModel.is_featured,
  };
};

// --- Node Mapping ---

// Maps BackendLocalNode (from gpt_user) to PublicNodeInfo (Frontend domain)
export const mapBackendLocalNodeToFrontend = (
  node: BackendLocalNode,
): PublicNodeInfo => {
  let ownerPrincipal: Principal;
  const nodePrincipalOpt = fromOpt(node.node_principal);
  if (nodePrincipalOpt) {
    ownerPrincipal = nodePrincipalOpt;
  } else {
    ownerPrincipal = Principal.anonymous();
  }

  return {
    nodeId: toNodeId(fromBigInt(node.node_id)),
    owner: ownerPrincipal,
    nodePrincipal: nodePrincipalOpt ?? null,
    hostname: node.address,
    modelId: node.model_id,
    isActive: true,
    publicKey: fromOpt(node.public_key) ?? null,
    attestationVerifiedAt: null,
    lastHeartbeatTimestamp: null,
    reportedMeasurementHex: null,
    reportedChipIdHex: null,
    detectedGeneration: null,
  };
};

// Maps BackendPublicNodeInfo (from gpt_index) to PublicNodeInfo (Frontend domain)
export const mapBackendPublicNodeInfoToFrontend = (
  node: BackendPublicNodeInfo,
): PublicNodeInfo => {
  return {
    nodeId: toNodeId(fromBigInt(node.node_id)),
    owner: node.owner,
    nodePrincipal: fromOpt(node.node_principal) ?? null,
    hostname: node.hostname,
    modelId: node.model_id,
    isActive: node.is_active,
    attestationVerifiedAt: fromOpt(node.attestation_verified_at)
      ? fromTimestamp(fromOpt(node.attestation_verified_at))
      : null,
    lastHeartbeatTimestamp: fromOpt(node.last_heartbeat_timestamp)
      ? fromTimestamp(fromOpt(node.last_heartbeat_timestamp))
      : null,
    reportedMeasurementHex: fromOpt(node.reported_measurement_hex) ?? null,
    reportedChipIdHex: fromOpt(node.reported_chip_id_hex) ?? null,
    detectedGeneration: fromOpt(node.detected_generation) ?? null,
    publicKey: fromOpt(node.public_key) ?? null,
  };
};

const mapCanisterPoolState = (
  state: BackendCanisterPoolState,
): CanisterInfo["state"] => {
  if ("Available" in state) {
    return { type: "Available" };
  } else if ("Assigned" in state) {
    const { owner, expires_at } = state.Assigned;
    return {
      type: "Assigned",
      owner: owner.toText(),
      expiresAt: expires_at.length > 0 ? fromTimestamp(expires_at[0]) : null,
    };
  }
  return { type: "Available" };
};

export const mapBackendCanisterPoolEntryToFrontend = (
  entry: BackendCanisterPoolEntry,
  storageData?: { usageBytes: number; limitBytes: number } | null,
): CanisterInfo => {
  const STORAGE_LIMIT = 7 * 1024 * 1024 * 1024; // 7 GiB
  const usageBytes = storageData?.usageBytes ?? 0;
  const limitBytes = storageData?.limitBytes ?? STORAGE_LIMIT;

  return {
    canisterId: entry.canister_id.toText(),
    timeCreated: fromTimestamp(entry.time_created),
    state: mapCanisterPoolState(entry.state),
    storageUsageBytes: storageData ? usageBytes : null,
    storageLimitBytes: limitBytes,
    storageUtilizationPct: storageData ? (usageBytes / limitBytes) * 100 : 0,
    isLoadingStorage: storageData === undefined,
    storageLoadError:
      storageData === null ? "Failed to load storage" : undefined,
  };
};

export const mapBackendCanisterPoolToFrontend = (
  response: BackendListCanisterPoolResponse,
): { available: CanisterInfo[]; assigned: CanisterInfo[]; poolTargetSize: number } => {
  return {
    available: response.available.map((entry) =>
      mapBackendCanisterPoolEntryToFrontend(entry),
    ),
    assigned: response.assigned.map((entry) =>
      mapBackendCanisterPoolEntryToFrontend(entry),
    ),
    poolTargetSize: response.pool_target_size,
  };
};
