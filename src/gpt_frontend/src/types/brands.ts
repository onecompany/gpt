// Branded types utility to enforce type safety for IDs that are structurally strings
// but semantically distinct. We use strings in the frontend to avoid BigInt serialization issues
// and precision loss with Javascript numbers.

export type Brand<K, T> = K & { readonly __brand: T };

export type UserId = Brand<string, "UserId">;
export type ChatId = Brand<string, "ChatId">;
export type MessageId = Brand<string, "MessageId">;
export type NodeId = Brand<string, "NodeId">;
export type JobId = Brand<string, "JobId">;
export type FolderId = Brand<string, "FolderId">;
export type FileId = Brand<string, "FileId">;
export type PrincipalString = Brand<string, "PrincipalString">;

// Helpers to cast string to branded type
// These are "trusted" casts at the boundary (mappers)
export function toUserId(id: string): UserId {
  return id as UserId;
}

export function toChatId(id: string): ChatId {
  return id as ChatId;
}

export function toMessageId(id: string): MessageId {
  return id as MessageId;
}

export function toNodeId(id: string): NodeId {
  return id as NodeId;
}

export function toJobId(id: string): JobId {
  return id as JobId;
}

export function toFolderId(id: string): FolderId {
  return id as FolderId;
}

export function toFileId(id: string): FileId {
  return id as FileId;
}

export function toPrincipalString(id: string): PrincipalString {
  return id as PrincipalString;
}
