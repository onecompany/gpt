import { StateCreator } from "zustand";
import { useAuthStore } from "../../../authStore";
import { UserApi } from "@/services/api/userApi";
import { Message, Chat } from "../../../../types";
import type { ChatStoreState } from "../../index";
import { transformAttachmentsForBackend } from "./helpers";
import { compileSystemPrompt } from "@/utils/promptUtils";
import { fromBigInt } from "@/utils/candidUtils";
import { ChatCrypto } from "@/utils/crypto/chat";
import { toChatId, toJobId, toMessageId, MessageId } from "@/types/brands";

export interface CreateAndSendActions {
  createNewChatWithFirstMessage: () => Promise<string>;
}

export const createCreateAndSendActions: StateCreator<
  ChatStoreState,
  [],
  [],
  CreateAndSendActions
> = (set, get) => ({
  createNewChatWithFirstMessage: async () => {
    const logPrefix = `[ChatStore:createChat]`;
    const {
      input,
      attachments,
      scheduleAttachmentCleanup,
      selectedModel,
      temperature,
      maxOutput,
      maxContext,
      connectToChainWebSocket,
      pickNodeForModel,
      setActiveLeaf,
      setActiveChatJob,
      isNextChatTemporary,
      generateTitleForChat,
      selectedTools,
    } = get();

    const { authClient, userCanisterId, principal, rootKey } =
      useAuthStore.getState();

    if (!authClient || !userCanisterId || !rootKey) {
      throw new Error("User is not authenticated or Vault is locked.");
    }

    if (!selectedModel) {
      throw new Error("No model selected.");
    }

    const chosenNode = await pickNodeForModel(selectedModel.modelId);
    if (!chosenNode) {
      throw new Error(
        `No active nodes available for model: ${selectedModel.name}. Please try again later or select a different model.`,
      );
    }

    if (!chosenNode.publicKey) {
      throw new Error(
        "Selected node does not have a public key for encryption. Cannot proceed safely.",
      );
    }

    const backendAttachments =
      await transformAttachmentsForBackend(attachments);

    const compiledPrompt = compileSystemPrompt(selectedModel);

    try {
      const trimmedInput = input.trim();
      const newChatTitle = trimmedInput
        ? trimmedInput.length > 50
          ? trimmedInput.substring(0, 50) + "..."
          : trimmedInput
        : "New Chat";

      const chatSalt = ChatCrypto.generateSalt();
      const chatKey = await ChatCrypto.deriveChatKey(rootKey, chatSalt);

      const encryptedMessage = await ChatCrypto.encryptMessage(
        trimmedInput,
        chatKey,
      );

      const cleanPublicKey = chosenNode.publicKey.trim();
      const encryptedChatKeyForNode = await ChatCrypto.wrapKeyForNode(
        chatKey,
        cleanPublicKey,
      );

      const createParams = {
        title: newChatTitle,
        initialMessage: new Uint8Array(encryptedMessage),
        modelId: selectedModel.modelId,
        nodeId: Number(chosenNode.nodeId), // Convert NodeId to number for API
        temperature,
        maxCompletionTokens: maxOutput,
        maxContext: maxContext,
        encryptedChatKey: encryptedChatKeyForNode,
        encryptionSalt: new Uint8Array(chatSalt),
        attachments: backendAttachments,
        tools: selectedTools,
        customPrompt: compiledPrompt,
        temporary: isNextChatTemporary,
      };

      const response = await UserApi.createChat(
        authClient.getIdentity(),
        userCanisterId,
        createParams,
      );

      const realChatId = toChatId(fromBigInt(response.chat_id));
      const realUserMsgId = toMessageId(fromBigInt(response.user_message_id));
      const realAiMsgId = toMessageId(fromBigInt(response.ai_message_id));
      const realJobId = toJobId(fromBigInt(response.job_id));

      scheduleAttachmentCleanup();
      const nowStr = new Date().toISOString();

      const newUserMessage: Message = {
        id: realUserMsgId,
        backendId: realUserMsgId,
        role: "user",
        content: trimmedInput,
        createdAt: nowStr,
        updatedAt: nowStr,
        chatId: realChatId,
        attachments: backendAttachments,
      };

      const newAiMessage: Message = {
        id: realAiMsgId,
        backendId: realAiMsgId,
        role: "assistant",
        content: "",
        jobId: realJobId,
        parentMessageId: realUserMsgId,
        chatId: realChatId,
        createdAt: nowStr,
        updatedAt: nowStr,
        modelId: selectedModel.modelId,
        isComplete: false,
      };

      const newChatMessagesMap = new Map<MessageId, Message>()
        .set(newUserMessage.id, newUserMessage)
        .set(newAiMessage.id, newAiMessage);

      const newChatObject: Chat = {
        chatId: realChatId,
        title: newChatTitle,
        messageIds: [realUserMsgId, realAiMsgId],
        jobIds: [realJobId],
        activeJobId: realJobId,
        owner: principal || "",
        createdAt: nowStr,
        updatedAt: nowStr,
        archived: false,
        temporary: isNextChatTemporary,
        encryptionSalt: chatSalt,
      };

      set((state) => {
        return {
          messages: {
            ...state.messages,
            [realChatId]: newChatMessagesMap,
          },
          currentChatId: realChatId,
          chatTitle: newChatTitle,
          chats: [newChatObject, ...state.chats],
          isGenerating: {
            ...state.isGenerating,
            new: false,
            [realChatId]: true,
          },
          isWaiting: {
            ...state.isWaiting,
            new: false,
            [realChatId]: true,
          },
          isAITyping: {
            ...state.isAITyping,
            new: false,
            [realChatId]: true,
          },
          input: "",
        };
      });

      if (!get().messages[realChatId]) {
        set((state) => ({
          messages: {
            ...state.messages,
            [realChatId]: newChatMessagesMap,
          },
        }));
      }

      setActiveChatJob(realChatId, realJobId);
      setActiveLeaf(realChatId, realAiMsgId);

      if (trimmedInput && !isNextChatTemporary) {
        void generateTitleForChat(realChatId, trimmedInput, newChatTitle);
      }

      await connectToChainWebSocket(
        realChatId,
        realJobId,
        chosenNode.address,
        chosenNode.nodeId,
        chosenNode.publicKey,
        undefined,
      );

      return realChatId;
    } catch (error) {
      console.error(logPrefix, "Error creating chat:", error);
      get().setIsGenerating("new", false);
      get().setIsWaiting("new", false);
      get().setIsAITyping("new", false);
      scheduleAttachmentCleanup();
      throw error;
    }
  },
});
