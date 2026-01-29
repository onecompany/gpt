import type { ChatStoreState } from "../../index";
import type { Message, StreamedResponse } from "../../../../types";
import { handleWebSocketError } from "./error";
import { ChatCrypto } from "@/utils/crypto/chat";
import { normalizeErrorStatus } from "@/utils/mappers";
import { ChatId, JobId, MessageId } from "@/types/brands";

export const createMessageHandler = (
  set: (fn: (state: ChatStoreState) => Partial<ChatStoreState>) => void,
  get: () => ChatStoreState,
  chatId: ChatId,
  jobId: JobId,
  ws: WebSocket,
  chatKey: CryptoKey,
) => {
  let latestMessageData: StreamedResponse | null = null;
  let isUpdateScheduled = false;
  let animationFrameId: number | null = null;

  const processBatchedUpdate = () => {
    isUpdateScheduled = false;
    animationFrameId = null;
    if (!latestMessageData) return;

    const currentData = latestMessageData;
    latestMessageData = null;

    set((state: ChatStoreState) => {
      let currentMessagesMap = state.messages[chatId];

      if (!currentMessagesMap) {
        const chatExists = state.chats.some((c) => c.chatId === chatId);
        if (chatExists) {
          console.warn(
            `[WS:Handler] RECOVERING: Message map missing for chat ${chatId}. Re-initializing map.`,
          );
          currentMessagesMap = new Map();
        } else {
          if (currentData.isComplete || currentData.errorStatus) {
            console.warn(
              `[WS:Handler] Chat ${chatId} not found in store. Keys present: ${Object.keys(
                state.messages,
              ).join(", ")}`,
            );
          }
          return {};
        }
      }

      const mapToUse = currentMessagesMap || new Map<MessageId, Message>();

      let targetId: MessageId | null = null;
      let existingAiMessage: Message | undefined = undefined;

      for (const [id, msg] of mapToUse.entries()) {
        if (msg.role === "assistant" && msg.jobId === jobId) {
          targetId = (msg.backendId ?? id) as MessageId;
          existingAiMessage = msg;
          break;
        }
      }

      if (targetId === null || !existingAiMessage) {
        if (currentData.isComplete || currentData.errorStatus) {
          console.warn(
            `[WS:Handler] No local message found for job ${jobId} in chat ${chatId}.`,
          );
          setTimeout(() => get().fetchMessages(chatId), 500);
        }
        if (!state.messages[chatId] && mapToUse.size === 0) {
          return { messages: { ...state.messages, [chatId]: mapToUse } };
        }
        return {};
      }

      const isStreamComplete = currentData.isComplete;
      const hasTextContent = currentData.text.trim().length > 0;
      const hasOnlyReasoning =
        hasTextContent &&
        currentData.text.trim().endsWith("</think>") &&
        currentData.text
          .substring(currentData.text.indexOf("</think>") + 8)
          .trim().length === 0;

      const isLikelyToolCall =
        isStreamComplete &&
        !currentData.errorStatus &&
        (!hasTextContent || hasOnlyReasoning);

      const shouldSetComplete = isStreamComplete && !isLikelyToolCall;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalizedErrorStatus = normalizeErrorStatus(
        currentData.errorStatus as any,
      );

      const updatedAiMessage: Message = {
        ...existingAiMessage,
        content: currentData.text,
        updatedAt: new Date().toISOString(),
        isComplete: shouldSetComplete || !!normalizedErrorStatus,
        errorStatus: normalizedErrorStatus ?? existingAiMessage.errorStatus,
        usage: currentData.usage ?? existingAiMessage.usage,
      };

      if (
        existingAiMessage.content !== updatedAiMessage.content ||
        existingAiMessage.isComplete !== updatedAiMessage.isComplete ||
        JSON.stringify(existingAiMessage.errorStatus) !==
          JSON.stringify(updatedAiMessage.errorStatus) ||
        JSON.stringify(existingAiMessage.usage) !==
          JSON.stringify(updatedAiMessage.usage)
      ) {
        const updatedMessagesMap = new Map(mapToUse);
        updatedMessagesMap.set(targetId, updatedAiMessage);

        const isNowGenerating =
          !updatedAiMessage.isComplete && !updatedAiMessage.errorStatus;

        return {
          messages: { ...state.messages, [chatId]: updatedMessagesMap },
          isAITyping: { ...state.isAITyping, [chatId]: isNowGenerating },
          isGenerating: { ...state.isGenerating, [chatId]: isNowGenerating },
          isWaiting: { ...state.isWaiting, [chatId]: false },
        };
      }

      if (state.isWaiting[chatId]) {
        return { isWaiting: { ...state.isWaiting, [chatId]: false } };
      }
      return {};
    });

    const isStreamComplete = currentData.isComplete;
    const hasTextContent = currentData.text.trim().length > 0;
    const hasOnlyReasoning =
      hasTextContent &&
      currentData.text.trim().endsWith("</think>") &&
      currentData.text
        .substring(currentData.text.indexOf("</think>") + 8)
        .trim().length === 0;
    const isLikelyToolCall =
      isStreamComplete &&
      !currentData.errorStatus &&
      (!hasTextContent || hasOnlyReasoning);

    if (isStreamComplete || currentData.errorStatus) {
      if (currentData.errorStatus) {
        console.error(
          "[WS:Handler] Stream error for job",
          jobId,
          ":",
          currentData.errorStatus,
        );
      }

      if (!isLikelyToolCall) {
        set((state: ChatStoreState) => ({
          isAITyping: { ...state.isAITyping, [chatId]: false },
          isGenerating: { ...state.isGenerating, [chatId]: false },
          isWaiting: { ...state.isWaiting, [chatId]: false },
        }));
      }

      if (currentData.errorStatus) {
        get().setActiveChatJob(chatId, jobId, true);
      } else {
        get().clearActiveChatJob(chatId);
      }

      if (
        ws?.readyState === WebSocket.OPEN ||
        ws?.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }

      const ocrPromise = get().ocrPromises.get(jobId);
      if (ocrPromise) {
        if (currentData.errorStatus) {
          ocrPromise.reject(
            new Error(
              `OCR generation failed: ${JSON.stringify(
                currentData.errorStatus,
              )}`,
            ),
          );
        } else {
          ocrPromise.resolve(currentData.text);
        }
        get().removeOcrPromise(jobId);
      }

      setTimeout(() => get().fetchMessages(chatId), 1000);
    }
  };

  const onMessage = async (event: MessageEvent) => {
    let parsedData: StreamedResponse;
    try {
      const binaryString = window.atob(event.data);
      const encryptedBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        encryptedBytes[i] = binaryString.charCodeAt(i);
      }

      const decryptedJson = await ChatCrypto.decryptMessage(
        encryptedBytes,
        chatKey,
      );
      if (decryptedJson === "[Decryption Error]") {
        throw new Error("Failed to decrypt stream packet");
      }

      parsedData = JSON.parse(decryptedJson);

      if (
        typeof parsedData.text !== "string" ||
        typeof parsedData.isComplete !== "boolean"
      ) {
        throw new Error("Invalid message format");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      handleWebSocketError(
        set,
        get,
        chatId,
        jobId,
        `WebSocket message error: ${errMsg}`,
        false,
      );
      if (
        ws?.readyState === WebSocket.OPEN ||
        ws?.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      return;
    }

    latestMessageData = parsedData;
    if (!isUpdateScheduled) {
      isUpdateScheduled = true;
      animationFrameId = requestAnimationFrame(processBatchedUpdate);
    }
  };

  const cancel = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (latestMessageData) processBatchedUpdate();
  };

  return { onMessage, cancel };
};
