import { create } from "zustand";
import { initialState, AuthState } from "./state";
import { createLifecycleActions, LifecycleActions } from "./actions/lifecycle";
import {
  createRegistrationActions,
  RegistrationActions,
} from "./actions/registration";
import { createSetterActions, SetterActions } from "./actions/setters";
import { createUsageActions, UsageActions } from "./actions/usage";
import { createVaultActions, VaultActions } from "./actions/vault";

export type AuthActions = LifecycleActions &
  RegistrationActions &
  SetterActions &
  UsageActions &
  VaultActions;

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  (set, get, api): AuthStore => ({
    ...initialState,
    ...createLifecycleActions(set, get, api),
    ...createRegistrationActions(set, get, api),
    ...createSetterActions(set, get, api),
    ...createUsageActions(set, get, api),
    ...createVaultActions(set, get, api),
  }),
);

export { AuthStatus, CRITICAL_INIT_ERROR_MSG } from "./state";
