import { StateCreator } from "zustand";
import { useAuthStore } from "../../../authStore";
import { UserApi } from "@/services/api/userApi";
import { Message } from "../../../../types";
import type { ChatStoreState } from "../../index";
import { transformAttachmentsForBackend } from "./helpers";
import { compileSystemPrompt } from "@/utils/promptUtils";
import { fromBigInt } from "@/utils/candidUtils";
import { ChatCrypto } from "@/utils/crypto/chat";
import { toMessageId, toJobId, MessageId, ChatId } from "@/types/brands";

export interface EditMessageActions {
  editUserMessage: (
    chatId: string,
    oldUserMessageId: string,
    newContent: string,
  ) => Promise<void>;
}

export const createEditActions: StateCreator<
  ChatStoreState,
  [],
  [],
  EditMessageActions
> = (set, get) => ({
  editUserMessage: async (chatId, oldUserMessageId, newContent) => {
    const { authClient, userCanisterId, rootKey } = useAuthStore.getState();
    if (!authClient || !userCanisterId || !rootKey) {
      console.warn("editUserMessage: Aborting. User/Vault not ready.");
      return;
    }

    const {
      selectedModel,
      temperature,
      maxOutput,
      maxContext,
      connectToChainWebSocket,
      setIsGenerating,
      pickNodeForModel,
      messages,
      setActiveLeaf,
      attachments,
      scheduleAttachmentCleanup,
      selectedTools,
      reasoningEffort,
      chats,
    } = get();

    if (!selectedModel || (!newContent.trim() && attachments.length === 0)) {
      console.error("No model selected or content is empty.");
      return;
    }

    const currentChat = chats.find((c) => c.chatId === chatId);
    if (!currentChat || !currentChat.encryptionSalt) {
      console.error("Chat encryption metadata missing.");
      return;
    }

    setIsGenerating(chatId, true);

    const compiledPrompt = compileSystemPrompt(selectedModel);

    try {
      const chatMessagesMap = messages[chatId];
      if (!(chatMessagesMap instanceof Map))
        throw new Error("Message map not found.");

      const oldLocalUser = chatMessagesMap.get(oldUserMessageId as MessageId);

      const chosenNode = await pickNodeForModel(selectedModel.modelId);
      if (!chosenNode) throw new Error("No suitable node found.");
      if (!chosenNode.publicKey)
        throw new Error("Node missing public key for encryption.");

      const backendAttachments =
        await transformAttachmentsForBackend(attachments);

      const chatKey = await ChatCrypto.deriveChatKey(
        rootKey,
        currentChat.encryptionSalt,
      );
      const encryptedContent = await ChatCrypto.encryptMessage(
        newContent,
        chatKey,
      );
      const encryptedChatKey = await ChatCrypto.wrapKeyForNode(
        chatKey,
        chosenNode.publicKey,
      );

      const editParams = {
        chatId,
        oldUserMessageId,
        newContent: new Uint8Array(encryptedContent),
        modelId: selectedModel.modelId,
        nodeId: Number(chosenNode.nodeId), // Convert branded NodeId to number
        temperature,
        maxCompletionTokens: maxOutput,
        maxContext: maxContext,
        encryptedChatKey,
        attachments: backendAttachments,
        tools: selectedTools,
        customPrompt: compiledPrompt,
        // Embedding models don't support reasoning_effort
        reasoningEffort: selectedModel.isEmbedding ? undefined : reasoningEffort,
      };

      const result = await UserApi.editUserMessage(
        authClient.getIdentity(),
        userCanisterId,
        editParams,
      );

      scheduleAttachmentCleanup();
      const new_user_message_id = toMessageId(
        fromBigInt(result.new_user_message.message_id),
      );
      const new_ai_message_id = toMessageId(
        fromBigInt(result.new_ai_message.message_id),
      );
      const job_id = toJobId(fromBigInt(result.job.job_id));

      const nowStr = new Date().toISOString();
      const newUserMessage: Message = {
        id: new_user_message_id,
        backendId: new_user_message_id,
        role: "user",
        content: newContent,
        createdAt: nowStr,
        updatedAt: nowStr,
        chatId: chatId as ChatId,
        parentMessageId: oldLocalUser?.parentMessageId,
        modelId: selectedModel.modelId,
        attachments: backendAttachments,
      };
      const newAiMessage: Message = {
        id: new_ai_message_id,
        backendId: new_ai_message_id,
        role: "assistant",
        content: "",
        jobId: job_id,
        parentMessageId: new_user_message_id,
        chatId: chatId as ChatId,
        createdAt: nowStr,
        updatedAt: nowStr,
        modelId: selectedModel.modelId,
        isComplete: false,
      };

      set((state) => {
        const updatedMessagesMap = new Map(state.messages[chatId]!);
        updatedMessagesMap.set(newUserMessage.id, newUserMessage);
        updatedMessagesMap.set(newAiMessage.id, newAiMessage);
        return {
          messages: { ...state.messages, [chatId]: updatedMessagesMap },
          chats: state.chats.map((chat) =>
            chat.chatId === chatId ? { ...chat, updatedAt: nowStr } : chat,
          ),
        };
      });

      setActiveLeaf(chatId as ChatId, new_ai_message_id);
      await connectToChainWebSocket(
        chatId as ChatId,
        job_id,
        chosenNode.address,
        chosenNode.nodeId,
        chosenNode.publicKey,
        undefined,
      );
    } catch (error) {
      console.error("Error in editUserMessage:", error);
      setIsGenerating(chatId, false);
      scheduleAttachmentCleanup();
    }
  },
});
