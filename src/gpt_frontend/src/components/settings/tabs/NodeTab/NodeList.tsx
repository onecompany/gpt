import React from "react";
import { NodeInfo } from "../../SettingsTypes";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface NodeListProps {
  nodes: NodeInfo[];
  nodeListView: "my" | "all";
  currentUserPrincipal: string | null;
}

const formatUptime = (timestamp: number | null): string => {
  if (!timestamp) return "N/A";
  const now = Date.now();
  const uptimeMs = now - timestamp;

  if (uptimeMs < 0) {
    if (uptimeMs > -60000) return "Just now";
    return "N/A"; // Clock skew
  }
  if (uptimeMs < 60000) return "Just now";

  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
};

const NodeList: React.FC<NodeListProps> = ({ nodes, nodeListView }) => {
  const isMyNodesView = nodeListView === "my";

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead compact className="w-2 pl-3.5"></TableHead>
          <TableHead className="w-24 px-3 text-left">ID</TableHead>
          <TableHead className="text-left">Hostname</TableHead>
          <TableHead className="text-left">Model</TableHead>
          <TableHead className="whitespace-nowrap text-center">
            Uptime
          </TableHead>
          {!isMyNodesView && (
            <TableHead className="text-right">Owner</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {nodes.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={isMyNodesView ? 5 : 6}
              className="text-center text-zinc-500 text-sm py-12"
            >
              {isMyNodesView
                ? "You haven't created any nodes yet."
                : "No nodes found."}
            </TableCell>
          </TableRow>
        )}
        {nodes.map((node) => (
          <TableRow key={node.node_id}>
            <TableCell compact className="w-2 pl-3.5">
              <StatusBadge status={node.status} showLabel={false} />
            </TableCell>
            <TableCell
              className="w-24 px-3 text-zinc-400 truncate"
              title={node.node_id}
            >
              {node.node_id}
            </TableCell>
            <TableCell
              className="truncate max-w-50 sm:max-w-xs"
              title={node.hostname}
            >
              {node.hostname}
            </TableCell>
            <TableCell
              className="truncate max-w-37.5 sm:max-w-xs"
              title={node.model_id}
            >
              {node.model_id}
            </TableCell>
            <TableCell className="text-center text-zinc-300 whitespace-nowrap">
              {formatUptime(node.attestation_verified_at)}
            </TableCell>
            {!isMyNodesView && (
              <TableCell
                className=" text-zinc-400 truncate max-w-37.5"
                title={node.owner}
              >
                {`${node.owner.substring(0, 5)}...${node.owner.substring(
                  node.owner.length - 5,
                )}`}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default NodeList;
