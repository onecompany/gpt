// Re-export brands for easy access
export * from "./brands";
import { ChatId, JobId, MessageId, NodeId, FileId, FolderId } from "./brands";
import { Principal } from "@icp-sdk/core/principal";

export type Role = "user" | "assistant" | "tool" | "system";
export type CompressionLevel =
  | "extreme"
  | "high"
  | "medium"
  | "low"
  | "lossless";

export type RenderMode = "markdown" | "plain";

export type FileUploadStatus =
  | "queued"
  | "embedding"
  | "converting"
  | "extracting"
  | "uploading"
  | "complete"
  | "error";

export interface TextChunk {
  chunk_index: number;
  start_char: number;
  end_char: number;
  embedding: number[]; // Frontend representation uses number[] for JSON serializability
  text?: string;
  sentences?: SentenceSpan[];
}

export interface FileUploadJob {
  id: string;
  uiId: string;
  fileName: string;
  fileType: "pdf" | "markdown" | "image" | "other";
  status: FileUploadStatus;
  subStatus: string;
  progress: number;
  error: string | null;
  modelId?: string;
  retries?: number;
  chunks?: Omit<TextChunk, "text">[];
}

export interface Tool {
  name: string;
  displayName?: string;
  description: string;
  parameters: string;
}

export interface Chat {
  chatId: ChatId;
  title: string;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  owner: string; // Principal string
  messageIds: MessageId[];
  jobIds: JobId[];
  activeJobId: JobId | null;
  archived: boolean;
  temporary: boolean;
  encryptionSalt: Uint8Array;
}

export interface MessageErrorStatus {
  type:
    | "Timeout"
    | "NodeOffline"
    | "ProviderError"
    | "CanisterCallError"
    | "InvalidState"
    | "ConfigurationError"
    | "Unknown";
  message?: string;
  details?: ProviderErrorType;
}

export interface ProviderErrorType {
  type:
    | "RateLimited"
    | "AuthenticationError"
    | "ServerError"
    | "ServiceUnavailable"
    | "BadRequest"
    | "ContextLengthExceeded"
    | "ContentPolicyViolation"
    | "NetworkError"
    | "Timeout"
    | "InvalidImage"
    | "Unknown";
  message?: string;
}

export interface ImageAttachment {
  mime_type: string;
  data: Uint8Array;
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: FunctionCall;
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
  error?: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// Decrypted message for UI state
export interface Message {
  id: MessageId;
  backendId?: MessageId; // Should ideally match id
  chatId: ChatId;
  role: Role;
  content: string;
  parentMessageId?: MessageId;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  errorStatus?: MessageErrorStatus;
  isComplete?: boolean;
  jobId?: JobId;
  modelId?: string;
  attachments?: ImageAttachment[];
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
  tool_call_id?: string;
  requires_client_action?: boolean;
  usage?: TokenUsage;
}

// Encrypted message from Backend API
export interface EncryptedMessage extends Omit<Message, "content"> {
  encryptedContent: Uint8Array;
}

export interface StreamedResponse {
  text: string;
  isComplete: boolean;
  errorStatus?: MessageErrorStatus;
  usage?: TokenUsage;
}

export type ModelStatus = "Active" | "Paused";

export interface Model {
  modelId: string;
  name: string;
  provider: string;
  providerModel: string;
  providerEndpoint: string;
  maker: ModelType;
  nodeCount: number;
  maxContext: number;
  maxOutput: number;
  inputTokenPrice: number;
  outputTokenPrice: number;
  max_image_attachments: number;
  max_tools: number;
  aaScore?: number;
  releaseDate?: string;
  status: ModelStatus;
  extra_body_json?: string;
  isReasoning: boolean;
}

export type ModelType =
  | "openai"
  | "meta"
  | "google"
  | "mistral"
  | "qwen"
  | "deepseek"
  | "anthropic"
  | "xai"
  | "moonshotai"
  | "perplexity";

export interface SliderOption {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: "image" | "text";
  file: File;
  previewUrl?: string;
  lines?: number;
}

export interface Folder {
  id: FolderId;
  name: string;
  parentId: FolderId | null;
}

export interface FileItem {
  id: FileId;
  name: string;
  size: number;
  uploadedAt: Date;
  mimeType: string;
  parentId: FolderId;
  chunks: TextChunk[];
}

export interface SentenceSpan {
  start: number;
  end: number;
}

export interface SearchableChunk extends TextChunk {
  id: string;
  fileId: FileId;
  text: string;
}

export interface SearchResult {
  id: string;
  text: string;
  rrf_score: number;
}

export interface GlobalSearchResult extends SearchResult {
  fileInfo: { name: string; id: FileId };
}

export type IndexingStatus = "idle" | "in-progress" | "complete" | "error";

export interface IndexingProgress {
  processed: number;
  total: number;
  currentFile: string;
}

export interface Job {
  job_id: JobId;
  chat_id: ChatId;
  node_id: NodeId;
  model_id: string;
  placeholder_message_id: MessageId;
  generation_status: unknown; // Opaque from backend variant
  temperature: number;
  max_completion_tokens: number;
  max_context: number;
  custom_prompt: string | undefined;
  tools: Tool[] | undefined;
  extra_body_json: string | undefined;
  reasoning_effort: string | undefined;
  created_at: number;
  updated_at: number;
}

export interface PublicNodeInfo {
  nodeId: NodeId;
  owner: Principal;
  nodePrincipal: Principal | null;
  hostname: string;
  modelId: string;
  isActive: boolean;
  attestationVerifiedAt: number | null;
  lastHeartbeatTimestamp: number | null;
  reportedMeasurementHex: string | null;
  reportedChipIdHex: string | null;
  detectedGeneration: string | null;
  publicKey: string | null;
}
