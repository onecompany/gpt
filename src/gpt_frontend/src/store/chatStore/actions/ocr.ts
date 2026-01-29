import { StateCreator } from "zustand";
import { useAuthStore } from "../../authStore";
import { UserApi } from "@/services/api/userApi";
import { processAndCompressFiles } from "@/utils/fileProcessor";
import { transformAttachmentsForBackend } from "./message/helpers";
import type { ChatStoreState } from "..";
import { buildWebSocketUrl } from "./webSocket/url";
import type { StreamedResponse } from "@/types";
import { OCR_PROMPT_TEMPLATE } from "@/constants/prompts";
import { fromBigInt } from "@/utils/candidUtils";
import { ChatCrypto } from "@/utils/crypto/chat";
import { toChatId, toJobId, ChatId } from "@/types/brands";

export interface OcrActions {
  executeOcrOnImages: (images: File[], modelId: string) => Promise<string>;
}

export const createOcrActions: StateCreator<
  ChatStoreState,
  [],
  [],
  OcrActions
> = (set, get) => ({
  executeOcrOnImages: async (images, modelId) => {
    const { authClient, userCanisterId, rootKey } = useAuthStore.getState();
    if (!authClient || !userCanisterId || !rootKey) {
      throw new Error("User is not authenticated or Vault is locked.");
    }

    let tempChatId: ChatId | null = null;
    let ws: WebSocket | null = null;

    try {
      return await new Promise<string>(async (resolve, reject) => {
        let isSettled = false;

        const timeout = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            reject(new Error("OCR request timed out after 5 minutes."));
          }
        }, 300_000);

        const settle = (resolver: (v: string) => void, value: string) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeout);
            resolver(value);
          }
        };

        const fail = (rejection: (r?: unknown) => void, reason: unknown) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeout);
            rejection(reason);
          }
        };

        try {
          const { pickNodeForModel } = get();
          const chosenNode = await pickNodeForModel(modelId);
          if (!chosenNode)
            throw new Error(`No available node for model ${modelId}.`);
          if (!chosenNode.publicKey)
            throw new Error("Node missing public key for encryption.");

          const frontendAttachments = await processAndCompressFiles(
            images,
            "low",
          );
          const backendAttachments =
            await transformAttachmentsForBackend(frontendAttachments);

          // 1. Generate Salt and Key for Temp Chat
          const chatSalt = ChatCrypto.generateSalt();
          const chatKey = await ChatCrypto.deriveChatKey(rootKey, chatSalt);

          // 2. Encrypt Prompt
          const encryptedPrompt = await ChatCrypto.encryptMessage(
            OCR_PROMPT_TEMPLATE,
            chatKey,
          );

          // 3. Encrypt Key for Node
          const encryptedChatKey = await ChatCrypto.wrapKeyForNode(
            chatKey,
            chosenNode.publicKey,
          );

          const createParams = {
            title: "Temporary OCR Chat",
            initialMessage: new Uint8Array(encryptedPrompt),
            modelId: modelId,
            nodeId: Number(chosenNode.nodeId), // API might still expect number if not fully converted
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

          tempChatId = toChatId(fromBigInt(result.chat_id));
          const tempJobId = toJobId(fromBigInt(result.job_id));

          const wsUrl =
            buildWebSocketUrl(chosenNode.address) + "/conversation/ws";
          ws = new WebSocket(wsUrl);

          ws.onopen = () =>
            ws?.send(JSON.stringify({ jobId: tempJobId, userCanisterId }));

          ws.onmessage = async (event) => {
            try {
              const data: StreamedResponse = JSON.parse(event.data);
              if (data.isComplete) {
                if (data.errorStatus) {
                  fail(
                    reject,
                    new Error(
                      `OCR generation failed: ${JSON.stringify(
                        data.errorStatus,
                      )}`,
                    ),
                  );
                } else {
                  settle(resolve, data.text);
                }
              }
            } catch {
              fail(reject, new Error("Failed to parse WebSocket message."));
            }
          };

          ws.onerror = () =>
            fail(reject, new Error("WebSocket connection error during OCR."));

          ws.onclose = () => {
            if (!isSettled) {
              fail(
                reject,
                new Error("WebSocket connection closed unexpectedly."),
              );
            }
          };
        } catch (error) {
          fail(reject, error);
        }
      });
    } finally {
      if (ws && (ws as WebSocket).readyState !== WebSocket.CLOSED) {
        (ws as WebSocket).close();
      }
      if (tempChatId !== null) {
        try {
          await UserApi.deleteChat(
            authClient.getIdentity(),
            userCanisterId,
            tempChatId,
          );
        } catch (e) {
          console.error("Failed to clean up temp chat", tempChatId, ":", e);
        }
      }
    }
  },
});
