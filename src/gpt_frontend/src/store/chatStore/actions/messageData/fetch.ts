import { StateCreator } from "zustand";
import { useAuthStore } from "@/store/authStore";
import { UserApi } from "@/services/api/userApi";
import type { ChatStoreState, ActiveJobInfo } from "../../index";
import {
  ChatNotFoundError,
  mergeFetchedWithLocalMap,
  mergeJobDetailsIntoMap,
} from "./helpers";
import { Message } from "@/types";
import { ChatCrypto } from "@/utils/crypto/chat";
import { fromBigInt } from "@/utils/candidUtils";
import { ChatId, JobId, MessageId } from "@/types/brands";

export interface MessageDataActions {
  fetchMessages: (chatId: string) => Promise<void>;
}

export const createMessageDataActions: StateCreator<
  ChatStoreState,
  [],
  [],
  MessageDataActions
> = (set, get) => ({
  fetchMessages: async (chatId) => {
    const logPrefix = `[ChatStore:fetchMessages]`;
    const { authStatus, authClient, userCanisterId, rootKey } =
      useAuthStore.getState();
    if (
      authStatus !== "REGISTERED" ||
      !authClient ||
      !userCanisterId ||
      !rootKey
    ) {
      console.warn(logPrefix, "Aborting. User/Vault not ready.");
      return;
    }

    console.log(logPrefix, "Starting fetch for chat", chatId);
    set({ isLoading: true });

    try {
      const chat = await UserApi.getChat(
        authClient.getIdentity(),
        userCanisterId,
        chatId,
      );

      if (get().currentChatId === chatId) set({ chatTitle: chat.title });

      if (!chat.encryptionSalt) {
        throw new Error("Chat is missing encryption salt. Cannot decrypt.");
      }

      const chatKey = await ChatCrypto.deriveChatKey(
        rootKey,
        chat.encryptionSalt,
      );

      // Map MessageId (string) to BigInt for API call
      const messageIdsBigInt = chat.messageIds.map((id) => BigInt(id));

      const fetchedMessagesResults = await Promise.all(
        messageIdsBigInt.map((id) =>
          UserApi.getMessage(
            authClient.getIdentity(),
            userCanisterId,
            id,
          ).catch((e) => {
            console.warn(
              logPrefix,
              "Failed to fetch message",
              id.toString(),
              ":",
              e,
            );
            return null;
          }),
        ),
      );

      const decryptedMessages: Message[] = [];
      for (const encMsg of fetchedMessagesResults) {
        if (!encMsg) continue;
        try {
          let plaintext = "";

          if (encMsg.encryptedContent && encMsg.encryptedContent.length > 0) {
            plaintext = await ChatCrypto.decryptMessage(
              encMsg.encryptedContent,
              chatKey,
            );
          }

          decryptedMessages.push({
            ...encMsg,
            content: plaintext,
          });
        } catch (e) {
          console.error("Failed to decrypt message", encMsg.id, e);
          decryptedMessages.push({
            ...encMsg,
            content: "[Decryption Failed]",
            errorStatus: { type: "Unknown", message: "Decryption failed" },
          });
        }
      }

      console.log(
        logPrefix,
        "Fetched & Decrypted",
        decryptedMessages.length,
        "messages for chat",
        chatId,
      );

      const jobs = await UserApi.getChatJobs(
        authClient.getIdentity(),
        userCanisterId,
        chatId,
      );

      // Capture local state BEFORE merge to detect if job was already completed locally
      // This handles the race condition where stream completed but complete_job hasn't updated canister yet
      const localMapBeforeMerge = get().messages[chatId];
      const backendActiveJobId = chat.activeJobId;
      let wasLocallyComplete = false;
      if (localMapBeforeMerge && backendActiveJobId !== null) {
        for (const msg of localMapBeforeMerge.values()) {
          if (
            msg.role === "assistant" &&
            msg.jobId === backendActiveJobId &&
            msg.isComplete
          ) {
            wasLocallyComplete = true;
            break;
          }
        }
      }

      const mergedMap = mergeFetchedWithLocalMap(
        decryptedMessages,
        localMapBeforeMerge,
      );
      const finalMessagesMap = mergeJobDetailsIntoMap(mergedMap, jobs);
      let isJobActuallyRunning = false;

      if (backendActiveJobId !== null && !wasLocallyComplete) {
        const activeJobDetails = jobs.find(
          (job) => job.job_id === backendActiveJobId,
        );
        if (activeJobDetails) {
          const placeholderMessage = finalMessagesMap.get(
            activeJobDetails.placeholder_message_id,
          );
          if (placeholderMessage?.role === "assistant") {
            isJobActuallyRunning =
              !placeholderMessage.isComplete && !placeholderMessage.errorStatus;
          }
        }
      }

      set((state) => ({
        messages: { ...state.messages, [chatId]: finalMessagesMap },
        isLoading: false,
        isGenerating: {
          ...state.isGenerating,
          [chatId]: isJobActuallyRunning,
        },
        isAITyping: { ...state.isAITyping, [chatId]: isJobActuallyRunning },
        isWaiting: {
          ...state.isWaiting,
          [chatId]: isJobActuallyRunning && !state.isAITyping[chatId],
        },
      }));

      // Only re-set active job if:
      // 1. Job appears to be running based on merged state, AND
      // 2. Backend has an active job ID, AND
      // 3. The job was NOT already complete in local state before merge
      // The wasLocallyComplete check prevents re-setting a job that completed locally
      // but the canister hasn't been updated yet (complete_job race condition)
      if (isJobActuallyRunning && backendActiveJobId !== null && !wasLocallyComplete) {
        const currentActiveJobForChat: ActiveJobInfo | undefined =
          get().activeChatJobs[chatId];
        const wasPreviouslyErroredViaStream =
          currentActiveJobForChat?.jobId === backendActiveJobId &&
          currentActiveJobForChat.erroredViaStream;
        get().setActiveChatJob(
          chatId as ChatId,
          backendActiveJobId as JobId,
          !!wasPreviouslyErroredViaStream,
        );
      } else {
        get().clearActiveChatJob(chatId as ChatId);
      }

      const currentActiveLeafId = get().activeLeafMessageId[chatId];
      if (
        currentActiveLeafId === null ||
        currentActiveLeafId === undefined ||
        !finalMessagesMap.has(currentActiveLeafId)
      ) {
        let latestTime = 0;
        let newLeafId: MessageId | null = null;
        for (const msg of finalMessagesMap.values()) {
          const msgTime = new Date(msg.createdAt).getTime();
          if (msgTime >= latestTime) {
            latestTime = msgTime;
            newLeafId = (msg.backendId ?? msg.id) as MessageId;
          }
        }
        if (newLeafId !== null) {
          get().setActiveLeaf(chatId as ChatId, newLeafId);
        }
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (
        errMsg.includes("Chat not found") ||
        error instanceof ChatNotFoundError
      ) {
        console.warn(logPrefix, "Chat", chatId, "not found.");
      } else {
        console.error(logPrefix, "Error for chat", chatId, ":", error);
      }
      set({
        isLoading: false,
        isAITyping: { ...get().isAITyping, [chatId]: false },
        isGenerating: { ...get().isGenerating, [chatId]: false },
        isWaiting: { ...get().isWaiting, [chatId]: false },
      });
      get().clearActiveChatJob(chatId as ChatId);
    }
  },
});
