import { StateCreator } from "zustand";
import { useAuthStore } from "../../../authStore";
import { UserApi } from "@/services/api/userApi";
import { Message } from "../../../../types";
import type { ChatStoreState } from "../../index";
import { compileSystemPrompt } from "@/utils/promptUtils";
import { fromBigInt } from "@/utils/candidUtils";
import { ChatCrypto } from "@/utils/crypto/chat";
import { toMessageId, toJobId, ChatId } from "@/types/brands";

export interface RetryMessageActions {
  retryAiMessage: (chatId: string, userMessageId: string) => Promise<void>;
}

export const createRetryActions: StateCreator<
  ChatStoreState,
  [],
  [],
  RetryMessageActions
> = (set, get) => ({
  retryAiMessage: async (chatId, userMessageId) => {
    const { authClient, userCanisterId, rootKey } = useAuthStore.getState();
    if (!authClient || !userCanisterId || !rootKey) {
      console.warn("retryAiMessage: Aborting. User not fully registered.");
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
      setActiveLeaf,
      selectedTools,
      reasoningEffort,
      chats,
    } = get();

    if (!selectedModel) {
      console.error("No model selected, cannot retry.");
      return;
    }

    const currentChat = chats.find((c) => c.chatId === chatId);
    if (!currentChat || !currentChat.encryptionSalt) {
      console.error("Encryption data missing for chat.");
      return;
    }

    setIsGenerating(chatId, true);

    const compiledPrompt = compileSystemPrompt(selectedModel);

    try {
      const chosenNode = await pickNodeForModel(selectedModel.modelId);
      if (!chosenNode) throw new Error("No suitable node found.");
      if (!chosenNode.publicKey)
        throw new Error("Node missing public key for encryption.");

      const chatKey = await ChatCrypto.deriveChatKey(
        rootKey,
        currentChat.encryptionSalt,
      );
      const encryptedChatKey = await ChatCrypto.wrapKeyForNode(
        chatKey,
        chosenNode.publicKey,
      );

      const retryParams = {
        chatId,
        userMessageId,
        modelId: selectedModel.modelId,
        nodeId: Number(chosenNode.nodeId), // Convert NodeId to number for API
        temperature,
        maxCompletionTokens: maxOutput,
        maxContext: maxContext,
        encryptedChatKey,
        tools: selectedTools,
        customPrompt: compiledPrompt,
        reasoningEffort: reasoningEffort,
      };

      const result = await UserApi.retryAiMessage(
        authClient.getIdentity(),
        userCanisterId,
        retryParams,
      );

      const new_ai_message_id = toMessageId(
        fromBigInt(result.new_ai_message.message_id),
      );
      const job_id = toJobId(fromBigInt(result.job.job_id));

      const nowStr = new Date().toISOString();
      const newAiMessage: Message = {
        id: new_ai_message_id,
        backendId: new_ai_message_id,
        role: "assistant",
        content: "",
        jobId: job_id,
        parentMessageId: userMessageId as any,
        chatId: chatId as ChatId,
        createdAt: nowStr,
        updatedAt: nowStr,
        isComplete: false,
        modelId: selectedModel.modelId,
      };

      set((state) => {
        const updatedMessagesMap = new Map(state.messages[chatId]!);
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
      console.error("Error in retryAiMessage:", error);
      setIsGenerating(chatId, false);
    }
  },
});
