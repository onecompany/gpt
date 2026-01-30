import { Identity } from "@icp-sdk/core/agent";
import { getIndexActor } from "../gptIndexService";
import { unwrapResult, formatCanisterError } from "@/utils/resultUtils";
import { UserApi } from "./userApi";
import {
  mapBackendModelToFrontend,
  mapBackendCanisterPoolEntryToFrontend,
  mapBackendCanisterPoolToFrontend,
  mapBackendPublicNodeInfoToFrontend,
} from "@/utils/mappers";
import type { Model, PublicNodeInfo } from "@/types";
import { Principal } from "@icp-sdk/core/principal";
import { BackendModelPreset } from "@/constants/modelPresets";
import { CanisterInfo, CanisterPoolInfo } from "@/components/settings/SettingsTypes";
import { normalizePayload } from "@/utils/candidAdapter";
import { idlFactory } from "@candid/declarations/gpt_index.did.js";
import type {
  AttestationRequirements,
  ListActiveNodesResponse,
  ListMyNodesResponse,
  GetModelsResponse,
  IsManagerResponse,
  ListManagersResponse,
  GetAttestationRequirementsResponse,
  ListUserCanistersResponse,
  ListCanisterPoolResponse,
  CreateUserCanisterResponse,
  ProvisionCanistersResponse,
  CreateIndexNodeResponse,
  GetUserAssignmentResponse,
} from "@candid/declarations/gpt_index.did";

// Re-export type from Candid for internal use if needed
export type { AttestationRequirements };

export class IndexApi {
  /**
   * Fetches all available models from the Index canister.
   */
  static async getModels(): Promise<Model[]> {
    const actor = await getIndexActor();
    const result = await actor.get_models(null);
    const response = result as unknown as GetModelsResponse;
    return response.models.map(mapBackendModelToFrontend);
  }

  /**
   * Lists all active nodes registered in the Index.
   */
  static async listActiveNodes(): Promise<PublicNodeInfo[]> {
    const actor = await getIndexActor();
    const result = await actor.list_active_nodes(null);
    const response = unwrapResult<ListActiveNodesResponse, unknown>(
      result,
      formatCanisterError,
    );
    return response.nodes.map(mapBackendPublicNodeInfoToFrontend);
  }

  /**
   * Lists nodes owned by the authenticated user.
   */
  static async listMyNodes(identity: Identity): Promise<PublicNodeInfo[]> {
    const actor = await getIndexActor(identity);
    const result = await actor.list_my_nodes(null);
    const response = unwrapResult<ListMyNodesResponse, unknown>(
      result,
      formatCanisterError,
    );
    return response.nodes.map(mapBackendPublicNodeInfoToFrontend);
  }

  /**
   * Checks if the current user has Manager privileges.
   */
  static async isManager(identity: Identity): Promise<boolean> {
    const actor = await getIndexActor(identity);
    const result = await actor.is_manager();
    const response = unwrapResult<IsManagerResponse, unknown>(
      result,
      formatCanisterError,
    );
    return response.is_manager;
  }

  /**
   * Creates a new node configuration in the Index.
   */
  static async createNode(
    identity: Identity,
    req: {
      hostname: string;
      modelId: string;
      encryptedApiKey: string;
      expectedChipId: string;
    },
  ): Promise<number> {
    const actor = await getIndexActor(identity);
    // Use normalizePayload to handle field mapping
    const [payload] = normalizePayload(idlFactory, "create_node", [
      {
        hostname: req.hostname,
        model_id: req.modelId,
        encrypted_api_key: req.encryptedApiKey,
        expected_chip_id: req.expectedChipId,
      },
    ]);
    const result = await actor.create_node(payload);
    const response = unwrapResult<CreateIndexNodeResponse, unknown>(
      result,
      formatCanisterError,
    );
    // Node ID is a small sequential integer, safe to cast to number
    return Number(response.node_id);
  }

  /**
   * Gets the canister ID assigned to the user, if any.
   */
  static async getUserAssignment(
    identity: Identity,
    userPrincipal: string,
  ): Promise<string | null> {
    const actor = await getIndexActor(identity);
    const [payload] = normalizePayload(idlFactory, "get_user_assignment", [
      { user_principal: userPrincipal },
    ]);
    const result = await actor.get_user_assignment(payload);
    const response = unwrapResult<GetUserAssignmentResponse, unknown>(
      result,
      formatCanisterError,
    );
    if (response.assigned_canister.length > 0) {
      return response.assigned_canister[0].toText();
    }
    return null;
  }

  /**
   * Registers a new user with the Index.
   */
  static async registerUser(
    identity: Identity,
    username: string,
  ): Promise<void> {
    const actor = await getIndexActor(identity);
    const [payload] = normalizePayload(idlFactory, "register_user", [
      { username },
    ]);
    const result = await actor.register_user(payload);
    unwrapResult(result, formatCanisterError);
  }

  // --- Governance Methods ---

  static async listManagers(identity: Identity): Promise<string[]> {
    const actor = await getIndexActor(identity);
    const result = await actor.list_managers();
    const response = unwrapResult<ListManagersResponse, unknown>(
      result,
      formatCanisterError,
    );
    return response.managers.map((p) => p.toText());
  }

  static async claimManagerRole(identity: Identity): Promise<void> {
    const actor = await getIndexActor(identity);
    const result = await actor.claim_manager_role();
    unwrapResult(result, formatCanisterError);
  }

  static async addManager(
    identity: Identity,
    principalStr: string,
  ): Promise<void> {
    const actor = await getIndexActor(identity);
    const [payload] = normalizePayload(idlFactory, "add_manager", [
      { principal_to_add: principalStr },
    ]);
    const result = await actor.add_manager(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async removeManager(
    identity: Identity,
    principal: Principal,
  ): Promise<void> {
    const actor = await getIndexActor(identity);
    const [payload] = normalizePayload(idlFactory, "remove_manager", [
      { principal_to_remove: principal },
    ]);
    const result = await actor.remove_manager(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async getAttestationRequirements(
    identity: Identity,
  ): Promise<AttestationRequirements> {
    const actor = await getIndexActor(identity);
    const result = await actor.get_attestation_requirements(null);
    const response = unwrapResult<GetAttestationRequirementsResponse, unknown>(
      result,
      formatCanisterError,
    );
    return response.requirements;
  }

  static async updateAttestationPolicies(
    identity: Identity,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requirements: any,
  ): Promise<void> {
    const actor = await getIndexActor(identity);
    const [payload] = normalizePayload(
      idlFactory,
      "update_attestation_policies",
      [requirements],
    );
    const result = await actor.update_attestation_policies(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async addMeasurement(
    identity: Identity,
    hex: string,
    name: string,
  ): Promise<void> {
    const actor = await getIndexActor(identity);
    const [payload] = normalizePayload(idlFactory, "add_measurement", [
      { measurement_hex: hex, name },
    ]);
    const result = await actor.add_measurement(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async updateMeasurementStatus(
    identity: Identity,
    hex: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: any,
  ): Promise<void> {
    const actor = await getIndexActor(identity);
    const [payload] = normalizePayload(
      idlFactory,
      "update_measurement_status",
      [{ measurement_hex: hex, status }],
    );
    const result = await actor.update_measurement_status(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async removeMeasurement(
    identity: Identity,
    hex: string,
  ): Promise<void> {
    const actor = await getIndexActor(identity);
    const [payload] = normalizePayload(idlFactory, "remove_measurement", [
      { measurement_hex: hex },
    ]);
    const result = await actor.remove_measurement(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async addModel(
    identity: Identity,
    model: BackendModelPreset,
  ): Promise<void> {
    const actor = await getIndexActor(identity);
    // Explicitly pass data structure matching the IDL key conventions
    const modelData = {
      ...model,
      status: { Active: null },
    };
    const [payload] = normalizePayload(idlFactory, "add_model", [
      { model: modelData },
    ]);
    const result = await actor.add_model(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async updateModel(
    identity: Identity,
    model: BackendModelPreset,
  ): Promise<void> {
    const actor = await getIndexActor(identity);
    const [payload] = normalizePayload(idlFactory, "update_model", [
      { model },
    ]);
    const result = await actor.update_model(payload);
    unwrapResult(result, formatCanisterError);
  }

  static async listUserCanisters(identity: Identity): Promise<CanisterInfo[]> {
    const actor = await getIndexActor(identity);
    const result = await actor.list_user_canisters();
    const response = unwrapResult<ListUserCanistersResponse, unknown>(
      result,
      formatCanisterError,
    );
    return response.canisters.map((entry) =>
      mapBackendCanisterPoolEntryToFrontend(entry, undefined),
    );
  }

  static async listCanisterPool(identity: Identity): Promise<CanisterPoolInfo> {
    const actor = await getIndexActor(identity);
    const result = await actor.list_canister_pool();
    const response = unwrapResult<ListCanisterPoolResponse, unknown>(
      result,
      formatCanisterError,
    );
    return mapBackendCanisterPoolToFrontend(response);
  }

  static async provisionCanisters(
    identity: Identity,
    count: number,
  ): Promise<{ canistersCreated: number; poolSize: number }> {
    const actor = await getIndexActor(identity);
    const result = await actor.provision_canisters({ count });
    const response = unwrapResult<ProvisionCanistersResponse, unknown>(
      result,
      formatCanisterError,
    );
    return {
      canistersCreated: response.canisters_created,
      poolSize: response.pool_size,
    };
  }

  static async createUserCanister(identity: Identity): Promise<string> {
    const actor = await getIndexActor(identity);
    const result = await actor.create_user_canister();
    const response = unwrapResult<CreateUserCanisterResponse, unknown>(
      result,
      formatCanisterError,
    );
    return response.canister_id.toText();
  }

  /**
   * Fetches storage usage for multiple user canisters in parallel.
   * Uses Promise.allSettled to handle individual failures gracefully.
   */
  static async fetchCanistersStorageUsage(
    identity: Identity,
    canisterIds: string[],
  ): Promise<Map<string, { usageBytes: number; limitBytes: number } | null>> {
    const results = new Map<
      string,
      { usageBytes: number; limitBytes: number } | null
    >();

    const promises = canisterIds.map(async (canisterId) => {
      try {
        const storage = await UserApi.getUserStorageUsage(identity, canisterId);
        return { canisterId, storage };
      } catch (error) {
        console.warn(
          `Failed to fetch storage for canister ${canisterId}:`,
          error,
        );
        return { canisterId, storage: null };
      }
    });

    const settled = await Promise.allSettled(promises);

    settled.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        results.set(result.value.canisterId, result.value.storage);
      }
    });

    return results;
  }
}
