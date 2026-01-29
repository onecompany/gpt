import { StateCreator } from "zustand";
import { useAuthStore } from "@/store/authStore";
import { useModelsStore } from "@/store/modelsStore";
import { UserApi } from "@/services/api/userApi";
import { TITLE_GENERATION_PROMPT } from "@/constants/prompts";
import type { ChatStoreState } from "../index";
import { fromBigInt } from "@/utils/candidUtils";
import { ChatCrypto } from "@/utils/crypto/chat";
import { toChatId, toJobId, ChatId } from "@/types/brands";

export interface TitleGenerationActions {
  generateTitleForChat: (
    originalChatId: ChatId,
    firstMessageContent: string,
    initialPlaceholderTitle: string,
  ) => Promise<void>;
}

export const createTitleGenerationActions: StateCreator<
  ChatStoreState,
  [],
  [],
  TitleGenerationActions
> = (set, get) => ({
  generateTitleForChat: async (
    originalChatId,
    firstMessageContent,
    initialPlaceholderTitle,
  ) => {
    const { pickNodeForModel, renameChat, connectToChainWebSocket } = get();
    const { authClient, userCanisterId, rootKey } = useAuthStore.getState();

    if (!authClient || !userCanisterId || !rootKey) {
      return;
    }

    try {
      const { models } = useModelsStore.getState();
      if (!models || models.length === 0) return;

      // Only use featured models for title generation
      const cheapestModel = models
        .filter((model) => model.nodeCount > 0 && model.isFeatured)
        .sort(
          (a, b) =>
            a.inputTokenPrice +
            a.outputTokenPrice -
            (b.inputTokenPrice + b.outputTokenPrice),
        )[0];

      if (!cheapestModel) return;

      const content =
        firstMessageContent.length > 1000
          ? `${firstMessageContent.slice(0, 500)}...${firstMessageContent.slice(
              -500,
            )}`
          : firstMessageContent;
      const fullPrompt = TITLE_GENERATION_PROMPT.replace("{content}", content);

      const chosenNode = await pickNodeForModel(cheapestModel.modelId);
      if (!chosenNode) return;
      if (!chosenNode.publicKey) {
        console.error("Auto-title: Node missing public key.");
        return;
      }

      // 1. Encrypt Setup
      const tempSalt = ChatCrypto.generateSalt();
      const tempKey = await ChatCrypto.deriveChatKey(rootKey, tempSalt);
      const encryptedPrompt = await ChatCrypto.encryptMessage(
        fullPrompt,
        tempKey,
      );
      const encryptedKey = await ChatCrypto.wrapKeyForNode(
        tempKey,
        chosenNode.publicKey,
      );

      const createParams = {
        title: "Temporary Title Generation",
        initialMessage: new Uint8Array(encryptedPrompt),
        modelId: cheapestModel.modelId,
        nodeId: Number(chosenNode.nodeId), // Convert string NodeId to number for API if needed
        temperature: 0.2,
        maxCompletionTokens: 500,
        maxContext: cheapestModel.maxContext,
        encryptedChatKey: encryptedKey,
        encryptionSalt: new Uint8Array(tempSalt),
        attachments: [],
        tools: [],
        customPrompt: undefined,
        temporary: true,
      };

      const result = await UserApi.createChat(
        authClient.getIdentity(),
        userCanisterId,
        createParams,
      );

      const tempChatId = toChatId(fromBigInt(result.chat_id));
      const ai_message_id = result.ai_message_id;
      const tempJobId = toJobId(fromBigInt(result.job_id));

      // Connect with ephemeral context so it doesn't look in the store for this temporary chat
      void connectToChainWebSocket(
        tempChatId,
        tempJobId,
        chosenNode.address,
        chosenNode.nodeId,
        chosenNode.publicKey,
        { encryptionSalt: tempSalt },
      );

      const pollMessage = async (
        messageId: bigint,
        maxAttempts: number = 20,
        interval: number = 2500,
      ): Promise<string | null> => {
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((resolve) => setTimeout(resolve, interval));
          try {
            const encMsg = await UserApi.getMessage(
              authClient.getIdentity(),
              userCanisterId,
              messageId,
            );
            if (encMsg.isComplete || encMsg.errorStatus) {
              if (encMsg.errorStatus) return null;
              if (encMsg.encryptedContent.length > 0) {
                return await ChatCrypto.decryptMessage(
                  encMsg.encryptedContent,
                  tempKey,
                );
              }
            }
          } catch {
            return null;
          }
        }
        return null;
      };

      const generatedTitle = await pollMessage(ai_message_id);
      if (generatedTitle) {
        const currentChat = get().chats.find(
          (c) => c.chatId === originalChatId,
        );
        if (currentChat && currentChat.title !== initialPlaceholderTitle) {
          // User already renamed manually
          return;
        }

        const contentWithoutThinking = generatedTitle
          .replace(/<think>[\s\S]*?<\/think>/gi, "")
          .trim();

        const cleanedTitle = contentWithoutThinking
          .replace(/["*`“”_]/g, "")
          .trim()
          .slice(0, 50);

        if (cleanedTitle) {
          await renameChat(originalChatId, cleanedTitle);
        }
      }

      // Cleanup temporary chat
      try {
        await UserApi.deleteChat(
          authClient.getIdentity(),
          userCanisterId,
          tempChatId,
        );
      } catch (e) {
        console.error("Auto-title: Failed to cleanup temp chat", e);
      }
    } catch (error) {
      console.error(
        "Auto-title: Unhandled error in generation process:",
        error,
      );
    }
  },
});
