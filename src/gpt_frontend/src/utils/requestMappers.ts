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
import { toOpt, toBigInt, toBlob } from "./candidUtils";

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
    attachments: toOpt(attachments as ImageAttachment[]),
    tools: toOpt(tools.length > 0 ? (tools as Tool[]) : undefined),
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
    attachments: toOpt(attachments as ImageAttachment[]),
    tools: toOpt(tools.length > 0 ? (tools as Tool[]) : undefined),
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
    attachments: toOpt(attachments as ImageAttachment[]),
    tools: toOpt(tools.length > 0 ? (tools as Tool[]) : undefined),
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
  return {
    chat_id: toBigInt(chatId),
    user_message_id: toBigInt(userMessageId),
    model_id: modelId,
    node_id: toBigInt(nodeId),
    temperature,
    max_completion_tokens: maxCompletionTokens,
    max_context: maxContext,
    encrypted_chat_key: toOpt(encryptedChatKey),
    tools: toOpt(tools.length > 0 ? (tools as Tool[]) : undefined),
    custom_prompt: toOpt(customPrompt),
    reasoning_effort: toOpt(reasoningEffort),
  };
};

export const mapContinueFromToolResponseRequest = (
  chatId: string,
  assistantMessageId: string,
  responses: { tool_call_id: string; content: string }[],
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
  return {
    chat_id: toBigInt(chatId),
    assistant_message_id: toBigInt(assistantMessageId),
    responses: responses,
    model_id: modelId,
    node_id: toBigInt(nodeId),
    temperature,
    max_completion_tokens: maxCompletionTokens,
    max_context: maxContext,
    encrypted_chat_key: toOpt(encryptedChatKey),
    tools: toOpt(tools.length > 0 ? (tools as Tool[]) : undefined),
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
  const backendChunks: TextChunk[] | undefined = chunks?.map((c) => ({
    chunk_index: c.chunk_index,
    start_char: c.start_char,
    end_char: c.end_char,
    embedding: toBlob(c.embedding), // Convert number[] to Uint8Array
  }));

  return {
    name,
    mime_type: mimeType,
    parent_folder_id: toBigInt(parentFolderId),
    content: toBlob(content),
    chunks: toOpt(backendChunks),
  };
};
