import { StateCreator } from "zustand";
import type { ChatStoreState } from "../../index";
import { createCreateChatAction, CreateChatAction } from "./create";
import { createChatUpdateActions, ChatUpdateActions } from "./update";
import { createChatDeleteAction, ChatDeleteAction } from "./delete";
import { createFetchChatsAction, FetchChatsAction } from "./fetch";

export type ChatActions = CreateChatAction &
  ChatUpdateActions &
  ChatDeleteAction &
  FetchChatsAction;

export const createChatActions: StateCreator<
  ChatStoreState,
  [],
  [],
  ChatActions
> = (set, get, api) => ({
  ...createCreateChatAction(set, get, api),
  ...createChatUpdateActions(set, get, api),
  ...createChatDeleteAction(set, get, api),
  ...createFetchChatsAction(set, get, api),
});
