import { StateCreator } from "zustand";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { IndexApi } from "@/services/api/indexApi";
import type { ChatStoreState } from "../../index";

export interface NodeFetchActions {
  fetchMyNodesAuth: (force?: boolean) => Promise<void>;
  fetchAllActiveNodesAuth: (force?: boolean) => Promise<void>;
  clearNodeCache: () => void;
}

export const createNodeFetchActions: StateCreator<
  ChatStoreState,
  [],
  [],
  NodeFetchActions
> = (set, get) => ({
  fetchMyNodesAuth: async (force = false) => {
    if (!force && get().myNodesLoading) return;

    const { authStatus, authClient } = useAuthStore.getState();
    if (authStatus !== AuthStatus.REGISTERED || !authClient) return;

    if (!get().hasFetchedMyNodes || force) {
      set({ myNodesLoading: true });
    }

    try {
      const nodes = await IndexApi.listMyNodes(authClient.getIdentity());
      set({ myNodes: nodes, hasFetchedMyNodes: true });
    } catch (err) {
      console.error("Exception fetching my nodes:", err);
    } finally {
      set({ myNodesLoading: false });
    }
  },

  fetchAllActiveNodesAuth: async (force = false) => {
    if (!force && get().allNodesLoading) return;

    if (!get().hasFetchedAllNodes || force) {
      set({ allNodesLoading: true });
    }

    try {
      const nodes = await IndexApi.listActiveNodes();
      set({ allNodes: nodes, hasFetchedAllNodes: true });
    } catch (err) {
      console.error("Exception fetching active nodes:", err);
    } finally {
      set({ allNodesLoading: false });
    }
  },

  clearNodeCache: () => {
    set({
      myNodes: [],
      allNodes: [],
      hasFetchedMyNodes: false,
      hasFetchedAllNodes: false,
    });
  },
});
