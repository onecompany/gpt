import { AuthClient } from "@icp-sdk/auth/client";

export enum AuthStatus {
  INITIALIZING = "INITIALIZING",
  UNAUTHENTICATED = "UNAUTHENTICATED",
  AUTHENTICATING_II = "AUTHENTICATING_II",
  PENDING_SETUP = "PENDING_SETUP",
  REGISTERED = "REGISTERED",
  SETUP_ERROR = "SETUP_ERROR",
  VAULT_LOCKED = "VAULT_LOCKED",
  SETUP_VAULT = "SETUP_VAULT",
}

export const CRITICAL_INIT_ERROR_MSG =
  "Critical: AuthClient initialization failed. Cannot proceed.";

export interface AuthState {
  authStatus: AuthStatus;
  principal: string | null;
  authClient: AuthClient | null;
  userCanisterId: string | null;
  userStorageUsage: number;
  userStorageLimit: number;
  setupError: string | null;
  setupErrorTitle?: string; // For richer error UI
  isFatalError?: boolean; // To hide retry if futile
  isSessionExpired: boolean;
  rootKey: string | null; // In-memory only
}

export const initialState: AuthState = {
  authStatus: AuthStatus.INITIALIZING,
  principal: null,
  authClient: null,
  userCanisterId: null,
  userStorageUsage: 0,
  userStorageLimit: 7 * 1024 * 1024 * 1024, // 7 GiB
  setupError: null,
  setupErrorTitle: undefined,
  isFatalError: false,
  isSessionExpired: false,
  rootKey: null,
};
