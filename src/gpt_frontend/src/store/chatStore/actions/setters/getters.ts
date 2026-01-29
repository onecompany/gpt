import { StateCreator } from "zustand";
import { ChatStoreState } from "../../index";

export interface GetterActions {
  hasMessagesLoaded: (chatId: string) => boolean;
}

export const createGetterActions: StateCreator<
  ChatStoreState,
  [],
  [],
  GetterActions
> = (set, get) => ({
  hasMessagesLoaded: (chatId) => {
    const messagesMap = get().messages[chatId];
    return messagesMap instanceof Map && messagesMap.size > 0;
  },
});
