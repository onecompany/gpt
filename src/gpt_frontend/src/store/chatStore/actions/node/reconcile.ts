import { StateCreator } from "zustand";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { IndexApi } from "@/services/api/indexApi";
import { UserApi } from "@/services/api/userApi";
import type { ReconciledNode, ChatStoreState } from "../../index";
import { toNodeId } from "@/types/brands";

export interface NodeReconcileActions {
  fetchAndReconcileNodes: () => Promise<void>;
}

export const createNodeReconcileActions: StateCreator<
  ChatStoreState,
  [],
  [],
  NodeReconcileActions
> = (set, get) => ({
  fetchAndReconcileNodes: async () => {
    const alreadyHasNodes = get().reconciledActiveNodes.length > 0;

    if (!alreadyHasNodes) {
      set({ reconciledNodesLoading: true });
    }

    const { authStatus, authClient, userCanisterId } = useAuthStore.getState();
    if (
      authStatus !== AuthStatus.REGISTERED ||
      !authClient ||
      !userCanisterId
    ) {
      set({ reconciledActiveNodes: [], reconciledNodesLoading: false });
      return;
    }

    try {
      const indexNodes = await IndexApi.listActiveNodes();
      set({ allNodes: indexNodes, hasFetchedAllNodes: true });

      const userNodes = await UserApi.getNodes(
        authClient.getIdentity(),
        userCanisterId,
      );

      // Create lookup map using stringified IDs
      const userNodeMap = new Map(
        userNodes.map((node) => [
          node.nodeId, // Key matches Index list's string ID
          node,
        ]),
      );
      const reconciledNodes: ReconciledNode[] = [];

      for (const indexNode of indexNodes) {
        if (!indexNode.isActive || !indexNode.nodePrincipal) continue;

        const indexPrincipal = indexNode.nodePrincipal.toText();

        const userNode = userNodeMap.get(indexNode.nodeId);

        if (userNode) {
          const userPrincipalOpt = userNode.nodePrincipal
            ? userNode.nodePrincipal.toText()
            : null;

          if (userPrincipalOpt === indexPrincipal) {
            reconciledNodes.push({
              nodeId: toNodeId(indexNode.nodeId),
              address: userNode.hostname,
              modelId: indexNode.modelId,
              principal: indexPrincipal,
              publicKey: indexNode.publicKey ?? undefined,
            });
          }
        }
      }
      set({
        reconciledActiveNodes: reconciledNodes,
        reconciledNodesLoading: false,
      });
    } catch (error) {
      console.error("fetchAndReconcileNodes: Exception occurred:", error);
      set({ reconciledNodesLoading: false });
    }
  },
});
