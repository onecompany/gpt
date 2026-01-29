import { StateCreator } from "zustand";
import type { ChatStoreState } from "../../index";
import { JobId, ChatId } from "@/types/brands";

export interface NodeReconnectActions {
  reconnectToActiveJob: (chatId: ChatId, jobId: JobId) => Promise<void>;
}

export const createNodeReconnectActions: StateCreator<
  ChatStoreState,
  [],
  [],
  NodeReconnectActions
> = (set, get) => ({
  reconnectToActiveJob: async (chatId, jobId) => {
    const {
      webSockets,
      getChatJobDetails,
      getNodeDetails,
      connectToChainWebSocket,
      setIsGenerating,
      setIsAITyping,
      setIsWaiting,
    } = get();

    // Check if WebSocket exists for string jobId
    if (webSockets[jobId]) return;

    setIsGenerating(chatId, true);
    setIsAITyping(chatId, true);
    setIsWaiting(chatId, true);

    try {
      const jobDetails = await getChatJobDetails(chatId, jobId);
      if (!jobDetails) throw new Error("Job details not found.");

      const nodeId = jobDetails.node_id;
      const nodeDetails = await getNodeDetails(nodeId);
      if (!nodeDetails) throw new Error("Node details not found.");

      if (!nodeDetails.publicKey) {
        throw new Error(
          "Node public key missing. Cannot reconnect securely via WebSocket.",
        );
      }

      await connectToChainWebSocket(
        chatId,
        jobId,
        nodeDetails.address,
        nodeId,
        nodeDetails.publicKey,
        undefined, // Normal flow
      );
    } catch (error) {
      console.error("Failed to reconnect to job:", jobId, error);
      setIsGenerating(chatId, false);
      setIsAITyping(chatId, false);
      setIsWaiting(chatId, false);
    }
  },
});
