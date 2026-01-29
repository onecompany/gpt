import { StateCreator } from "zustand";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { UserApi } from "@/services/api/userApi";
import type { Job } from "@/types";
import type { ChatStoreState } from "../../index";
import { NodeId, JobId } from "@/types/brands";

export interface NodeDetailActions {
  getNodeDetails: (
    nodeId: NodeId,
  ) => Promise<{ address: string; nodeId: NodeId; publicKey: string } | null>;
  getChatJobDetails: (chatId: string, jobId: JobId) => Promise<Job | null>;
}

export const createNodeDetailActions: StateCreator<
  ChatStoreState,
  [],
  [],
  NodeDetailActions
> = () => ({
  getNodeDetails: async (nodeId) => {
    const { authStatus, authClient, userCanisterId } = useAuthStore.getState();
    if (authStatus !== AuthStatus.REGISTERED || !authClient || !userCanisterId)
      return null;

    try {
      const nodes = await UserApi.getNodes(
        authClient.getIdentity(),
        userCanisterId,
      );

      const foundNode = nodes.find((node) => node.nodeId === nodeId);

      if (
        foundNode &&
        foundNode.nodePrincipal &&
        foundNode.publicKey &&
        foundNode.publicKey.length > 0
      ) {
        return {
          address: foundNode.hostname,
          nodeId: foundNode.nodeId,
          publicKey: foundNode.publicKey,
        };
      }
      return null;
    } catch (err) {
      console.error("getNodeDetails error fetching node", nodeId, ":", err);
      return null;
    }
  },

  getChatJobDetails: async (chatId, jobId) => {
    const { authStatus, authClient, userCanisterId } = useAuthStore.getState();
    if (authStatus !== AuthStatus.REGISTERED || !authClient || !userCanisterId)
      return null;

    try {
      const jobs = await UserApi.getChatJobs(
        authClient.getIdentity(),
        userCanisterId,
        chatId,
      );

      return jobs.find((job) => job.job_id === jobId) || null;
    } catch (err) {
      console.error(
        "getChatJobDetails: Exception fetching jobs for chat",
        chatId,
        ":",
        err,
      );
      return null;
    }
  },
});
