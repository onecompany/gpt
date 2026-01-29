import { StateCreator } from "zustand";
import type { ChatStoreState } from "../../index";
import { createEditActions, EditMessageActions } from "./edit";
import { createRetryActions, RetryMessageActions } from "./retry";
import { createAddMessageActions, AddMessageActions } from "./addAndSend";
import {
  createCreateAndSendActions,
  CreateAndSendActions,
} from "./createAndSend";
import { createToolContinuationActions, ToolContinuationActions } from "./tool";

export interface SendMessageAction {
  sendMessage: () => Promise<string | null>;
}

export type MessageActions = SendMessageAction &
  EditMessageActions &
  RetryMessageActions &
  AddMessageActions &
  CreateAndSendActions &
  ToolContinuationActions;

const createDispatcherActions: StateCreator<
  ChatStoreState,
  [],
  [],
  SendMessageAction
> = (_set, get) => ({
  sendMessage: async () => {
    const { currentChatId, isGenerating } = get();
    const chatKey = currentChatId ?? "new";

    if (isGenerating[chatKey]) {
      console.warn("sendMessage: Generation already in progress. Aborting.");
      return null;
    }

    get().setIsGenerating(chatKey, true);
    get().setIsWaiting(chatKey, true);
    get().setIsAITyping(chatKey, true);

    if (currentChatId === null) {
      return get().createNewChatWithFirstMessage();
    } else {
      return get().addMessageToExistingChat();
    }
  },
});

export const createMessageActions: StateCreator<
  ChatStoreState,
  [],
  [],
  MessageActions
> = (set, get, api) => ({
  ...createDispatcherActions(set, get, api),
  ...createEditActions(set, get, api),
  ...createRetryActions(set, get, api),
  ...createAddMessageActions(set, get, api),
  ...createCreateAndSendActions(set, get, api),
  ...createToolContinuationActions(set, get, api),
});
