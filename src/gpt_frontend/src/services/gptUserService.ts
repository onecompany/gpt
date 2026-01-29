import { Identity, ActorSubclass } from "@icp-sdk/core/agent";
import { createActor } from "./actorFactory";
import { idlFactory } from "@candid/declarations/gpt_user.did.js";
import type { _SERVICE as GptUserService } from "@candid/declarations/gpt_user.did.d.ts";

export type GptUserActor = ActorSubclass<GptUserService>;

export const getUserActor = async (
  identity: Identity,
  canisterId: string,
): Promise<GptUserActor> => {
  if (!canisterId) {
    throw new Error("No user canister ID provided to getUserActor.");
  }

  return createActor<GptUserService>(canisterId, idlFactory, identity);
};
