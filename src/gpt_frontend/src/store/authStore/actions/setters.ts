import { StateCreator } from "zustand";
import { AuthStore } from "../index";
import { AuthStatus, CRITICAL_INIT_ERROR_MSG } from "../state";

export interface SetterActions {
  setPrincipal: (principal: string) => void;
  confirmUserCanisterId: (canisterId: string) => void;
  setAuthError: (
    errorMessage: string | null,
    title?: string,
    isFatal?: boolean,
  ) => void;
  retryUserSetup: () => void;
  handleInvalidDelegationError: () => void;
}

export const createSetterActions: StateCreator<
  AuthStore,
  [],
  [],
  SetterActions
> = (set, get) => ({
  setPrincipal: (principal) => {
    set({ principal });
  },

  confirmUserCanisterId: (canisterId) => {
    if (!canisterId) {
      console.error("Attempted to confirm a null or empty userCanisterId!");
      get().setAuthError("Internal error: Invalid user canister ID received.");
      return;
    }
    set({
      userCanisterId: canisterId,
      authStatus: AuthStatus.REGISTERED,
      setupError: null,
      setupErrorTitle: undefined,
      isFatalError: false,
      isSessionExpired: false,
    });
  },

  setAuthError: (
    errorMessage,
    title = "Connection Error",
    isFatal = false,
  ) => {
    set({
      setupError: errorMessage,
      setupErrorTitle: title,
      isFatalError: isFatal,
      authStatus: AuthStatus.SETUP_ERROR,
    });
  },

  retryUserSetup: () => {
    const { authStatus, setupError, authClient, principal } = get();

    if (
      (authStatus === AuthStatus.SETUP_ERROR &&
        setupError === CRITICAL_INIT_ERROR_MSG) ||
      (authStatus === AuthStatus.INITIALIZING && authClient === null)
    ) {
      console.warn(
        "retryUserSetup: Critical AuthClient error detected. Re-initializing.",
      );
      get().initAuth();
      return;
    }

    if (principal && authStatus === AuthStatus.SETUP_ERROR) {
      set({
        authStatus: AuthStatus.PENDING_SETUP,
        setupError: null,
        setupErrorTitle: undefined,
        isFatalError: false,
      });
    }
  },

  handleInvalidDelegationError: () => {
    if (get().isSessionExpired) return;
    console.warn(
      "handleInvalidDelegationError: Invalid delegation detected. Session expired.",
    );
    set({ isSessionExpired: true });
    get().logout();
  },
});
