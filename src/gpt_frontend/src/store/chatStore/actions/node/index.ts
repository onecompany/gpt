import { StateCreator } from "zustand";
import type { ChatStoreState } from "../../index";
import { createNodeDetailActions, NodeDetailActions } from "./details";
import { createNodeFetchActions, NodeFetchActions } from "./fetch";
import { createNodePickActions, NodePickActions } from "./pick";
import { createNodeReconnectActions, NodeReconnectActions } from "./reconnect";
import { createNodeReconcileActions, NodeReconcileActions } from "./reconcile";
import { createCreateNodeAction, CreateNodeAction } from "./create";

export type NodeActions = NodeDetailActions &
  NodeFetchActions &
  NodePickActions &
  NodeReconnectActions &
  NodeReconcileActions &
  CreateNodeAction;

export const createNodeActions: StateCreator<
  ChatStoreState,
  [],
  [],
  NodeActions
> = (set, get, api) => ({
  ...createNodeDetailActions(set, get, api),
  ...createNodeFetchActions(set, get, api),
  ...createNodePickActions(set, get, api),
  ...createNodeReconnectActions(set, get, api),
  ...createNodeReconcileActions(set, get, api),
  ...createCreateNodeAction(set, get, api),
});
