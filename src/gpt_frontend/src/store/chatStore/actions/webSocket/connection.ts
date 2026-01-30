import { StateCreator } from "zustand";
import { useAuthStore, AuthStatus } from "../../../authStore";
import type { ChatStoreState } from "../../index";
import {
  buildWebSocketUrl,
  createMessageHandler,
  handleWebSocketError,
  findTargetMessageDetails,
} from "./handlers";
import * as age from "age-encryption";
import { ChatCrypto } from "@/utils/crypto/chat";
import { ChatId, JobId, NodeId } from "@/types/brands";

export interface WebSocketActions {
  connectToChainWebSocket: (
    chatId: string,
    jobId: JobId,
    nodeAddress?: string,
    nodeId?: NodeId,
    nodePublicKey?: string,
    ephemeralContext?: { encryptionSalt: Uint8Array },
  ) => Promise<void>;
}

export const createWebSocketActions: StateCreator<
  ChatStoreState,
  [],
  [],
  WebSocketActions
> = (set, get) => ({
  connectToChainWebSocket: async (
    chatId,
    jobId,
    nodeAddress,
    nodeId,
    nodePublicKey,
    ephemeralContext,
  ) => {
    const logPrefix = `[ChatStore:WS]`;
    const handleError = (message: string, isConnectionError: boolean = true) =>
      handleWebSocketError(
        set,
        get,
        chatId as ChatId,
        jobId,
        message,
        isConnectionError,
        nodeId,
      );

    if (!nodeAddress || !nodeId || !nodePublicKey) {
      const errorMsg = `Node address, ID, or public key missing for job ${jobId}.`;
      console.error(logPrefix, errorMsg);
      handleWebSocketError(set, get, chatId as ChatId, jobId, errorMsg, true);
      return;
    }

    const { authStatus, authClient, userCanisterId, rootKey } =
      useAuthStore.getState();
    if (
      authStatus !== AuthStatus.REGISTERED ||
      !authClient ||
      !userCanisterId ||
      !rootKey
    ) {
      const errorMsg = `User not fully registered or vault locked for WebSocket connection for job ${jobId}.`;
      console.warn(logPrefix, errorMsg);
      handleError(errorMsg);
      return;
    }

    let encryptionSalt: Uint8Array;
    if (ephemeralContext) {
      encryptionSalt = ephemeralContext.encryptionSalt;
    } else {
      const currentChat = get().chats.find((c) => c.chatId === chatId);
      if (!currentChat || !currentChat.encryptionSalt) {
        const errorMsg = `Chat encryption data missing for chat ${chatId}.`;
        console.error(logPrefix, errorMsg);
        handleError(errorMsg);
        return;
      }
      encryptionSalt = currentChat.encryptionSalt;
    }

    let chatKey: CryptoKey;
    try {
      chatKey = await ChatCrypto.deriveChatKey(rootKey, encryptionSalt);
    } catch (e) {
      const errorMsg = `Failed to derive chat key: ${e}`;
      console.error(logPrefix, errorMsg);
      handleError(errorMsg);
      return;
    }

    let wsUrl: string;
    try {
      wsUrl = `${buildWebSocketUrl(nodeAddress)}/conversation/ws`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errorMsg = `Invalid node address format: ${errMsg}`;
      console.error(logPrefix, errorMsg);
      handleError(errorMsg);
      return;
    }

    console.log(logPrefix, "Attempting to connect to", wsUrl, "for job", jobId);

    try {
      let ws: WebSocket | undefined = get().webSockets[jobId];
      if (
        !ws ||
        ws.readyState === WebSocket.CLOSED ||
        ws.readyState === WebSocket.CLOSING
      ) {
        console.log(
          logPrefix,
          "Creating new WebSocket instance for job",
          jobId,
        );
        ws = new WebSocket(wsUrl);
        set((state: ChatStoreState) => ({
          webSockets: { ...state.webSockets, [jobId]: ws as WebSocket },
        }));
      } else {
        console.log(
          logPrefix,
          "Reusing existing WebSocket instance for job",
          jobId,
          "with readyState",
          ws.readyState,
        );
      }

      get().setActiveChatJob(chatId as ChatId, jobId, false);

      const { onMessage, cancel, hasReceivedFinalMessage } = createMessageHandler(
        set,
        get,
        chatId as ChatId,
        jobId,
        ws,
        chatKey,
      );

      ws.onopen = async () => {
        try {
          // Handshake payload (Job ID is string in JSON)
          const payload = JSON.stringify({ jobId, userCanisterId });

          const encrypter = new age.Encrypter();
          encrypter.addRecipient(nodePublicKey);
          const encryptedBytes = await encrypter.encrypt(payload);

          let binary = "";
          const len = encryptedBytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(encryptedBytes[i]);
          }
          const base64Payload = window.btoa(binary);

          ws!.send(base64Payload);
          console.log(
            logPrefix,
            "Connection opened for job",
            jobId,
            ". Sent encrypted handshake.",
          );

          if (get().webSockets[jobId] === ws) {
            set((state: ChatStoreState) => ({
              isWaiting: { ...state.isWaiting, [chatId]: false },
              isAITyping: { ...state.isAITyping, [chatId]: true },
              isGenerating: { ...state.isGenerating, [chatId]: true },
            }));
          }
        } catch (e) {
          console.error(
            logPrefix,
            "Failed to encrypt handshake for job",
            jobId,
            e,
          );
          ws!.close();
          handleError("Encryption handshake failed.");
        }
      };

      ws.onmessage = onMessage;

      ws.onerror = (event) => {
        console.error(logPrefix, "WebSocket error for job", jobId, ":", event);
        cancel();
        handleError("WebSocket connection encountered an error.");
        if (
          ws?.readyState !== WebSocket.CLOSING &&
          ws?.readyState !== WebSocket.CLOSED
        )
          ws.close();
      };

      ws.onclose = (evt) => {
        console.log(
          logPrefix,
          "Connection closed for job",
          jobId,
          ". Code:",
          evt.code,
          ", Reason:",
          evt.reason,
        );
        cancel();

        set((state: ChatStoreState) => {
          const newWebSockets = { ...state.webSockets };
          if (newWebSockets[jobId]) delete newWebSockets[jobId];
          return { webSockets: newWebSockets };
        });

        // If we received the final message, stream completed successfully - just clean up
        if (hasReceivedFinalMessage()) {
          console.log(
            logPrefix,
            "Stream completed successfully for job",
            jobId,
            "(final message received).",
          );
          set((state) => ({
            isGenerating: { ...state.isGenerating, [chatId]: false },
            isAITyping: { ...state.isAITyping, [chatId]: false },
            isWaiting: { ...state.isWaiting, [chatId]: false },
          }));
          get().clearActiveChatJob(chatId as ChatId);
          return;
        }

        // Defer error check to allow any pending async message processing to complete
        queueMicrotask(() => {
          const { message: finalLocalMessage } = findTargetMessageDetails(
            get,
            chatId as ChatId,
            jobId,
          );
          const alreadyHandledFinalStateViaStream =
            finalLocalMessage &&
            (finalLocalMessage.isComplete || !!finalLocalMessage.errorStatus);

          const isStillGenerating =
            get().isGenerating[chatId] ||
            get().isAITyping[chatId] ||
            get().isWaiting[chatId];

          if (!alreadyHandledFinalStateViaStream && isStillGenerating) {
            console.warn(
              logPrefix,
              "Connection closed unexpectedly for active job",
              jobId,
            );
            handleError(
              `WebSocket closed unexpectedly (code: ${
                evt.code
              }, reason: '${evt.reason || "unknown"}').`,
            );
          } else if (isStillGenerating) {
            set((state) => ({
              isGenerating: { ...state.isGenerating, [chatId]: false },
              isAITyping: { ...state.isAITyping, [chatId]: false },
              isWaiting: { ...state.isWaiting, [chatId]: false },
            }));
            get().clearActiveChatJob(chatId as ChatId);
          }
        });
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown";
      const errorMsg = `Error during WebSocket setup: ${errMsg}`;
      console.error(logPrefix, errorMsg);
      handleError(errorMsg);
    }
  },
});
