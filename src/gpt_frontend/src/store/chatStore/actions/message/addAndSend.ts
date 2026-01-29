import { StateCreator } from "zustand";
import { useAuthStore } from "../../../authStore";
import { UserApi } from "@/services/api/userApi";
import { Message } from "../../../../types";
import type { ChatStoreState } from "../../index";
import { transformAttachmentsForBackend } from "./helpers";
import { compileSystemPrompt } from "@/utils/promptUtils";
import { fromBigInt } from "@/utils/candidUtils";
import { ChatCrypto } from "@/utils/crypto/chat";
import { toJobId, toMessageId, MessageId } from "@/types/brands";

export interface AddMessageActions {
  addMessageToExistingChat: () => Promise<string>;
}

export const createAddMessageActions: StateCreator<
  ChatStoreState,
  [],
  [],
  AddMessageActions
> = (set, get) => ({
  addMessageToExistingChat: async () => {
    const {
      input,
      attachments,
      scheduleAttachmentCleanup,
      setIsGenerating,
      setIsWaiting,
      setIsAITyping,
      currentChatId,
      selectedModel,
      temperature,
      maxOutput,
      maxContext,
      activeLeafMessageId,
      connectToChainWebSocket,
      pickNodeForModel,
      setActiveLeaf,
      setActiveChatJob,
      selectedTools,
      reasoningEffort,
      chats,
    } = get();

    const { authClient, userCanisterId, rootKey } = useAuthStore.getState();

    if (!authClient || !userCanisterId || !rootKey) {
      throw new Error("User is not authenticated or Vault is locked.");
    }

    if (!currentChatId) {
      throw new Error("No active chat ID found.");
    }

    const currentChat = chats.find((c) => c.chatId === currentChatId);
    if (!currentChat || !currentChat.encryptionSalt) {
      throw new Error(
        "Chat metadata missing or encryption not initialized for this chat.",
      );
    }

    if (!selectedModel) {
      throw new Error("No model selected.");
    }

    const chosenNode = await pickNodeForModel(selectedModel.modelId);
    if (!chosenNode) {
      throw new Error(
        `No active nodes available for model: ${selectedModel.name}.`,
      );
    }

    if (!chosenNode.publicKey) {
      throw new Error(
        "Selected node does not have a public key for encryption.",
      );
    }

    const backendAttachments =
      await transformAttachmentsForBackend(attachments);

    const compiledPrompt = compileSystemPrompt(selectedModel);

    try {
      const trimmedInput = input.trim();
      const parentId = activeLeafMessageId[currentChatId]
        ? (activeLeafMessageId[currentChatId] as string)
        : undefined;

      const chatKey = await ChatCrypto.deriveChatKey(
        rootKey,
        currentChat.encryptionSalt,
      );

      const encryptedContent = await ChatCrypto.encryptMessage(
        trimmedInput,
        chatKey,
      );

      const encryptedChatKeyForNode = await ChatCrypto.wrapKeyForNode(
        chatKey,
        chosenNode.publicKey,
      );

      const addParams = {
        chatId: currentChatId,
        content: new Uint8Array(encryptedContent),
        role: "User" as const,
        modelId: selectedModel.modelId,
        nodeId: Number(chosenNode.nodeId), // Convert branded NodeId to number for API logic if needed
        temperature,
        maxCompletionTokens: maxOutput,
        maxContext: maxContext,
        encryptedChatKey: encryptedChatKeyForNode,
        attachments: backendAttachments,
        tools: selectedTools,
        customPrompt: compiledPrompt,
        reasoningEffort: reasoningEffort,
        parentMessageId: parentId,
      };

      const response = await UserApi.addMessage(
        authClient.getIdentity(),
        userCanisterId,
        addParams,
      );

      const realUserMsgId = toMessageId(fromBigInt(response.message.message_id));
      const realAiMsgId = toMessageId(fromBigInt(response.ai_message.message_id));
      const realJobId = toJobId(fromBigInt(response.job.job_id));

      scheduleAttachmentCleanup();
      const nowStr = new Date().toISOString();

      const newUserMessage: Message = {
        id: realUserMsgId,
        backendId: realUserMsgId,
        role: "user",
        content: trimmedInput,
        createdAt: nowStr,
        updatedAt: nowStr,
        chatId: currentChatId,
        parentMessageId: parentId as MessageId | undefined,
        attachments: backendAttachments,
      };

      const newAiMessage: Message = {
        id: realAiMsgId,
        backendId: realAiMsgId,
        role: "assistant",
        content: "",
        jobId: realJobId,
        parentMessageId: realUserMsgId,
        chatId: currentChatId,
        createdAt: nowStr,
        updatedAt: nowStr,
        modelId: selectedModel.modelId,
        isComplete: false,
      };

      set((state) => {
        const existingMessages = state.messages[currentChatId!] || new Map();
        const updatedMessagesMap = new Map(existingMessages);
        updatedMessagesMap.set(newUserMessage.id, newUserMessage);
        updatedMessagesMap.set(newAiMessage.id, newAiMessage);
        return {
          messages: {
            ...state.messages,
            [currentChatId!]: updatedMessagesMap,
          },
          chats: state.chats.map((chat) =>
            chat.chatId === currentChatId
              ? { ...chat, updatedAt: nowStr, activeJobId: realJobId }
              : chat,
          ),
          input: "",
        };
      });

      setActiveLeaf(currentChatId, realAiMsgId);
      setActiveChatJob(currentChatId, realJobId);
      await connectToChainWebSocket(
        currentChatId,
        realJobId,
        chosenNode.address,
        chosenNode.nodeId,
        chosenNode.publicKey,
        undefined,
      );
      return currentChatId;
    } catch (error) {
      console.error("[ChatStore:addMessage] Error adding message:", error);
      setIsGenerating(currentChatId, false);
      setIsWaiting(currentChatId, false);
      setIsAITyping(currentChatId, false);
      scheduleAttachmentCleanup();
      throw error;
    }
  },
});
