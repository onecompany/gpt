import { StateCreator } from "zustand";
import { Message } from "../../../../types";
import { ChatStoreState } from "../../index";
import { ChatId, MessageId } from "@/types/brands";

export interface MessageSetterActions {
  setInput: (input: string) => void;
  setMessages: (chatId: ChatId, messages: Map<MessageId, Message>) => void;
  setActiveLeaf: (chatId: ChatId, leafMessageId: MessageId) => void;
}

export const createMessageSetterActions: StateCreator<
  ChatStoreState,
  [],
  [],
  MessageSetterActions
> = (set) => ({
  setInput: (input) => set({ input }),
  setMessages: (chatId, messagesMap) =>
    set((state) => ({
      messages: { ...state.messages, [chatId]: messagesMap },
    })),
  setActiveLeaf: (chatId, leafMessageId) =>
    set((state) => ({
      activeLeafMessageId: {
        ...state.activeLeafMessageId,
        [chatId]: leafMessageId,
      },
    })),
});
