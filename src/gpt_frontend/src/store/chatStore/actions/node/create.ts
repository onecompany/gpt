import { StateCreator } from "zustand";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { IndexApi } from "@/services/api/indexApi";
import { ChatStoreState } from "../../index";
import * as age from "age-encryption";

export interface CreateNodeAction {
  createNode: (
    hostname: string,
    modelId: string,
    apiKey: string,
    chipId: string,
    hostIdentity: string,
  ) => Promise<void>;
}

export const createCreateNodeAction: StateCreator<
  ChatStoreState,
  [],
  [],
  CreateNodeAction
> = (set, get) => ({
  createNode: async (hostname, modelId, apiKey, chipId, hostIdentity) => {
    const { authClient, authStatus } = useAuthStore.getState();
    const { fetchMyNodesAuth, fetchAllActiveNodesAuth, clearNodeCache } = get();

    if (authStatus !== AuthStatus.REGISTERED || !authClient) {
      throw new Error("User must be registered to create a node.");
    }

    const trimmedHostname = hostname.trim();
    const trimmedChipId = chipId.trim().toLowerCase();
    const trimmedIdentity = hostIdentity.trim();

    if (!trimmedHostname || !modelId || !apiKey.trim() || !trimmedChipId) {
      throw new Error("Missing required fields.");
    }

    if (!trimmedIdentity.startsWith("age1")) {
      throw new Error("Invalid Host Identity.");
    }

    let encryptedApiKeyB64: string;
    try {
      const e = new age.Encrypter();
      e.addRecipient(trimmedIdentity);
      const ciphertextUint8 = await e.encrypt(apiKey.trim());
      encryptedApiKeyB64 = btoa(
        String.fromCharCode.apply(null, Array.from(ciphertextUint8)),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Encryption failed: ${msg}`);
    }

    try {
      await IndexApi.createNode(authClient.getIdentity(), {
        hostname: trimmedHostname,
        modelId,
        encryptedApiKey: encryptedApiKeyB64,
        expectedChipId: trimmedChipId,
      });

      clearNodeCache();
      await Promise.all([
        fetchMyNodesAuth(true),
        fetchAllActiveNodesAuth(true),
      ]);
    } catch (e: unknown) {
      throw e;
    }
  },
});
