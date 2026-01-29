import React, { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { useGovernanceStore } from "@/store/governanceStore";
import { useAuthStore } from "@/store/authStore";
import { Principal } from "@icp-sdk/core/principal";
import {
  Trash,
  Copy,
  User,
  CaretRight,
  CheckCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import clsx from "clsx";

interface ManagersTabProps {
  viewMode: "list" | "form";
  onSuccess: (msg: string) => void;
}

const ManagersTab: React.FC<ManagersTabProps> = ({ viewMode, onSuccess }) => {
  const { managers, addManager, removeManager } = useGovernanceStore();
  const { principal: currentUser } = useAuthStore();
  const [newPrincipal, setNewPrincipal] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    const clean = newPrincipal.trim();
    if (!clean) {
      toast.error("Principal ID required.");
      setIsLoading(false);
      return;
    }
    try {
      Principal.fromText(clean); // Validate format
      await addManager(clean);
      setNewPrincipal("");
      onSuccess("Manager added successfully.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid Principal ID.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (p: Principal) => {
    if (p.toText() === currentUser) {
      if (
        !confirm(
          "WARNING: You are removing YOURSELF. You will lose access immediately. Continue?",
        )
      )
        return;
    } else {
      if (!confirm("Remove this manager?")) return;
    }
    try {
      await removeManager(p);
      toast.success("Manager removed successfully.", {
        icon: <CheckCircle size={18} weight="fill" className="text-zinc-100" />,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to remove manager.";
      toast.error(msg);
    }
  };

  const isFormValid = newPrincipal.trim().length > 0;

  if (viewMode === "form") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
            Grant administrative access to another principal. Managers have full
            control over protocol governance.
          </p>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Principal ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={16} className="text-zinc-500" />
              </div>
              <input
                type="text"
                value={newPrincipal}
                onChange={(e) => setNewPrincipal(e.target.value)}
                placeholder="aaaaa-aa..."
                className="mt-0 block w-full pl-9 pr-3 py-2 rounded-md bg-zinc-800 text-sm text-zinc-100 placeholder-zinc-500  focus:ring-0 transition-colors"
                autoFocus
              />
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-750 px-5 py-3 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !isFormValid}
            className={clsx(
              "text-sm font-medium flex items-center gap-1.5  focus:ring-0 transition-colors",
              isLoading || !isFormValid
                ? "text-zinc-500 "
                : "text-zinc-100 hover:text-zinc-200 cursor-pointer",
            )}
          >
            {isLoading ? "Saving..." : "Add Manager"}
            {!isLoading && <CaretRight size={14} weight="bold" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-left px-5">Principal ID</TableHead>
            <TableHead className="text-right px-5 w-32">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {managers.map((p) => {
            const pid = p.toText();
            const isMe = pid === currentUser;
            return (
              <TableRow key={pid}>
                <TableCell className="px-5 text-zinc-300 text-sm">
                  {pid}
                  {isMe && (
                    <span className="ml-3 px-1.5 py-0.5 font-normal rounded-full text-[0.625rem] bg-zinc-750 text-zinc-400 border border-zinc-500/20 font-sans">
                      You
                    </span>
                  )}
                </TableCell>
                <TableCell className="px-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(pid)}
                      className="text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                      title="Copy"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => handleRemove(p)}
                      className="text-zinc-500 hover:text-zinc-100 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                      title="Remove"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default ManagersTab;
