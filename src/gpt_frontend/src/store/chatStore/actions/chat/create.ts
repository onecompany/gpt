import { StateCreator } from "zustand";
import type { ChatStoreState } from "../../index";

export interface CreateChatAction {
  createNewChat: () => Promise<void>;
}

export const createCreateChatAction: StateCreator<
  ChatStoreState,
  [],
  [],
  CreateChatAction
> = (set) => ({
  createNewChat: async () => {
    set((state) => ({
      chatTitle: "",
      input: "",
      isGenerating: { ...state.isGenerating, new: false },
      isWaiting: { ...state.isWaiting, new: false },
      isAITyping: { ...state.isAITyping, new: false },
      currentChatId: null,
    }));
  },
});
