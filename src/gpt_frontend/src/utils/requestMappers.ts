import {
  AddMessageRequest,
  CreateChatRequest,
  EditUserMessageRequest,
  ImageAttachment,
  RetryAiMessageRequest,
  Tool,
  ContinueFromToolResponseRequest,
  ToolResult,
  StoreToolResultsRequest,
  UploadFileRequest,
  TextChunk,
} from "@candid/declarations/gpt_user.did";
import { toOpt, toBigInt, toBlob, serializeEmbedding } from "./candidUtils";

// Request mappers convert Frontend primitives (strings, numbers, simple arrays)
// to Backend primitives (BigInts, Optionals, Variants, Uint8Arrays)

export const mapCreateChatRequest = (
  title: string,
  initialMessage: Uint8Array,
  modelId: string,
  nodeId: number,
  temperature: number,
  maxCompletionTokens: number,
  maxContext: number,
  encryptedChatKey: string | undefined,
  encryptionSalt: Uint8Array,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments: any[] | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any[],
  customPrompt: string | undefined,
  temporary: boolean,
): CreateChatRequest => {
  // NOTE: For `opt vec` types, pass raw arrays - normalizePayload handles optional wrapping.
  // Type assertions needed because Candid types expect `[] | [T[]]` but adapter converts at runtime.
  return {
    title,
    initial_message: toBlob(initialMessage),
    model_id: modelId,
    node_id: toBigInt(nodeId),
    temperature,
    max_completion_tokens: maxCompletionTokens,
    max_context: maxContext,
    encrypted_chat_key: toOpt(encryptedChatKey),
    encryption_salt: toBlob(encryptionSalt),
    attachments: (attachments as ImageAttachment[]) as [] | [ImageAttachment[]],
    tools: (tools.length > 0 ? (tools as Tool[]) : undefined) as
      | []
      | [Tool[]],
    custom_prompt: toOpt(customPrompt),
    temporary,
  };
};

export const mapAddMessageRequest = (
  chatId: string,
  content: Uint8Array,
  role: "User",
  modelId: string,
  nodeId: number,
  temperature: number,
  maxCompletionTokens: number,
  maxContext: number,
  encryptedChatKey: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments: any[] | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any[],
  customPrompt: string | undefined,
  reasoningEffort: string | undefined,
  parentMessageId?: string,
): AddMessageRequest => {
  // NOTE: For `opt vec` types, pass raw arrays - normalizePayload handles optional wrapping.
  return {
    chat_id: toBigInt(chatId),
    parent_message_id: parentMessageId ? [toBigInt(parentMessageId)] : [],
    role: { User: null },
    content: toBlob(content),
    model_id: modelId,
    node_id: toBigInt(nodeId),
    temperature,
    max_completion_tokens: maxCompletionTokens,
    max_context: maxContext,
    encrypted_chat_key: toOpt(encryptedChatKey),
    attachments: (attachments as ImageAttachment[]) as [] | [ImageAttachment[]],
    tools: (tools.length > 0 ? (tools as Tool[]) : undefined) as
      | []
      | [Tool[]],
    custom_prompt: toOpt(customPrompt),
    reasoning_effort: toOpt(reasoningEffort),
  };
};

export const mapEditUserMessageRequest = (
  chatId: string,
  oldUserMessageId: string,
  newContent: Uint8Array,
  modelId: string,
  nodeId: number,
  temperature: number,
  maxCompletionTokens: number,
  maxContext: number,
  encryptedChatKey: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments: any[] | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any[],
  customPrompt: string | undefined,
  reasoningEffort: string | undefined,
): EditUserMessageRequest => {
  // NOTE: For `opt vec` types, pass raw arrays - normalizePayload handles optional wrapping.
  return {
    chat_id: toBigInt(chatId),
    old_user_message_id: toBigInt(oldUserMessageId),
    new_content: toBlob(newContent),
    model_id: modelId,
    node_id: toBigInt(nodeId),
    temperature,
    max_completion_tokens: maxCompletionTokens,
    max_context: maxContext,
    encrypted_chat_key: toOpt(encryptedChatKey),
    attachments: (attachments as ImageAttachment[]) as [] | [ImageAttachment[]],
    tools: (tools.length > 0 ? (tools as Tool[]) : undefined) as
      | []
      | [Tool[]],
    custom_prompt: toOpt(customPrompt),
    reasoning_effort: toOpt(reasoningEffort),
  };
};

export const mapRetryAiMessageRequest = (
  chatId: string,
  userMessageId: string,
  modelId: string,
  nodeId: number,
  temperature: number,
  maxCompletionTokens: number,
  maxContext: number,
  encryptedChatKey: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any[],
  customPrompt: string | undefined,
  reasoningEffort: string | undefined,
): RetryAiMessageRequest => {
  // NOTE: For `opt vec` types, pass raw arrays - normalizePayload handles optional wrapping.
  return {
    chat_id: toBigInt(chatId),
    user_message_id: toBigInt(userMessageId),
    model_id: modelId,
    node_id: toBigInt(nodeId),
    temperature,
    max_completion_tokens: maxCompletionTokens,
    max_context: maxContext,
    encrypted_chat_key: toOpt(encryptedChatKey),
    tools: (tools.length > 0 ? (tools as Tool[]) : undefined) as
      | []
      | [Tool[]],
    custom_prompt: toOpt(customPrompt),
    reasoning_effort: toOpt(reasoningEffort),
  };
};

export const mapContinueFromToolResponseRequest = (
  chatId: string,
  assistantMessageId: string,
  responses: { tool_call_id: string; content: Uint8Array }[],
  modelId: string,
  nodeId: number,
  temperature: number,
  maxCompletionTokens: number,
  maxContext: number,
  encryptedChatKey: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any[],
  customPrompt: string | undefined,
  reasoningEffort: string | undefined,
): ContinueFromToolResponseRequest => {
  const mappedResponses = responses.map((res) => ({
    tool_call_id: res.tool_call_id,
    content: toBlob(res.content),
  }));

  // NOTE: For `opt vec` types, pass raw arrays - normalizePayload handles optional wrapping.
  return {
    chat_id: toBigInt(chatId),
    assistant_message_id: toBigInt(assistantMessageId),
    responses: mappedResponses,
    model_id: modelId,
    node_id: toBigInt(nodeId),
    temperature,
    max_completion_tokens: maxCompletionTokens,
    max_context: maxContext,
    encrypted_chat_key: toOpt(encryptedChatKey),
    tools: (tools.length > 0 ? (tools as Tool[]) : undefined) as
      | []
      | [Tool[]],
    custom_prompt: toOpt(customPrompt),
    reasoning_effort: toOpt(reasoningEffort),
  };
};

export const mapStoreToolResultsRequest = (
  chatId: string,
  assistantMessageId: string,
  results: { tool_call_id: string; content: string; error?: string }[],
): StoreToolResultsRequest => {
  const mappedResults: ToolResult[] = results.map((res) => ({
    tool_call_id: res.tool_call_id,
    content: res.content,
    error: toOpt(res.error),
  }));

  return {
    chat_id: toBigInt(chatId),
    assistant_message_id: toBigInt(assistantMessageId),
    results: mappedResults,
  };
};

export const mapUploadFileRequest = (
  name: string,
  mimeType: string,
  parentFolderId: string,
  content: Uint8Array,
  chunks?: {
    chunk_index: number;
    start_char: number;
    end_char: number;
    embedding: number[];
  }[],
): UploadFileRequest => {
  const backendChunks: TextChunk[] | undefined = chunks?.map((c) => {
    const serialized = serializeEmbedding(c.embedding);

    // Debug: Log embedding serialization on upload
    console.log('[mapUploadFileRequest] Chunk', c.chunk_index, {
      inputEmbeddingLength: c.embedding?.length ?? 0,
      inputEmbeddingSample: c.embedding?.slice(0, 3) ?? 'N/A',
      serializedLength: serialized.length,
      serializedSample: Array.from(serialized.slice(0, 8)),
      expectedBytesForFloat32: (c.embedding?.length ?? 0) * 4,
    });

    return {
      chunk_index: c.chunk_index,
      start_char: c.start_char,
      end_char: c.end_char,
      embedding: serialized,
    };
  });

  console.log('[mapUploadFileRequest] Total chunks:', backendChunks?.length ?? 0);

  // NOTE: For `opt vec` types, pass raw arrays - normalizePayload handles optional wrapping.
  // Don't use toOpt for opt vec types as the adapter's visitOpt case 4 would double-wrap.
  return {
    name,
    mime_type: mimeType,
    parent_folder_id: toBigInt(parentFolderId),
    content: toBlob(content),
    chunks: backendChunks as [] | [TextChunk[]],
  };
};