import type { ChatStoreState } from "../../index";
import type { Message } from "../../../../types";
import { findTargetMessageDetails } from "./find";
import { ChatId, JobId, MessageId, NodeId } from "@/types/brands";

// 10 Minutes in milliseconds
const BLACKLIST_DURATION_MS = 10 * 60 * 1000;

export const handleWebSocketError = (
  set: (fn: (state: ChatStoreState) => Partial<ChatStoreState>) => void,
  get: () => ChatStoreState,
  chatId: ChatId,
  jobId: JobId,
  specificErrorMessage: string,
  isConnectionLevelError: boolean = true,
  failedNodeId?: NodeId,
) => {
  const ocrPromise = get().ocrPromises.get(jobId);
  if (ocrPromise) {
    console.log(
      "[WS:Error] Rejecting OCR promise for job",
      jobId,
      "due to WebSocket error.",
    );
    ocrPromise.reject(new Error(specificErrorMessage));
    get().removeOcrPromise(jobId);
  }

  console.error(
    "[WS:Error] Handling error for chat",
    chatId,
    ", job",
    jobId,
    ":",
    specificErrorMessage,
  );
  get().setActiveChatJob(chatId, jobId, true);

  set((state) => {
    // 1. Update Blacklist if nodeId is provided
    let newBlacklist = state.temporaryNodeBlacklist;
    if (failedNodeId !== undefined && isConnectionLevelError) {
      const expiry = Date.now() + BLACKLIST_DURATION_MS;
      newBlacklist = new Map(state.temporaryNodeBlacklist);
      newBlacklist.set(failedNodeId, expiry);
      console.log(
        `[WS:Error] Blacklisting node ${failedNodeId} until ${new Date(
          expiry,
        ).toLocaleTimeString()}`,
      );
    }

    // 2. Update Message Error Status
    const { targetId, message: targetMessage } = findTargetMessageDetails(
      get,
      chatId,
      jobId,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let messagesUpdate: any = {};

    if (targetId !== null && targetMessage) {
      const currentMessagesMap = state.messages[chatId];
      if (currentMessagesMap instanceof Map) {
        const updatedMessagesMap = new Map(currentMessagesMap);
        const updatedErroredMessage: Message = {
          ...targetMessage,
          errorStatus: targetMessage.errorStatus ?? {
            type: isConnectionLevelError ? "NodeOffline" : "Unknown",
            message: specificErrorMessage,
          },
          isComplete: true,
          updatedAt: new Date().toISOString(),
        };
        updatedMessagesMap.set(targetId, updatedErroredMessage);
        console.log(
          "[WS:Error] Updated message",
          targetId,
          "with error status.",
          updatedErroredMessage.errorStatus,
        );
        messagesUpdate = {
          messages: { ...state.messages, [chatId]: updatedMessagesMap },
        };
      }
    } else {
      console.warn(
        "[WS:Error] No target message found for job",
        jobId,
        ". Updating loading states only.",
      );
    }

    return {
      temporaryNodeBlacklist: newBlacklist,
      ...messagesUpdate,
      isAITyping: { ...state.isAITyping, [chatId]: false },
      isGenerating: { ...state.isGenerating, [chatId]: false },
      isWaiting: { ...state.isWaiting, [chatId]: false },
    };
  });

  console.log(
    "[WS:Error] Scheduling fetchMessages for chat",
    chatId,
    "to re-sync state.",
  );
  setTimeout(() => get().fetchMessages(chatId), 500);
};
