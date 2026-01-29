import { HttpAgent, Identity, ActorSubclass, Actor } from "@icp-sdk/core/agent";
import { IDL } from "@icp-sdk/core/candid";

let sharedAgent: HttpAgent | null = null;

export const getHttpAgent = async (identity?: Identity): Promise<HttpAgent> => {
  if (!sharedAgent) {
    const host = process.env.NEXT_PUBLIC_IC_HOST_URL || "https://icp-api.io";
    const shouldFetchRootKey = process.env.NEXT_PUBLIC_DFX_NETWORK === "local";

    sharedAgent = await HttpAgent.create({
      host,
      shouldFetchRootKey,
    });
  }

  if (identity) {
    sharedAgent.replaceIdentity(identity);
  }

  return sharedAgent;
};

export const createActor = async <T>(
  canisterId: string,
  idlFactory: IDL.InterfaceFactory,
  identity?: Identity,
): Promise<ActorSubclass<T>> => {
  const agent = await getHttpAgent(identity);

  return Actor.createActor<T>(idlFactory, {
    agent,
    canisterId,
  });
};
