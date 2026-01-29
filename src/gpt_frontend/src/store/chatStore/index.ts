import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { initialState, ChatState } from "./state";
import { createChatActions, ChatActions } from "./actions/chat";
import { createFetchActions, MessageDataActions } from "./actions/messageData";
import { createMessageActions, MessageActions } from "./actions/message/index";
import { createNodeActions, NodeActions } from "./actions/node";
import {
  createTitleGenerationActions,
  TitleGenerationActions,
} from "./actions/titleGeneration";
import {
  createWebSocketActions,
  WebSocketActions,
} from "./actions/webSocket/connection";
import { createSetterActions, SetterActions } from "./actions/setters";
import { createOcrActions, OcrActions } from "./actions/ocr";
import { createQueueActions, QueueActions } from "./actions/queue";

export type { ReconciledNode, ActiveJobInfo } from "./state";

export type AllChatActions = ChatActions &
  MessageDataActions &
  MessageActions &
  NodeActions &
  TitleGenerationActions &
  WebSocketActions &
  SetterActions &
  OcrActions &
  QueueActions;

export type ChatStoreState = ChatState & AllChatActions;

export const useChatStore = create<ChatStoreState>()(
  subscribeWithSelector((set, get, api) => ({
    ...initialState,
    ...createChatActions(set, get, api),
    ...createFetchActions(set, get, api),
    ...createMessageActions(set, get, api),
    ...createNodeActions(set, get, api),
    ...createTitleGenerationActions(set, get, api),
    ...createWebSocketActions(set, get, api),
    ...createSetterActions(set, get, api),
    ...createOcrActions(set, get, api),
    ...createQueueActions(set, get, api),
  })),
);
