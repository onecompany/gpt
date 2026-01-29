import { StateCreator } from "zustand";
import { useAuthStore } from "../../authStore";
import { UserApi } from "@/services/api/userApi";
import { processAndCompressFiles } from "@/utils/fileProcessor";
import { transformAttachmentsForBackend } from "./message/helpers";
import type { ChatStoreState } from "..";
import { OCR_PROMPT_TEMPLATE } from "@/constants/prompts";
import { fromBigInt } from "@/utils/candidUtils";
import { ChatCrypto } from "@/utils/crypto/chat";
import { toChatId, toJobId } from "@/types/brands";

export interface OcrActions {
  executeOcrOnImages: (images: File[], modelId: string) => Promise<string>;
}

export const createOcrActions: StateCreator<
  ChatStoreState,
  [],
  [],
  OcrActions
> = (_set, get) => ({
  executeOcrOnImages: async (images, modelId) => {
    const { authClient, userCanisterId, rootKey } = useAuthStore.getState();
    if (!authClient || !userCanisterId || !rootKey) {
      throw new Error("User is not authenticated or Vault is locked.");
    }

    const { pickNodeForModel, connectToChainWebSocket, addOcrPromise } = get();

    // 1. Pick a node for this model
    const chosenNode = await pickNodeForModel(modelId);
    if (!chosenNode) {
      throw new Error(`No available node for model ${modelId}.`);
    }
    if (!chosenNode.publicKey) {
      throw new Error("Node missing public key for encryption.");
    }

    // 2. Process and compress images
    const frontendAttachments = await processAndCompressFiles(images, "low");
    const backendAttachments =
      await transformAttachmentsForBackend(frontendAttachments);

    // 3. Generate Salt and Key for Temp Chat
    const chatSalt = ChatCrypto.generateSalt();
    const chatKey = await ChatCrypto.deriveChatKey(rootKey, chatSalt);

    // 4. Encrypt Prompt
    const encryptedPrompt = await ChatCrypto.encryptMessage(
      OCR_PROMPT_TEMPLATE,
      chatKey,
    );

    // 5. Encrypt Key for Node
    const encryptedChatKey = await ChatCrypto.wrapKeyForNode(
      chatKey,
      chosenNode.publicKey,
    );

    // 6. Create temporary chat with the OCR request
    const createParams = {
      title: "Temporary OCR Chat",
      initialMessage: new Uint8Array(encryptedPrompt),
      modelId: modelId,
      nodeId: Number(chosenNode.nodeId),
      temperature: 0.1,
      maxCompletionTokens: 4096,
      maxContext: 8192,
      encryptedChatKey: encryptedChatKey,
      encryptionSalt: new Uint8Array(chatSalt),
      attachments: backendAttachments,
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
    const tempJobId = toJobId(fromBigInt(result.job_id));

    // 7. Create a promise that will be resolved by the WebSocket message handler
    return new Promise<string>((resolve, reject) => {
      // Set up a timeout
      const timeout = setTimeout(() => {
        get().removeOcrPromise(tempJobId);
        reject(new Error("OCR request timed out after 5 minutes."));
      }, 300_000);

      // Wrap resolve/reject to clear timeout
      const wrappedResolve = (value: string) => {
        clearTimeout(timeout);
        resolve(value);
      };

      const wrappedReject = (reason?: unknown) => {
        clearTimeout(timeout);
        reject(reason);
      };

      // Register the OCR promise - this will be resolved by messageHandler
      // when the stream completes, or rejected by handleWebSocketError
      addOcrPromise(tempJobId, wrappedResolve, wrappedReject);

      // 8. Connect using the proper encrypted WebSocket infrastructure
      // The ephemeralContext allows it to work without the chat being in the store
      void connectToChainWebSocket(
        tempChatId,
        tempJobId,
        chosenNode.address,
        chosenNode.nodeId,
        chosenNode.publicKey,
        { encryptionSalt: chatSalt },
      );
    });
  },
});
