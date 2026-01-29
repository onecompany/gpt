import { StateCreator } from "zustand";
import { useFileStore } from "../../fileStore";
import type { ChatStoreState } from "..";

export interface QueueActions {
  processQueuedToolCalls: () => void;
}

export const createQueueActions: StateCreator<
  ChatStoreState,
  [],
  [],
  QueueActions
> = (set, get) => ({
  processQueuedToolCalls: () => {
    const { indexingStatus, indexingError } = useFileStore.getState();
    const {
      queuedToolCalls,
      currentChatId,
      runAndContinueFromTools,
      messages,
    } = get();

    if (queuedToolCalls.length === 0) {
      return;
    }

    const validCalls = queuedToolCalls.filter(
      (call) => call.chatId === currentChatId,
    );

    if (validCalls.length === 0) {
      return;
    }

    if (indexingStatus === "complete") {
      console.log(
        "[ChatStore Processor] Index ready, processing queued tool calls.",
      );
      set({
        queuedToolCalls: queuedToolCalls.filter(
          (c) => c.chatId !== currentChatId,
        ),
      });

      const executeSequentially = async () => {
        for (const call of validCalls) {
          try {
            await runAndContinueFromTools(call.chatId, call.assistantMessageId);
          } catch (error) {
            console.error(
              "Failed to execute queued tool call for message",
              call.assistantMessageId,
              error,
            );
          }
        }
      };
      void executeSequentially();
    } else if (indexingStatus === "error") {
      console.error(
        "[ChatStore Processor] Indexing failed. Rejecting queued tool calls.",
      );
      set({
        queuedToolCalls: queuedToolCalls.filter(
          (c) => c.chatId !== currentChatId,
        ),
      });

      validCalls.forEach((call) => {
        const assistantMessage = messages[call.chatId]?.get(
          call.assistantMessageId,
        );
        if (assistantMessage) {
          const updatedMessage = {
            ...assistantMessage,
            isComplete: true,
            errorStatus: {
              type: "Unknown" as const,
              message: `File indexing failed: ${indexingError || "Unknown error"}`,
            },
          };
          const updatedMessagesMap = new Map(messages[call.chatId]);
          updatedMessagesMap.set(call.assistantMessageId, updatedMessage);
          set((state) => ({
            messages: { ...state.messages, [call.chatId]: updatedMessagesMap },
            isProcessingTools: {
              ...state.isProcessingTools,
              [`${call.chatId}:${call.assistantMessageId}`]: false,
            },
          }));
        }
      });
    }
  },
});
