import type { NextConfig } from "next";
import path from "path";
import { promises as fs } from "fs";

type DfxJson = {
  canisters: Record<string, { type?: string }>;
};

type CanisterIdsJson = Record<string, Record<string, string>>;

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

function getSafeNetwork(): "local" | "ic" {
  const raw = process.env.DFX_NETWORK;
  if (raw === "ic") {
    return "ic";
  }
  if (raw && raw !== "local") {
    console.warn(
      `Unexpected DFX_NETWORK value "${raw}" detected. Falling back to "local".`,
    );
  }

  return "local";
}

function getCanisterIdsPath(network: "local" | "ic"): string {
  if (network === "ic") {
    return path.join(PROJECT_ROOT, "canister_ids.json");
  }
  return `${PROJECT_ROOT}/.dfx/${network}/canister_ids.json`;
}

async function bootstrap(envPrefix: string): Promise<void> {
  const dfxJsonPath = path.join(PROJECT_ROOT, "dfx.json");
  const dfxJson = await fs.readFile(dfxJsonPath, "utf8");
  const dfx = JSON.parse(dfxJson) as DfxJson;
  const canisterNames = Object.keys(dfx.canisters).filter(
    (key) => dfx.canisters[key].type !== "assets" && key !== "gpt_user",
  );
  await setCanisterVariables(canisterNames, envPrefix);
  const network = getSafeNetwork();
  const canisterIdsPath = getCanisterIdsPath(network);
  const canistersJson = await fs.readFile(canisterIdsPath, "utf8");
  const canisters = JSON.parse(canistersJson) as CanisterIdsJson;
  if (network === "local") {
    const iiCanisterId = canisters["internet_identity"]
      ? canisters["internet_identity"][network]
      : null;
    if (!iiCanisterId) {
      throw new Error(
        "internet_identity canister not found in canister_ids.json",
      );
    }
    process.env[`${envPrefix}_INTERNET_IDENTITY_CANISTER_ID`] = iiCanisterId;
    process.env.NEXT_PUBLIC_INTERNET_IDENTITY_URL = `http://${iiCanisterId}.localhost:4943/`;
    process.env.NEXT_PUBLIC_IC_HOST_URL = "http://localhost:4943";
  } else {
    process.env.NEXT_PUBLIC_INTERNET_IDENTITY_URL = "https://id.ai/";
    process.env.NEXT_PUBLIC_IC_HOST_URL = "https://icp-api.io";
  }
}

async function setCanisterVariables(
  canisterNames: string[],
  prefix: string,
): Promise<void> {
  try {
    const network = getSafeNetwork();
    const canisterIdsPath = getCanisterIdsPath(network);
    const canistersJson = await fs.readFile(canisterIdsPath, "utf8");
    const canisters = JSON.parse(canistersJson) as CanisterIdsJson;
    for (const name of canisterNames) {
      const variableName = `${prefix}_${name.toUpperCase()}_CANISTER_ID`;
      if (canisters[name] && canisters[name][network]) {
        process.env[variableName] = canisters[name][network];
      } else {
        console.warn(
          `Warning: Canister ID for '${name}' on network '${network}' not found in ${canisterIdsPath}`,
        );
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to set canister variables: ${error.message}`);
    }
    throw new Error("Failed to set canister variables: Unknown error");
  }
}

const nextConfig = async (): Promise<NextConfig> => {
  await bootstrap("NEXT_PUBLIC");
  return {
    output: "export",
    devIndicators: {
      position: "bottom-left",
    },
    //typedRoutes: true,
    reactStrictMode: true,
    reactCompiler: true,
    images: {
      unoptimized: true,
    },
    experimental: {
      optimizePackageImports: ["@phosphor-icons/react"],
    },
    logging: {
      fetches: {
        fullUrl: true,
      },
    },
    env: {
      NEXT_PUBLIC_INTERNET_IDENTITY_URL:
        process.env.NEXT_PUBLIC_INTERNET_IDENTITY_URL,
      NEXT_PUBLIC_GPT_INDEX_CANISTER_ID:
        process.env.NEXT_PUBLIC_GPT_INDEX_CANISTER_ID,
      NEXT_PUBLIC_IC_HOST_URL: process.env.NEXT_PUBLIC_IC_HOST_URL,
      NEXT_PUBLIC_DFX_NETWORK: process.env.DFX_NETWORK,
    },
  };
};

export default nextConfig;
