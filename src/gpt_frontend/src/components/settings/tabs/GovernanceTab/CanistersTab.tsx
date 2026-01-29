import React, { useEffect } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { useGovernanceStore } from "@/store/governanceStore";
import { CircleNotch, Copy, Clock, Crown } from "@phosphor-icons/react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CanisterInfo } from "../../SettingsTypes";

const formatTimeRemaining = (expiresAt: number): string => {
  const now = Date.now();
  const remaining = expiresAt - now;

  if (remaining <= 0) return "Expired";

  const minutes = Math.floor(remaining / (1000 * 60));
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${minutes}m`;
};

interface CanisterListProps {
  canisters: CanisterInfo[];
}

const CanisterList: React.FC<CanisterListProps> = ({ canisters }) => {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead compact className="w-2 pl-3.5"></TableHead>
          <TableHead className="text-left px-3">Canister ID</TableHead>
          <TableHead className="text-left">Type</TableHead>
          <TableHead className="text-right pr-6">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {canisters.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={4}
              className="text-center text-zinc-500 text-sm py-12"
            >
              No canisters in pool. Provision one to get started.
            </TableCell>
          </TableRow>
        )}
        {canisters.map((canister) => {
          const isAvailable = canister.state.type === "Available";
          const isManager =
            canister.state.type === "Assigned" &&
            canister.state.expiresAt === null;
          const isTrial =
            canister.state.type === "Assigned" &&
            canister.state.expiresAt !== null;

          let status: "Active" | "Paused" | "Offline" = "Active";
          if (isAvailable) {
            status = "Paused";
          }

          return (
            <TableRow key={canister.canisterId}>
              <TableCell compact className="w-2 pl-3.5">
                <StatusBadge status={status} showLabel={false} />
              </TableCell>
              <TableCell className="px-3">
                <div className="flex items-center gap-2 group">
                  <span
                    className="truncate text-sm text-zinc-300"
                    title={canister.canisterId}
                  >
                    {canister.canisterId}
                  </span>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(canister.canisterId)
                    }
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200 transition-all focus:opacity-100 p-1 rounded-md hover:bg-zinc-800"
                    title="Copy ID"
                    aria-label={`Copy canister ID ${canister.canisterId}`}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </TableCell>
              <TableCell>
                {isAvailable && (
                  <span className="text-xs text-zinc-500">Available</span>
                )}
                {isManager && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                    <Crown size={14} weight="fill" className="text-zinc-400" />
                    <span>Manager</span>
                  </div>
                )}
                {isTrial && canister.state.type === "Assigned" && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <Clock size={14} />
                    <span>Trial ({formatTimeRemaining(canister.state.expiresAt!)})</span>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right pr-6 text-zinc-400 whitespace-nowrap text-sm">
                {new Date(canister.timeCreated).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const CanistersTab: React.FC = () => {
  const {
    availableCanisters,
    assignedCanisters,
    fetchCanisters,
    loadingCanisters,
    hasFetchedCanisters,
  } = useGovernanceStore();

  useEffect(() => {
    fetchCanisters();
  }, [fetchCanisters]);

  // Combine and sort: assigned first (by creation time desc), then available
  const allCanisters = [
    ...assignedCanisters.sort((a, b) => b.timeCreated - a.timeCreated),
    ...availableCanisters.sort((a, b) => b.timeCreated - a.timeCreated),
  ];

  if (loadingCanisters && !hasFetchedCanisters) {
    return (
      <div className="flex items-center justify-center h-full">
        <CircleNotch size={24} className="animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto">
      <CanisterList canisters={allCanisters} />
    </div>
  );
};

export default CanistersTab;
