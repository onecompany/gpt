import { StateCreator } from "zustand";
import { IndexApi } from "@/services/api/indexApi";
import { UserApi } from "@/services/api/userApi";
import { AuthStore } from "../index";
import { AuthStatus } from "../state";
import { VaultCrypto } from "@/utils/crypto/vault";
import { classifySetupError } from "@/utils/resultUtils";
import { Principal } from "@icp-sdk/core/principal";

export interface RegistrationActions {
  resolveUserSession: () => Promise<void>;
}

export const createRegistrationActions: StateCreator<
  AuthStore,
  [],
  [],
  RegistrationActions
> = (set, get) => ({
  resolveUserSession: async () => {
    const {
      authClient,
      principal,
      handleInvalidDelegationError,
      setAuthError,
      confirmUserCanisterId,
      authStatus,
    } = get();

    if (!authClient || !principal || authStatus !== AuthStatus.PENDING_SETUP)
      return;

    console.log(
      `[AuthStore] resolveUserSession: Starting for principal ${principal}`,
    );

    try {
      const checkAndResolve = async (): Promise<void> => {
        console.log("[AuthStore] checkAndResolve: Checking user assignment");

        // 1. Check existing assignment
        const assignedCanisterId = await IndexApi.getUserAssignment(
          authClient.getIdentity(),
          principal,
        );

        if (assignedCanisterId) {
          console.log(`[AuthStore] User canister found: ${assignedCanisterId}`);

          // Check if the canister is finalized (bound to user with vault data)
          console.log(
            "[AuthStore] Checking if user canister is finalized...",
          );
          const isFinalized = await UserApi.isUserFinalized(
            authClient.getIdentity(),
            assignedCanisterId,
            Principal.fromText(principal),
          );

          if (!isFinalized) {
            console.log(
              "[AuthStore] User canister not yet finalized. Transitioning to Setup.",
            );
            set({
              authStatus: AuthStatus.SETUP_VAULT,
              userCanisterId: assignedCanisterId,
            });
            return;
          }

          console.log(
            "[AuthStore] User canister is finalized. Fetching vault data via whoami...",
          );
          const whoami = await UserApi.whoami(
            authClient.getIdentity(),
            assignedCanisterId,
          );

          const hasVault = !!whoami.enc_salt && !!whoami.enc_validator;

          if (hasVault) {
            console.log("[AuthStore] User has vault. Checking local cache.");
            const cachedKey = sessionStorage.getItem("gpt_root_key");

            if (cachedKey) {
              const validatorStr = whoami.enc_validator!;
              const isValid = await VaultCrypto.verifyKey(
                cachedKey,
                validatorStr,
              );

              if (isValid) {
                console.log("[AuthStore] Cached key verified. Auto-unlocking.");
                set({ rootKey: cachedKey });
                confirmUserCanisterId(assignedCanisterId);
              } else {
                console.warn(
                  "[AuthStore] Cached key failed verification. Clearing cache and locking.",
                );
                sessionStorage.removeItem("gpt_root_key");
                set({
                  authStatus: AuthStatus.VAULT_LOCKED,
                  userCanisterId: assignedCanisterId,
                });
              }
            } else {
              console.log("[AuthStore] No cached key. Prompting for PIN.");
              set({
                authStatus: AuthStatus.VAULT_LOCKED,
                userCanisterId: assignedCanisterId,
              });
            }
          } else {
            console.log(
              "[AuthStore] User has no vault. Transitioning to Setup.",
            );
            set({
              authStatus: AuthStatus.SETUP_VAULT,
              userCanisterId: assignedCanisterId,
            });
          }
          return;
        }

        console.log(
          "[AuthStore] resolveUserSession: User not found, attempting registration.",
        );
        const username = `user_${principal.substring(0, 8)}`;

        await IndexApi.registerUser(authClient.getIdentity(), username);
        console.log(
          "[AuthStore] resolveUserSession: Registration call successful, re-checking assignment.",
        );
        return await checkAndResolve();
      };

      await checkAndResolve();
    } catch (err: unknown) {
      console.error("[AuthStore] resolveUserSession: Caught error:", err);
      const error = err as Error;

      if (
        error.message?.includes("delegation is invalid") ||
        error.message?.includes("cryptographic verification failed")
      ) {
        handleInvalidDelegationError();
      } else {
        const { title, message, isFatal } = classifySetupError(error);
        setAuthError(message, title, isFatal);
      }
    }
  },
});
