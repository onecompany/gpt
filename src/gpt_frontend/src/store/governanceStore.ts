import { create } from "zustand";
import { Principal } from "@icp-sdk/core/principal";
import { useAuthStore } from "./authStore";
import { IndexApi } from "@/services/api/indexApi";
import type { AttestationRequirements } from "@candid/declarations/gpt_index.did";
import { useModelsStore } from "./modelsStore";
import { BackendModelPreset } from "@/constants/modelPresets";
import { CanisterInfo } from "@/components/settings/SettingsTypes";

interface GovernanceState {
  loading: boolean;
  error: string | null;
  isManager: boolean | null;
  managers: Principal[];
  hasFetchedInitialData: boolean;
  attestationRequirements: AttestationRequirements | null;

  // User Canister Pool Management
  availableCanisters: CanisterInfo[];
  assignedCanisters: CanisterInfo[];
  poolTargetSize: number;
  canisters: CanisterInfo[]; // All canisters (for backwards compatibility)
  loadingCanisters: boolean;
  hasFetchedCanisters: boolean;

  fetchInitialData: (forceRefresh?: boolean) => Promise<void>;
  claimManagerRole: () => Promise<void>;
  addManager: (principal: string) => Promise<void>;
  removeManager: (principal: Principal) => Promise<void>;

  // Attestation Governance
  updateAttestationPolicies: (
    policies: Omit<AttestationRequirements, "measurements">,
  ) => Promise<void>;
  addMeasurement: (measurementHex: string, name: string) => Promise<void>;
  updateMeasurementStatus: (
    measurementHex: string,
    status: Record<string, null> | unknown,
  ) => Promise<void>;
  removeMeasurement: (measurementHex: string) => Promise<void>;

  // Model Governance
  addModel: (model: BackendModelPreset) => Promise<void>;
  updateModel: (model: BackendModelPreset) => Promise<void>;

  // Canister Governance
  fetchCanisters: () => Promise<void>;
  provisionCanister: () => Promise<void>;

  // Reset
  reset: () => void;
}

export const useGovernanceStore = create<GovernanceState>((set, get) => ({
  loading: false,
  error: null,
  isManager: null,
  managers: [],
  hasFetchedInitialData: false,
  attestationRequirements: null,
  availableCanisters: [],
  assignedCanisters: [],
  poolTargetSize: 0,
  canisters: [],
  loadingCanisters: false,
  hasFetchedCanisters: false,

  fetchInitialData: async (forceRefresh = false) => {
    if (get().loading && !forceRefresh) return;
    if (get().hasFetchedInitialData && !forceRefresh) return;

    set({ loading: true, error: null });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");

      const isManager = await IndexApi.isManager(authClient.getIdentity());
      const managersStrings = await IndexApi.listManagers(
        authClient.getIdentity(),
      );
      const managers = managersStrings.map((s) => Principal.fromText(s));
      const requirements = await IndexApi.getAttestationRequirements(
        authClient.getIdentity(),
      );

      set({
        isManager,
        managers,
        attestationRequirements: requirements,
        hasFetchedInitialData: true,
      });
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({
        error: errorMsg || "Failed to fetch governance data.",
      });
    } finally {
      set({ loading: false });
    }
  },

  claimManagerRole: async () => {
    set({ loading: true, error: null });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");
      await IndexApi.claimManagerRole(authClient.getIdentity());
      await get().fetchInitialData(true);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ error: errorMsg || "Failed to claim manager role." });
      throw new Error(errorMsg);
    } finally {
      set({ loading: false });
    }
  },

  addManager: async (principalStr: string) => {
    set({ loading: true, error: null });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");
      await IndexApi.addManager(authClient.getIdentity(), principalStr);
      await get().fetchInitialData(true);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ error: errorMsg || "Failed to add manager." });
      throw new Error(errorMsg);
    } finally {
      set({ loading: false });
    }
  },

  removeManager: async (principal: Principal) => {
    set({ loading: true, error: null });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");
      await IndexApi.removeManager(authClient.getIdentity(), principal);
      await get().fetchInitialData(true);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ error: errorMsg || "Failed to remove manager." });
      throw new Error(errorMsg);
    } finally {
      set({ loading: false });
    }
  },

  updateAttestationPolicies: async (policies) => {
    set({ loading: true, error: null });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");
      await IndexApi.updateAttestationPolicies(
        authClient.getIdentity(),
        policies,
      );
      await get().fetchInitialData(true);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ error: errorMsg || "Failed to update attestation policies." });
      throw new Error(errorMsg);
    } finally {
      set({ loading: false });
    }
  },

  addMeasurement: async (measurementHex: string, name: string) => {
    set({ loading: true, error: null });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");
      await IndexApi.addMeasurement(
        authClient.getIdentity(),
        measurementHex,
        name,
      );
      await get().fetchInitialData(true);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ error: errorMsg || "Failed to add measurement." });
      throw new Error(errorMsg);
    } finally {
      set({ loading: false });
    }
  },

  updateMeasurementStatus: async (
    measurementHex: string,
    status: Record<string, null> | unknown,
  ) => {
    set({ loading: true, error: null });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");
      // The casting is handled in IndexApi to match IDL
      await IndexApi.updateMeasurementStatus(
        authClient.getIdentity(),
        measurementHex,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status as any,
      );
      await get().fetchInitialData(true);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ error: errorMsg || "Failed to update measurement status." });
      throw new Error(errorMsg);
    } finally {
      set({ loading: false });
    }
  },

  removeMeasurement: async (measurementHex: string) => {
    set({ loading: true, error: null });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");
      await IndexApi.removeMeasurement(
        authClient.getIdentity(),
        measurementHex,
      );
      await get().fetchInitialData(true);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ error: errorMsg || "Failed to remove measurement." });
      throw new Error(errorMsg);
    } finally {
      set({ loading: false });
    }
  },

  addModel: async (model: BackendModelPreset) => {
    set({ loading: true, error: null });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");

      await IndexApi.addModel(authClient.getIdentity(), model);
      await useModelsStore.getState().fetchModels(true);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ error: errorMsg || "Failed to add model." });
      throw new Error(errorMsg);
    } finally {
      set({ loading: false });
    }
  },

  updateModel: async (model: BackendModelPreset) => {
    set({ loading: true, error: null });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");
      await IndexApi.updateModel(authClient.getIdentity(), model);
      await useModelsStore.getState().fetchModels(true);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ error: errorMsg || "Failed to update model." });
      throw new Error(errorMsg);
    } finally {
      set({ loading: false });
    }
  },

  fetchCanisters: async () => {
    set({ loadingCanisters: true });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");

      // Fetch pool info with available/assigned separation
      const poolInfo = await IndexApi.listCanisterPool(
        authClient.getIdentity(),
      );

      // Combine all canisters for backwards compatibility
      const allCanisters = [...poolInfo.available, ...poolInfo.assigned];

      // Show canisters immediately with loading state
      set({
        availableCanisters: poolInfo.available,
        assignedCanisters: poolInfo.assigned,
        poolTargetSize: poolInfo.poolTargetSize,
        canisters: allCanisters,
        hasFetchedCanisters: true,
      });

      // Fetch storage data for assigned canisters only (available have no code installed)
      const assignedIds = poolInfo.assigned.map((c) => c.canisterId);
      if (assignedIds.length > 0) {
        const storageMap = await IndexApi.fetchCanistersStorageUsage(
          authClient.getIdentity(),
          assignedIds,
        );

        // Update assigned canisters with storage data
        const assignedWithStorage = poolInfo.assigned.map((c) => {
          const storage = storageMap.get(c.canisterId);
          return {
            ...c,
            storageUsageBytes: storage ? storage.usageBytes : null,
            storageLimitBytes: storage
              ? storage.limitBytes
              : 7 * 1024 * 1024 * 1024,
            storageUtilizationPct: storage
              ? (storage.usageBytes / storage.limitBytes) * 100
              : 0,
            isLoadingStorage: false,
            storageLoadError: storage === null ? "Failed to load storage" : undefined,
          };
        });

        set({
          assignedCanisters: assignedWithStorage,
          canisters: [...poolInfo.available, ...assignedWithStorage],
        });
      }
    } catch (e: unknown) {
      console.error("Failed to fetch canisters:", e);
    } finally {
      set({ loadingCanisters: false });
    }
  },

  provisionCanister: async () => {
    set({ loadingCanisters: true, error: null });
    try {
      const { authClient } = useAuthStore.getState();
      if (!authClient) throw new Error("Authentication client not ready.");
      await IndexApi.createUserCanister(authClient.getIdentity());
      await get().fetchCanisters();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ error: errorMsg || "Failed to provision canister." });
      throw new Error(errorMsg);
    } finally {
      set({ loadingCanisters: false });
    }
  },

  reset: () => {
    set({
      loading: false,
      error: null,
      isManager: null,
      managers: [],
      hasFetchedInitialData: false,
      attestationRequirements: null,
      availableCanisters: [],
      assignedCanisters: [],
      poolTargetSize: 0,
      canisters: [],
      loadingCanisters: false,
      hasFetchedCanisters: false,
    });
  },
}));
