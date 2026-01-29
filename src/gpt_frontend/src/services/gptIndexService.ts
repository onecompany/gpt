import { Identity, ActorSubclass } from "@icp-sdk/core/agent";
import { createActor } from "./actorFactory";
import { idlFactory } from "@candid/declarations/gpt_index.did.js";
import type { _SERVICE } from "@candid/declarations/gpt_index.did.d.ts";

export type IndexActor = ActorSubclass<_SERVICE>;

export const getIndexActor = async (
  identity?: Identity,
): Promise<IndexActor> => {
  const canisterId = process.env.NEXT_PUBLIC_GPT_INDEX_CANISTER_ID;

  if (!canisterId) {
    throw new Error(
      "NEXT_PUBLIC_GPT_INDEX_CANISTER_ID is not defined in environment variables.",
    );
  }

  return createActor<_SERVICE>(canisterId, idlFactory, identity);
};
