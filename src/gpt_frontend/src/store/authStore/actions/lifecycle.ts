import { StateCreator } from "zustand";
import { AuthClient } from "@icp-sdk/auth/client";
import {
  AgentError,
  CertifiedRejectErrorCode,
  ErrorKindEnum,
} from "@icp-sdk/core/agent";
import { AuthStore } from "../index";
import { AuthStatus } from "../state";
import { IndexApi } from "@/services/api/indexApi";

export interface LifecycleActions {
  initAuth: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const createLifecycleActions: StateCreator<
  AuthStore,
  [],
  [],
  LifecycleActions
> = (set, get) => ({
  initAuth: async () => {
    console.log(
      "[AuthStore] initAuth: Starting authentication initialization.",
    );
    set({
      authStatus: AuthStatus.INITIALIZING,
      setupError: null,
      isSessionExpired: false,
    });

    try {
      const authClient = await AuthClient.create({
        idleOptions: { disableIdle: true },
      });
      console.log("[AuthStore] initAuth: AuthClient created.");

      const isAuthenticatedWithII = await authClient.isAuthenticated();
      console.log(
        `[AuthStore] initAuth: User authenticated with II: ${isAuthenticatedWithII}`,
      );

      if (isAuthenticatedWithII) {
        try {
          console.log(
            "[AuthStore] initAuth: Proactively validating session delegation...",
          );
          // Call API directly to check delegation validity
          await IndexApi.getUserAssignment(
            authClient.getIdentity(),
            authClient.getIdentity().getPrincipal().toText(),
          );
          console.log(
            "[AuthStore] initAuth: Session delegation appears valid.",
          );
        } catch (e: unknown) {
          if (
            e instanceof AgentError &&
            e.cause?.code instanceof CertifiedRejectErrorCode &&
            e.cause?.kind === ErrorKindEnum.Trust
          ) {
            console.warn(
              "[AuthStore] initAuth: Detected expired session via validation call. Forcing logout.",
            );
            get().handleInvalidDelegationError();
            return;
          }
          console.warn(
            "[AuthStore] initAuth: Non-critical error during proactive validation:",
            e,
          );
        }
      }

      const principal = isAuthenticatedWithII
        ? authClient.getIdentity().getPrincipal().toText()
        : null;

      if (principal) {
        console.log(`[AuthStore] initAuth: Principal found: ${principal}`);
      }

      set({
        authClient,
        principal,
        authStatus: isAuthenticatedWithII
          ? AuthStatus.PENDING_SETUP
          : AuthStatus.UNAUTHENTICATED,
        userCanisterId: null,
      });
      console.log(
        `[AuthStore] initAuth: Initialization complete. Status set to ${get().authStatus}.`,
      );
    } catch (error: unknown) {
      console.error("CRITICAL: AuthClient.create() failed in initAuth:", error);
      get().setAuthError(
        "Critical: AuthClient initialization failed. Please try refreshing the page.",
      );
    }
  },

  login: async () => {
    console.log("[AuthStore] login: Starting login process.");
    let client = get().authClient;
    if (!client) {
      console.warn("[AuthStore] login: AuthClient not found, re-initializing.");
      await get().initAuth();
      client = get().authClient;
      if (!client) {
        console.error(
          "[AuthStore] Login: AuthClient failed to initialize. Cannot proceed.",
        );
        get().setAuthError("Auth client failed to initialize.");
        return;
      }
    }

    set({
      authStatus: AuthStatus.AUTHENTICATING_II,
      setupError: null,
      isSessionExpired: false,
    });
    const iiUrl = process.env.NEXT_PUBLIC_INTERNET_IDENTITY_URL;
    if (!iiUrl) {
      console.error("NEXT_PUBLIC_INTERNET_IDENTITY_URL is not defined.");
      get().setAuthError("Configuration error: Missing Internet Identity URL.");
      return;
    }

    console.log(`[AuthStore] login: Using Internet Identity URL: ${iiUrl}`);
    try {
      await client.login({
        identityProvider: iiUrl,
        maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000),
        onSuccess: async () => {
          const principal = client!.getIdentity().getPrincipal().toText();
          console.log(
            `[AuthStore] login: II login successful. Principal: ${principal}`,
          );
          set({
            principal,
            authStatus: AuthStatus.PENDING_SETUP,
            userCanisterId: null,
            setupError: null,
            isSessionExpired: false,
          });
        },
        onError: (error) => {
          console.error("[AuthStore] login: II Login failed:", error);
          set({
            authStatus: AuthStatus.UNAUTHENTICATED,
            setupError: "Internet Identity login failed.",
          });
        },
      });
    } catch (error: unknown) {
      console.error("[AuthStore] login: Error during login process:", error);
      get().setAuthError("Login process error.");
    }
  },

  logout: async () => {
    const { authClient, principal } = get();
    console.log(`[AuthStore] logout: Logging out principal: ${principal}`);

    // CRITICAL: Wipe the Vault Key from storage immediately
    sessionStorage.removeItem("gpt_root_key");

    if (authClient) {
      try {
        await authClient.logout();
        console.log("[AuthStore] logout: AuthClient logout successful.");
      } catch (error: unknown) {
        console.error(
          "[AuthStore] logout: Error during AuthClient.logout():",
          error,
        );
      }
    }

    // Reset all stores to clear any user-specific data
    console.log("[AuthStore] logout: Resetting all stores...");

    // Import stores dynamically to avoid circular dependencies
    const { useChatStore } = await import("../../chatStore");
    const { useFileStore } = await import("../../fileStore");
    const { useGovernanceStore } = await import("../../governanceStore");
    const { useModelsStore } = await import("../../modelsStore");
    const { useEmbeddingStore } = await import("../../embeddingStore");

    // Reset all stores
    useChatStore.getState().resetChat();
    useFileStore.getState().reset();
    useGovernanceStore.getState().reset();
    useModelsStore.getState().reset();
    useEmbeddingStore.getState().resetWorker();

    console.log("[AuthStore] logout: All stores reset.");

    // Reset authStore state
    set({
      authStatus: AuthStatus.UNAUTHENTICATED,
      principal: null,
      userCanisterId: null,
      userStorageUsage: 0,
      userStorageLimit: 7 * 1024 * 1024 * 1024, // 7 GiB
      setupError: null,
      isSessionExpired: false,
      rootKey: null, // Ensure in-memory key is also wiped
    });
    console.log("[AuthStore] logout: State cleared.");
  },
});
