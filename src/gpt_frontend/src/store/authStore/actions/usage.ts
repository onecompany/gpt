import { StateCreator } from "zustand";
import { UserApi } from "@/services/api/userApi";
import { AuthStore } from "../index";
import { AuthStatus } from "../state";

export interface UsageActions {
  setUserStorageUsage: (bytes: number, limit: number) => void;
  fetchUserUsage: () => Promise<void>;
}

export const createUsageActions: StateCreator<
  AuthStore,
  [],
  [],
  UsageActions
> = (set, get) => ({
  setUserStorageUsage: (bytes, limit) => {
    set({ userStorageUsage: bytes, userStorageLimit: limit });
  },

  fetchUserUsage: async () => {
    if (get().isSessionExpired) return;

    const { authStatus, authClient, userCanisterId } = get();
    if (
      authStatus !== AuthStatus.REGISTERED ||
      !authClient ||
      !userCanisterId
    ) {
      return;
    }

    try {
      const { usageBytes, limitBytes } = await UserApi.getUserStorageUsage(
        authClient.getIdentity(),
        userCanisterId,
      );
      set({ userStorageUsage: usageBytes, userStorageLimit: limitBytes });
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : JSON.stringify(err);
      if (
        errStr.includes("delegation is invalid") ||
        errStr.includes("verification failed")
      ) {
        get().handleInvalidDelegationError();
      } else {
        console.error("Failed to fetch user storage usage:", err);
      }
    }
  },
});
