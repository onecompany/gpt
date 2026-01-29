import { StateCreator } from "zustand";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { UserApi } from "@/services/api/userApi";
import type { ChatStoreState } from "../../index";
import { ChatId } from "@/types/brands";

export interface ChatUpdateActions {
  renameChat: (chatId: string, newTitle: string) => Promise<void>;
  archiveChat: (chatId: string) => Promise<void>;
  unarchiveChat: (chatId: string) => Promise<void>;
}

export const createChatUpdateActions: StateCreator<
  ChatStoreState,
  [],
  [],
  ChatUpdateActions
> = (set, get) => ({
  renameChat: async (chatId, newTitle) => {
    const { authStatus, authClient, userCanisterId } = useAuthStore.getState();
    if (
      authStatus !== AuthStatus.REGISTERED ||
      !authClient ||
      !userCanisterId
    ) {
      console.warn("renameChat: Aborting. User not fully registered.");
      return;
    }

    try {
      await UserApi.renameChat(
        authClient.getIdentity(),
        userCanisterId,
        chatId,
        newTitle,
      );

      set((state) => {
        const updatedState: Partial<ChatStoreState> = {
          chats: state.chats.map((chat) =>
            chat.chatId === (chatId as ChatId)
              ? {
                  ...chat,
                  title: newTitle,
                  updatedAt: new Date().toISOString(),
                }
              : chat,
          ),
        };
        if (state.currentChatId === chatId) {
          updatedState.chatTitle = newTitle;
        }
        return updatedState;
      });

      await get().fetchChats();
    } catch (error) {
      console.error("Error renaming chat:", error);
      throw error;
    }
  },

  archiveChat: async (chatId: string) => {
    const { authStatus, authClient, userCanisterId } = useAuthStore.getState();
    if (
      authStatus !== AuthStatus.REGISTERED ||
      !authClient ||
      !userCanisterId
    ) {
      console.warn(
        "archiveChat: Not fully registered or missing user canister ID.",
      );
      return;
    }
    const chatToArchive = get().chats.find((c) => c.chatId === chatId);
    if (chatToArchive?.temporary) {
      console.warn("Attempted to archive a temporary chat. Action blocked.");
      return;
    }

    try {
      await UserApi.archiveChat(
        authClient.getIdentity(),
        userCanisterId,
        chatId,
      );
      set((state) => ({
        chats: state.chats.map((chat) =>
          chat.chatId === (chatId as ChatId)
            ? { ...chat, archived: true }
            : chat,
        ),
      }));
      await get().fetchChats();
    } catch (error) {
      console.error("Error archiving chat:", error);
      throw error;
    }
  },

  unarchiveChat: async (chatId: string) => {
    const { authStatus, authClient, userCanisterId } = useAuthStore.getState();
    if (
      authStatus !== AuthStatus.REGISTERED ||
      !authClient ||
      !userCanisterId
    ) {
      console.warn(
        "unarchiveChat: Not fully registered or missing user canister ID.",
      );
      return;
    }
    try {
      await UserApi.unarchiveChat(
        authClient.getIdentity(),
        userCanisterId,
        chatId,
      );
      set((state) => ({
        chats: state.chats.map((chat) =>
          chat.chatId === (chatId as ChatId)
            ? { ...chat, archived: false }
            : chat,
        ),
      }));
      await get().fetchChats();
    } catch (error) {
      console.error("Error unarchiving chat:", error);
      throw error;
    }
  },
});
