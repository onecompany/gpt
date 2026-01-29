import { StateCreator } from "zustand";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { UserApi } from "@/services/api/userApi";
import { Chat } from "@/types";
import type { ChatStoreState } from "../../index";
import { ChatId } from "@/types/brands";

export interface ChatDeleteAction {
  deleteChat: (chatId: string) => Promise<void>;
}

export const createChatDeleteAction: StateCreator<
  ChatStoreState,
  [],
  [],
  ChatDeleteAction
> = (set, get) => ({
  deleteChat: async (chatId) => {
    const { authStatus, authClient, userCanisterId } = useAuthStore.getState();
    if (
      authStatus !== AuthStatus.REGISTERED ||
      !authClient ||
      !userCanisterId
    ) {
      console.warn("deleteChat: Aborting. User not fully registered.");
      return;
    }

    try {
      // API expects string ID (handling conversion internally)
      await UserApi.deleteChat(
        authClient.getIdentity(),
        userCanisterId,
        chatId,
      );

      set((state) => {
        const newMessages = { ...state.messages };
        const newIsGenerating = { ...state.isGenerating };
        const newIsWaiting = { ...state.isWaiting };
        const newIsAITyping = { ...state.isAITyping };
        const newActiveChatJobs = { ...state.activeChatJobs };
        const newActiveLeafMessageId = { ...state.activeLeafMessageId };

        delete newMessages[chatId];
        delete newIsGenerating[chatId];
        delete newIsWaiting[chatId];
        delete newIsAITyping[chatId];
        delete newActiveChatJobs[chatId];
        delete newActiveLeafMessageId[chatId];

        return {
          chats: state.chats.filter(
            (chat: Chat) => chat.chatId !== (chatId as ChatId),
          ),
          messages: newMessages,
          isGenerating: newIsGenerating,
          isWaiting: newIsWaiting,
          isAITyping: newIsAITyping,
          activeChatJobs: newActiveChatJobs,
          activeLeafMessageId: newActiveLeafMessageId,
        };
      });

      await get().fetchChats();
    } catch (error) {
      console.error("Error deleting chat:", error);
      throw error;
    }
  },
});
