import React from "react";
import {
  GearFine,
  Palette,
  Sparkle,
  Wallet,
  HardDrive,
  HardDrives,
  Info,
  Gavel,
  IconProps,
} from "@phosphor-icons/react";
import { Layout, Plug, Shield, Toolbox, Users } from "@phosphor-icons/react";
import { NodeId } from "@/types/brands";
import { PublicNodeInfo } from "@/types";

export type TabKey =
  | "general"
  | "theme"
  | "security"
  | "wallet"
  | "storage"
  | "integrations"
  | "tools"
  | "profiles"
  | "style"
  | "models"
  | "nodes"
  | "canisters"
  | "governance"
  | "about";

export interface TabItem {
  key: TabKey;
  label: string;
  Icon: React.FC<IconProps>;
}

export const tabItems: TabItem[] = [
  { key: "general", label: "General", Icon: GearFine },
  { key: "theme", label: "Theme", Icon: Layout },
  { key: "security", label: "Security", Icon: Shield },
  { key: "wallet", label: "Wallet", Icon: Wallet },
  { key: "storage", label: "Storage", Icon: HardDrive },
  { key: "integrations", label: "Integrations", Icon: Plug },
  { key: "tools", label: "Tools", Icon: Toolbox },
  { key: "profiles", label: "Profiles", Icon: Users },
  { key: "style", label: "Style", Icon: Palette },
  { key: "models", label: "Models", Icon: Sparkle },
  { key: "nodes", label: "Nodes", Icon: HardDrives },
  { key: "governance", label: "Governance", Icon: Gavel },
  { key: "about", label: "About", Icon: Info },
];

export interface NodeInfo {
  node_id: NodeId;
  owner: string;
  node_principal: string | null;
  hostname: string;
  model_id: string;
  status: "Online" | "Offline";
  attestation_verified_at: number | null;
}

export const mapPublicNodeToSettingsNode = (node: PublicNodeInfo): NodeInfo => {
  return {
    node_id: node.nodeId,
    owner: node.owner.toText(),
    node_principal: node.nodePrincipal ? node.nodePrincipal.toText() : null,
    hostname: node.hostname,
    model_id: node.modelId,
    status: node.isActive ? "Online" : "Offline",
    attestation_verified_at: node.attestationVerifiedAt,
  };
};

export type CanisterState =
  | { type: "Available" }
  | { type: "Assigned"; owner: string; expiresAt: number | null }; // null = manager (no expiry)

export interface CanisterInfo {
  canisterId: string;
  timeCreated: number;
  state: CanisterState;
  storageUsageBytes: number | null; // null = not yet loaded
  storageLimitBytes: number;
  storageUtilizationPct: number;
  isLoadingStorage?: boolean;
  storageLoadError?: string;
}

export interface CanisterPoolInfo {
  available: CanisterInfo[];
  assigned: CanisterInfo[];
  poolTargetSize: number;
}
