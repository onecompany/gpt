import { StateCreator } from "zustand";
import { ChatStoreState } from "../../index";
import {
  AttachmentSetterActions,
  createAttachmentSetterActions,
} from "./attachment";
import { ChatSetterActions, createChatSetterActions } from "./chat";
import { ConfigSetterActions, createConfigSetterActions } from "./config";
import { GetterActions, createGetterActions } from "./getters";
import { MessageSetterActions, createMessageSetterActions } from "./message";
import { StatusSetterActions, createStatusSetterActions } from "./status";
import { OcrPromiseActions, createOcrPromiseActions } from "./ocr";

export type SetterActions = AttachmentSetterActions &
  ChatSetterActions &
  ConfigSetterActions &
  GetterActions &
  MessageSetterActions &
  StatusSetterActions &
  OcrPromiseActions;

export const createSetterActions: StateCreator<
  ChatStoreState,
  [],
  [],
  SetterActions
> = (set, get, api) => ({
  ...createAttachmentSetterActions(set, get, api),
  ...createChatSetterActions(set, get, api),
  ...createConfigSetterActions(set, get, api),
  ...createGetterActions(set, get, api),
  ...createMessageSetterActions(set, get, api),
  ...createStatusSetterActions(set, get, api),
  ...createOcrPromiseActions(set, get, api),
});
