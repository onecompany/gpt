import { StateCreator } from "zustand";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { UserApi } from "@/services/api/userApi";
import type { ChatStoreState } from "../../index";
import { ChatId } from "@/types/brands";

export interface FetchChatsAction {
  fetchChats: () => Promise<void>;
}

export const createFetchChatsAction: StateCreator<
  ChatStoreState,
  [],
  [],
  FetchChatsAction
> = (set) => ({
  fetchChats: async () => {
    const { authStatus, authClient, userCanisterId } = useAuthStore.getState();
    if (
      authStatus !== AuthStatus.REGISTERED ||
      !authClient ||
      !userCanisterId
    ) {
      console.warn(
        "fetchChats: User not fully registered or authClient missing.",
      );
      return;
    }

    try {
      const chats = await UserApi.listChats(
        authClient.getIdentity(),
        userCanisterId,
        true, // includeArchived
      );

      const generationFlagsUpdate = chats.reduce(
        (acc, chat) => {
          // If no active job ID, ensure flags are cleared
          if (!chat.activeJobId) {
            acc[chat.chatId] = false;
          }
          return acc;
        },
        {} as { [chatId: string]: boolean },
      );

      set((state) => ({
        chats,
        hasFetchedChats: true,
        isGenerating: { ...state.isGenerating, ...generationFlagsUpdate },
        isAITyping: { ...state.isAITyping, ...generationFlagsUpdate },
        isWaiting: { ...state.isWaiting, ...generationFlagsUpdate },
      }));
    } catch (error) {
      console.error("Error fetching chats:", error);
      set({ hasFetchedChats: true });
    }
  },
});
