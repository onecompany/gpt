import { Identity } from "@icp-sdk/core/agent";
import { getUserActor } from "../gptUserService";
import { unwrapResult, formatCanisterError } from "@/utils/resultUtils";
import {
  mapBackendChatToFrontend,
  mapBackendMessageToFrontend,
  mapBackendFile,
  mapBackendFolder,
  mapBackendLocalNodeToFrontend,
  mapBackendJobToFrontend,
} from "@/utils/mappers";
import { fromBigInt, fromOpt } from "@/utils/candidUtils";

import type {
  Chat,
  EncryptedMessage,
  Folder,
  FileItem,
  Job,
  PublicNodeInfo,
} from "@/types";
import { Principal } from "@icp-sdk/core/principal";
import { normalizePayload } from "@/utils/candidAdapter";
import { idlFactory } from "@candid/declarations/gpt_user.did.js";
import {
  ListChatsResponse,
  GetChatResponse,
  GetMessageResponse,
  CreateChatResponse,
  AddMessageResponse,
  EditUserMessageResponse,
  GetChatJobsResponse,
  RetryAiMessageResponse,
  ContinueFromToolResponseResponse,
  GptUserGetNodesResponse,
  GetFolderContentResponse,
  GetItemByPathResponse,
  GetFileContentResponse,
  CreateFolderResponse,
  UploadFileResponse,
  GetUserStorageUsageResponse,
} from "@candid/declarations/gpt_user.did";
import { toFileId, toFolderId } from "@/types/brands";

export class UserApi {
  private static async getActor(identity: Identity, canisterId: string) {
    if (!canisterId) throw new Error("User canister ID is required.");
    return await getUserActor(identity, canisterId);
  }

  static async listChats(
    identity: Identity,
    canisterId: string,
    includeArchived: boolean,
  ): Promise<Chat[]> {
    const actor = await this.getActor(identity, canisterId);
    // list_chats(record { include_archived: bool })
    const [payload] = normalizePayload(idlFactory, "list_chats", [
      { include_archived: includeArchived },
    ]);
    const result = await actor.list_chats(payload);
    const response = unwrapResult<ListChatsResponse, unknown>(
      result,
      formatCanisterError,
    );
    return response.chats.map(mapBackendChatToFrontend);
  }

  static async getChat(
    identity: Identity,
    canisterId: string,
    chatId: string,
  ): Promise<Chat> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "get_chat", [
      { chat_id: chatId },
    ]);
    const result = await actor.get_chat(payload);
    const response = unwrapResult<GetChatResponse, unknown>(
      result,
      formatCanisterError,
    );
    return mapBackendChatToFrontend(response.chat);
  }

  static async getMessage(
    identity: Identity,
    canisterId: string,
    messageId: bigint,
  ): Promise<EncryptedMessage> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "get_message", [
      { message_id: messageId },
    ]);
    const result = await actor.get_message(payload);
    const response = unwrapResult<GetMessageResponse, unknown>(
      result,
      formatCanisterError,
    );
    return mapBackendMessageToFrontend(response.message);
  }

  static async createChat(
    identity: Identity,
    canisterId: string,
    params: {
      title: string;
      initialMessage: Uint8Array;
      modelId: string;
      nodeId: number;
      temperature: number;
      maxCompletionTokens: number;
      maxContext: number;
      encryptedChatKey: string | undefined;
      encryptionSalt: Uint8Array;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: any[] | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: any[];
      customPrompt: string | undefined;
      temporary: boolean;
    },
  ): Promise<{
    chat_id: bigint;
    user_message_id: bigint;
    ai_message_id: bigint;
    job_id: bigint;
  }> {
    const actor = await this.getActor(identity, canisterId);

    const mappedParams = {
      title: params.title,
      initial_message: params.initialMessage,
      model_id: params.modelId,
      node_id: params.nodeId,
      temperature: params.temperature,
      max_completion_tokens: params.maxCompletionTokens,
      max_context: params.maxContext,
      encrypted_chat_key: params.encryptedChatKey,
      encryption_salt: params.encryptionSalt,
      attachments: params.attachments,
      tools: params.tools,
      custom_prompt: params.customPrompt,
      temporary: params.temporary,
    };

    const [req] = normalizePayload(idlFactory, "create_chat", [mappedParams]);
    const result = await actor.create_chat(req);
    return unwrapResult<CreateChatResponse, unknown>(
      result,
      formatCanisterError,
    );
  }

  static async addMessage(
    identity: Identity,
    canisterId: string,
    params: {
      chatId: string;
      content: Uint8Array;
      role: "User";
      modelId: string;
      nodeId: number;
      temperature: number;
      maxCompletionTokens: number;
      maxContext: number;
      encryptedChatKey: string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: any[] | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: any[];
      customPrompt: string | undefined;
      reasoningEffort: string | undefined;
      parentMessageId?: string;
    },
  ): Promise<AddMessageResponse> {
    const actor = await this.getActor(identity, canisterId);

    const mappedParams = {
      chat_id: params.chatId,
      parent_message_id: params.parentMessageId,
      role: { User: null },
      content: params.content,
      model_id: params.modelId,
      node_id: params.nodeId,
      temperature: params.temperature,
      max_completion_tokens: params.maxCompletionTokens,
      max_context: params.maxContext,
      encrypted_chat_key: params.encryptedChatKey,
      attachments: params.attachments,
      tools: params.tools,
      custom_prompt: params.customPrompt,
      reasoning_effort: params.reasoningEffort,
    };

    const [req] = normalizePayload(idlFactory, "add_message", [mappedParams]);
    const result = await actor.add_message(req);
    return unwrapResult<AddMessageResponse, unknown>(
      result,
      formatCanisterError,
    );
  }

  static async editUserMessage(
    identity: Identity,
    canisterId: string,
    params: {
      chatId: string;
      oldUserMessageId: string;
      newContent: Uint8Array;
      modelId: string;
      nodeId: number;
      temperature: number;
      maxCompletionTokens: number;
      maxContext: number;
      encryptedChatKey: string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: any[] | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: any[];
      customPrompt: string | undefined;
      reasoningEffort: string | undefined;
    },
  ): Promise<EditUserMessageResponse> {
    const actor = await this.getActor(identity, canisterId);

    const mappedParams = {
      chat_id: params.chatId,
      old_user_message_id: params.oldUserMessageId,
      new_content: params.newContent,
      model_id: params.modelId,
      node_id: params.nodeId,
      temperature: params.temperature,
      max_completion_tokens: params.maxCompletionTokens,
      max_context: params.maxContext,
      encrypted_chat_key: params.encryptedChatKey,
      attachments: params.attachments,
      tools: params.tools,
      custom_prompt: params.customPrompt,
      reasoning_effort: params.reasoningEffort,
    };

    const [req] = normalizePayload(idlFactory, "edit_user_message", [
      mappedParams,
    ]);
    const result = await actor.edit_user_message(req);
    return unwrapResult<EditUserMessageResponse, unknown>(
      result,
      formatCanisterError,
    );
  }

  static async deleteChat(
    identity: Identity,
    canisterId: string,
    chatId: string,
  ): Promise<void> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "delete_chat", [
      { chat_id: chatId },
    ]);
    const result = await actor.delete_chat(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async renameChat(
    identity: Identity,
    canisterId: string,
    chatId: string,
    newTitle: string,
  ): Promise<void> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "rename_chat", [
      { chat_id: chatId, new_title: newTitle },
    ]);
    const result = await actor.rename_chat(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async archiveChat(
    identity: Identity,
    canisterId: string,
    chatId: string,
  ): Promise<void> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "archive_chat", [
      { chat_id: chatId },
    ]);
    const result = await actor.archive_chat(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async unarchiveChat(
    identity: Identity,
    canisterId: string,
    chatId: string,
  ): Promise<void> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "unarchive_chat", [
      { chat_id: chatId },
    ]);
    const result = await actor.unarchive_chat(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async getChatJobs(
    identity: Identity,
    canisterId: string,
    chatId: string,
  ): Promise<Job[]> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "get_chat_jobs", [
      { chat_id: chatId },
    ]);
    const result = await actor.get_chat_jobs(payload);
    const response = unwrapResult<GetChatJobsResponse, unknown>(
      result,
      formatCanisterError,
    );
    return response.jobs.map(mapBackendJobToFrontend);
  }

  static async retryAiMessage(
    identity: Identity,
    canisterId: string,
    params: {
      chatId: string;
      userMessageId: string;
      modelId: string;
      nodeId: number;
      temperature: number;
      maxCompletionTokens: number;
      maxContext: number;
      encryptedChatKey: string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: any[];
      customPrompt: string | undefined;
      reasoningEffort: string | undefined;
    },
  ): Promise<RetryAiMessageResponse> {
    const actor = await this.getActor(identity, canisterId);

    const mappedParams = {
      chat_id: params.chatId,
      user_message_id: params.userMessageId,
      model_id: params.modelId,
      node_id: params.nodeId,
      temperature: params.temperature,
      max_completion_tokens: params.maxCompletionTokens,
      max_context: params.maxContext,
      encrypted_chat_key: params.encryptedChatKey,
      tools: params.tools,
      custom_prompt: params.customPrompt,
      reasoning_effort: params.reasoningEffort,
    };

    const [req] = normalizePayload(idlFactory, "retry_ai_message", [
      mappedParams,
    ]);
    const result = await actor.retry_ai_message(req);
    return unwrapResult<RetryAiMessageResponse, unknown>(
      result,
      formatCanisterError,
    );
  }

  static async storeToolResults(
    identity: Identity,
    canisterId: string,
    params: {
      chatId: string;
      assistantMessageId: string;
      results: { tool_call_id: string; content: string; error?: string }[];
    },
  ): Promise<void> {
    const actor = await this.getActor(identity, canisterId);
    const mappedParams = {
      chat_id: params.chatId,
      assistant_message_id: params.assistantMessageId,
      results: params.results,
    };
    const [req] = normalizePayload(idlFactory, "store_tool_results", [
      mappedParams,
    ]);
    const result = await actor.store_tool_results(req);
    unwrapResult(result, formatCanisterError);
  }

  static async continueFromToolResponse(
    identity: Identity,
    canisterId: string,
    params: {
      chatId: string;
      assistantMessageId: string;
      responses: { tool_call_id: string; content: string }[];
      modelId: string;
      nodeId: number;
      temperature: number;
      maxCompletionTokens: number;
      maxContext: number;
      encryptedChatKey: string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: any[];
      customPrompt: string | undefined;
      reasoningEffort: string | undefined;
    },
  ): Promise<{ new_ai_message_id: bigint; job_id: bigint }> {
    const actor = await this.getActor(identity, canisterId);

    const mappedParams = {
      chat_id: params.chatId,
      assistant_message_id: params.assistantMessageId,
      responses: params.responses,
      model_id: params.modelId,
      node_id: params.nodeId,
      temperature: params.temperature,
      max_completion_tokens: params.maxCompletionTokens,
      max_context: params.maxContext,
      encrypted_chat_key: params.encryptedChatKey,
      tools: params.tools,
      custom_prompt: params.customPrompt,
      reasoning_effort: params.reasoningEffort,
    };

    const [req] = normalizePayload(idlFactory, "continue_from_tool_response", [
      mappedParams,
    ]);
    const result = await actor.continue_from_tool_response(req);
    const response = unwrapResult<ContinueFromToolResponseResponse, unknown>(
      result,
      formatCanisterError,
    );
    return {
      new_ai_message_id: response.new_ai_message_id,
      job_id: response.job_id,
    };
  }

  // --- Node Methods ---

  static async getNodes(
    identity: Identity,
    canisterId: string,
  ): Promise<PublicNodeInfo[]> {
    const actor = await this.getActor(identity, canisterId);
    const result = await actor.get_nodes();
    const response = unwrapResult<GptUserGetNodesResponse, unknown>(
      result,
      formatCanisterError,
    );
    return response.nodes.map(mapBackendLocalNodeToFrontend);
  }

  // --- File System Methods ---

  static async getFolderContent(
    identity: Identity,
    canisterId: string,
    folderId: string | null,
  ): Promise<{
    files: FileItem[];
    folders: Folder[];
    folderId: string;
    folderName: string;
    parentFolderId: string | null;
  }> {
    const actor = await this.getActor(identity, canisterId);
    // folder_id in IDL is opt nat64. Adapter handles null -> []
    const [payload] = normalizePayload(idlFactory, "get_folder_content", [
      { folder_id: folderId },
    ]);
    const result = await actor.get_folder_content(payload);
    const response = unwrapResult<GetFolderContentResponse, unknown>(
      result,
      formatCanisterError,
    );

    return {
      files: response.files.map(mapBackendFile),
      folderId: fromBigInt(response.folder_id),
      folderName: response.folder_name,
      parentFolderId:
        response.parent_folder_id.length > 0
          ? fromBigInt(response.parent_folder_id[0])
          : null,
      folders: response.folders.map((f) =>
        mapBackendFolder(f, fromBigInt(response.folder_id)),
      ),
    };
  }

  static async getItemByPath(
    identity: Identity,
    canisterId: string,
    path: string,
  ): Promise<{
    item: { type: "file" | "folder"; id: string; parentId: string | null };
  }> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "get_item_by_path", [
      { path },
    ]);
    const result = await actor.get_item_by_path(payload);
    const response = unwrapResult<GetItemByPathResponse, unknown>(
      result,
      formatCanisterError,
    );

    if ("Folder" in response.item) {
      return {
        item: {
          type: "folder",
          id: fromBigInt(response.item.Folder.id),
          parentId: null,
        },
      };
    } else {
      return {
        item: {
          type: "file",
          id: fromBigInt(response.item.File.id),
          parentId: fromBigInt(response.item.File.parent_folder_id),
        },
      };
    }
  }

  static async getFileContent(
    identity: Identity,
    canisterId: string,
    fileId: string,
  ): Promise<{ content: Uint8Array; mimeType: string }> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "get_file_content", [
      { file_id: fileId },
    ]);
    const result = await actor.get_file_content(payload);
    const response = unwrapResult<GetFileContentResponse, unknown>(
      result,
      formatCanisterError,
    );
    return {
      content:
        response.content instanceof Uint8Array
          ? response.content
          : new Uint8Array(response.content),
      mimeType: response.mime_type,
    };
  }

  static async createFolder(
    identity: Identity,
    canisterId: string,
    name: string,
    parentId: string,
  ): Promise<string> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "create_folder", [
      { name, parent_folder_id: parentId },
    ]);
    const result = await actor.create_folder(payload);
    const response = unwrapResult<CreateFolderResponse, unknown>(
      result,
      formatCanisterError,
    );
    return fromBigInt(response.folder.id);
  }

  static async uploadFile(
    identity: Identity,
    canisterId: string,
    params: {
      name: string;
      mimeType: string;
      parentFolderId: string;
      content: Uint8Array;
      chunks?: {
        chunk_index: number;
        start_char: number;
        end_char: number;
        embedding: number[];
      }[];
    },
  ): Promise<string> {
    const actor = await this.getActor(identity, canisterId);
    const mappedParams = {
      name: params.name,
      mime_type: params.mimeType,
      parent_folder_id: params.parentFolderId,
      content: params.content,
      chunks: params.chunks,
    };
    const [req] = normalizePayload(idlFactory, "upload_file", [mappedParams]);
    const result = await actor.upload_file(req);
    const response = unwrapResult<UploadFileResponse, unknown>(
      result,
      formatCanisterError,
    );
    return toFileId(fromBigInt(response.file.id));
  }

  static async renameItem(
    identity: Identity,
    canisterId: string,
    id: string,
    type: "file" | "folder",
    newName: string,
  ): Promise<void> {
    const actor = await this.getActor(identity, canisterId);
    const mappedParams = {
      item_id: id,
      item_type: type === "file" ? { File: null } : { Folder: null },
      new_name: newName,
    };
    const [req] = normalizePayload(idlFactory, "rename_item", [mappedParams]);
    const result = await actor.rename_item(req);
    unwrapResult(result, formatCanisterError);
  }

  static async deleteItem(
    identity: Identity,
    canisterId: string,
    id: string,
    type: "file" | "folder",
  ): Promise<void> {
    const actor = await this.getActor(identity, canisterId);
    const mappedParams = {
      item_id: id,
      item_type: type === "file" ? { File: null } : { Folder: null },
    };
    const [req] = normalizePayload(idlFactory, "delete_item", [mappedParams]);
    const result = await actor.delete_item(req);
    unwrapResult(result, formatCanisterError);
  }

  // --- Registration & Vault ---

  static async isUserFinalized(
    identity: Identity,
    canisterId: string,
    userPrincipal: Principal,
  ): Promise<boolean> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "is_user_finalized", [
      { user_principal: userPrincipal },
    ]);
    const response = await actor.is_user_finalized(payload);
    return response.is_finalized;
  }

  static async whoami(
    identity: Identity,
    canisterId: string,
  ): Promise<{
    principal: Principal;
    enc_salt: Uint8Array | null;
    enc_validator: string | null;
  }> {
    const actor = await this.getActor(identity, canisterId);
    const response = await actor.whoami();

    return {
      principal: response.principal,
      enc_salt: fromOpt(response.enc_salt) ?? null,
      enc_validator: fromOpt(response.enc_validator) ?? null,
    };
  }

  static async finalizeRegistration(
    identity: Identity,
    canisterId: string,
    encSalt: number[] | Uint8Array,
    encValidator: string,
  ): Promise<void> {
    const actor = await this.getActor(identity, canisterId);
    const [payload] = normalizePayload(idlFactory, "finalize_registration", [
      {
        enc_salt: encSalt,
        enc_validator: encValidator,
      },
    ]);
    const result = await actor.finalize_registration(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async getUserStorageUsage(
    identity: Identity,
    canisterId: string,
  ): Promise<{ usageBytes: number; limitBytes: number }> {
    const actor = await this.getActor(identity, canisterId);
    const result = await actor.get_user_storage_usage();
    const response = unwrapResult<GetUserStorageUsageResponse, unknown>(
      result,
      formatCanisterError,
    );
    return {
      usageBytes: Number(response.usage_bytes),
      limitBytes: Number(response.limit_bytes),
    };
  }
}
