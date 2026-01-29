import { StateCreator } from "zustand";
import type { ChatStoreState } from "../../index";
import { NodeId } from "@/types/brands";

export interface NodePickActions {
  pickNodeForModel: (modelId: string) => Promise<{
    address: string;
    nodeId: NodeId;
    publicKey: string | undefined;
  } | null>;
}

export const createNodePickActions: StateCreator<
  ChatStoreState,
  [],
  [],
  NodePickActions
> = (set, get) => ({
  pickNodeForModel: async (modelId) => {
    const { reconciledActiveNodes, temporaryNodeBlacklist } = get();
    if (!reconciledActiveNodes || reconciledActiveNodes.length === 0)
      return null;

    const now = Date.now();

    const suitable = reconciledActiveNodes.filter((node) => {
      if (node.modelId !== modelId) return false;

      const expiry = temporaryNodeBlacklist.get(node.nodeId);
      if (expiry && now < expiry) {
        console.log(
          `[NodePicker] Skipping blacklisted node ${node.nodeId} (Expires in ${Math.ceil(
            (expiry - now) / 1000,
          )}s)`,
        );
        return false;
      }
      return true;
    });

    if (suitable.length === 0) {
      console.warn(
        `[NodePicker] No suitable nodes found for model ${modelId} (Active: ${reconciledActiveNodes.length}, Blacklisted excluded).`,
      );
      return null;
    }

    const chosen = suitable[Math.floor(Math.random() * suitable.length)];
    return {
      address: chosen.address,
      nodeId: chosen.nodeId,
      publicKey: chosen.publicKey,
    };
  },
});
