import { StateCreator } from "zustand";
import { AuthStore } from "../index";
import { AuthStatus } from "../state";
import { VaultCrypto } from "@/utils/crypto/vault";
import { UserApi } from "@/services/api/userApi";

export interface VaultActions {
  setupVault: (pin: string) => Promise<void>;
  unlockVault: (pin: string) => Promise<void>;
  clearVault: () => void;
}

export const createVaultActions: StateCreator<
  AuthStore,
  [],
  [],
  VaultActions
> = (set, get) => ({
  setupVault: async (pin) => {
    const { authClient, userCanisterId } = get();
    if (!authClient || !userCanisterId) return;

    try {
      // Generate 16 random bytes for salt
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const rootKey = await VaultCrypto.deriveRootKey(pin, salt);
      const encValidator = await VaultCrypto.encryptValidator(rootKey);

      // Call Finalize Registration with Vault Data via UserApi
      // NOTE: salt is passed as Uint8Array; UserApi handles the map to number[] if needed
      await UserApi.finalizeRegistration(
        authClient.getIdentity(),
        userCanisterId,
        salt,
        encValidator,
      );

      set({ rootKey, authStatus: AuthStatus.REGISTERED });
      // Cache rootKey in sessionStorage for refresh persistence
      sessionStorage.setItem("gpt_root_key", rootKey);
    } catch (error: unknown) {
      console.error("Vault setup failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to setup vault. Please try again.";
      set({
        setupError: message,
      });
    }
  },

  unlockVault: async (pin) => {
    const { authClient, userCanisterId } = get();
    if (!authClient || !userCanisterId) return;

    try {
      const whoami = await UserApi.whoami(
        authClient.getIdentity(),
        userCanisterId,
      );

      if (!whoami.enc_salt || !whoami.enc_validator) {
        throw new Error("Vault corrupted: missing salt or validator.");
      }

      const rootKey = await VaultCrypto.verifyPin(
        pin,
        whoami.enc_salt,
        whoami.enc_validator,
      );

      if (rootKey) {
        set({ rootKey, authStatus: AuthStatus.REGISTERED });
        sessionStorage.setItem("gpt_root_key", rootKey);
      } else {
        throw new Error("Incorrect PIN");
      }
    } catch (error: unknown) {
      console.error("Vault unlock failed:", error);
      throw error;
    }
  },

  clearVault: () => {
    set({ rootKey: null });
    sessionStorage.removeItem("gpt_root_key");
  },
});
