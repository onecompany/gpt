import React, { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useGovernanceStore } from "@/store/governanceStore";
import {
  Trash,
  Pause,
  Play,
  Prohibit,
  CaretRight,
  CheckCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import clsx from "clsx";

interface RegistryTabProps {
  viewMode: "list" | "form";
  onSuccess: (msg: string) => void;
}

const RegistryTab: React.FC<RegistryTabProps> = ({ viewMode, onSuccess }) => {
  const {
    attestationRequirements,
    addMeasurement,
    updateMeasurementStatus,
    removeMeasurement,
  } = useGovernanceStore();

  const [hex, setHex] = useState("");
  const [label, setLabel] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const expectedLength = attestationRequirements
    ? Number(attestationRequirements.expected_measurement_len) * 2
    : 96;

  const measurements = useMemo(() => {
    return attestationRequirements?.measurements
      ? [...attestationRequirements.measurements].sort((a, b) =>
          a.name.localeCompare(b.name),
        )
      : [];
  }, [attestationRequirements]);

  const handleSubmit = async () => {
    setIsLoading(true);
    const cleanHex = hex.trim().toLowerCase();
    const cleanLabel = label.trim();

    if (!cleanHex || !cleanLabel) {
      toast.error("All fields are required.");
      setIsLoading(false);
      return;
    }
    if (cleanHex.length !== expectedLength) {
      toast.error(`Hash must be exactly ${expectedLength} hex characters.`);
      setIsLoading(false);
      return;
    }
    if (!/^[0-9a-f]+$/.test(cleanHex)) {
      toast.error("Invalid hex characters.");
      setIsLoading(false);
      return;
    }

    try {
      await addMeasurement(cleanHex, cleanLabel);
      setHex("");
      setLabel("");
      onSuccess("Measurement authorized successfully.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add measurement.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (
    hex: string,
    action: "Deprecate" | "Revoke" | "Active" | "Delete",
  ) => {
    if (action === "Delete" && !confirm("Permanently delete this measurement?"))
      return;

    const payload =
      action === "Active"
        ? { Active: null }
        : action === "Revoke"
          ? { Revoked: null }
          : { Deprecated: null };

    try {
      if (action === "Delete") {
        await removeMeasurement(hex);
        toast.success("Measurement deleted.", {
          icon: (
            <CheckCircle size={18} weight="fill" className="text-zinc-100" />
          ),
        });
      } else {
        await updateMeasurementStatus(hex, payload);
        toast.success(`Measurement status updated to ${action}.`, {
          icon: (
            <CheckCircle size={18} weight="fill" className="text-zinc-100" />
          ),
        });
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to update measurement.";
      toast.error(msg);
    }
  };

  const isFormValid = hex.trim().length > 0 && label.trim().length > 0;

  if (viewMode === "form") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
            Authorize a new enclave measurement hash. Nodes running this
            measurement will be allowed to join the network.
          </p>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Release v1.4"
              className="mt-0 block w-full px-3 py-2 rounded-md bg-zinc-800 text-sm text-zinc-200 placeholder-zinc-500  focus:ring-0 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Measurement Hash (Hex)
            </label>
            <textarea
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              placeholder={`Enter ${expectedLength}-character hex string...`}
              rows={4}
              className="mt-0 block w-full px-3 py-2 rounded-md bg-zinc-800 text-sm text-zinc-200 placeholder-zinc-500  focus:ring-0 transition-colors resize-none"
            />
            <p className="text-xs text-zinc-500 mt-1.5 text-right">
              {hex.length} / {expectedLength} chars
            </p>
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
            {isLoading ? "Saving..." : "Authorize"}
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
            <TableHead className="text-left px-5 pl-6">Label</TableHead>
            <TableHead className="text-left px-5">Hash</TableHead>
            <TableHead className="text-center px-5">Status</TableHead>
            <TableHead className="text-right px-5 pr-6">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {measurements.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-sm py-12 text-zinc-500"
              >
                No measurements found.
              </TableCell>
            </TableRow>
          )}
          {measurements.map((m) => {
            const statusKey = Object.keys(m.status)[0] as
              | "Active"
              | "Deprecated"
              | "Revoked";
            return (
              <TableRow key={m.measurement_hex}>
                <TableCell className="px-5 pl-6 font-medium text-zinc-200">
                  {m.name}
                </TableCell>
                <TableCell className="px-5 max-w-xs sm:max-w-lg truncate text-sm text-zinc-500">
                  {m.measurement_hex}
                </TableCell>
                <TableCell className="px-5 text-center">
                  <StatusBadge status={statusKey} showLabel />
                </TableCell>
                <TableCell className="px-5 pr-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {statusKey === "Active" ? (
                      <button
                        onClick={() =>
                          handleAction(m.measurement_hex, "Deprecate")
                        }
                        className="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                        title="Deprecate"
                      >
                        <Pause size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          handleAction(m.measurement_hex, "Active")
                        }
                        className="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                        title="Activate"
                      >
                        <Play size={16} />
                      </button>
                    )}
                    {statusKey !== "Revoked" && (
                      <button
                        onClick={() =>
                          handleAction(m.measurement_hex, "Revoke")
                        }
                        className="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                        title="Revoke"
                      >
                        <Prohibit size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(m.measurement_hex, "Delete")}
                      className="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                      title="Delete"
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

export default RegistryTab;
