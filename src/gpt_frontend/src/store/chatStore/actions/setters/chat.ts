import { StateCreator } from "zustand";
import { ChatStoreState } from "../../index";
import { ChatId } from "@/types/brands";
import { initialState } from "../../state";

export interface ChatSetterActions {
  setChatTitle: (title: string) => void;
  setCurrentChatId: (chatId: ChatId | null) => void;
  resetChat: () => void;
  setIsNextChatTemporary: (isTemporary: boolean) => void;
  setInitialAnimationComplete: (isComplete: boolean) => void;
}

export const createChatSetterActions: StateCreator<
  ChatStoreState,
  [],
  [],
  ChatSetterActions
> = (set, get) => ({
  setChatTitle: (title) => set({ chatTitle: title }),
  setCurrentChatId: (chatId) => {
    const state = get();
    if (state.attachmentCleanupTimer)
      clearTimeout(state.attachmentCleanupTimer);
    if (state.attachments.length > 0) state.scheduleAttachmentCleanup();
    set({
      currentChatId: chatId,
      chatTitle: chatId
        ? state.chats.find((c) => c.chatId === chatId)?.title || ""
        : "",
      chatVersion: state.chatVersion + 1,
    });
  },
  resetChat: () => {
    // Close all active websockets
    Object.values(get().webSockets).forEach(
      (ws) => ws?.readyState === WebSocket.OPEN && ws.close(),
    );
    get().cancelAttachmentCleanup();
    get().clearAttachments();

    // Reset ALL state to initial values
    set(initialState);
  },
  setIsNextChatTemporary: (isTemporary) =>
    set({ isNextChatTemporary: isTemporary }),
  setInitialAnimationComplete: (isComplete) =>
    set({ isInitialAnimationComplete: isComplete }),
});
