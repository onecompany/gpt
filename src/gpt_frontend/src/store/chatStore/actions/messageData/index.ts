import { StateCreator } from "zustand";
import type { ChatStoreState } from "../../index";
import { createMessageDataActions, MessageDataActions } from "./fetch";

export type { MessageDataActions };

export const createFetchActions: StateCreator<
  ChatStoreState,
  [],
  [],
  MessageDataActions
> = (set, get, api) => ({
  ...createMessageDataActions(set, get, api),
});
