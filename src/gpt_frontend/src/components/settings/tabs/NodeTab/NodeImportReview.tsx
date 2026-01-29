import React, { useState } from "react";
import {
  CaretRight,
  Trash,
  WarningCircle,
  CheckCircle,
  CircleNotch,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { Model } from "@/types";

export interface ImportNodeData {
  _id: string;
  hostname: string;
  modelId: string;
  apiKey: string;
  chipId: string;
  hostIdentity: string;
  status: "idle" | "processing" | "success" | "error";
  error?: string;
}

interface NodeImportReviewProps {
  initialNodes: ImportNodeData[];
  availableModels: Model[];
  onCancel: () => void;
  onImportCompleted: () => void;
  createNodeAction: (
    hostname: string,
    modelId: string,
    apiKey: string,
    chipId: string,
    hostIdentity: string,
  ) => Promise<void>;
}

const NodeImportReview: React.FC<NodeImportReviewProps> = ({
  initialNodes,
  availableModels,
  onCancel,
  onImportCompleted,
  createNodeAction,
}) => {
  const [nodes, setNodes] = useState<ImportNodeData[]>(initialNodes);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFieldChange = (
    id: string,
    field: keyof ImportNodeData,
    value: string,
  ) => {
    setNodes((prev) =>
      prev.map((n) => (n._id === id ? { ...n, [field]: value } : n)),
    );
  };

  const handleRemove = (id: string) => {
    setNodes((prev) => prev.filter((n) => n._id !== id));
  };

  const handleProcessImport = async () => {
    setIsProcessing(true);
    const nodesToProcess = nodes.filter(
      (n) => n.status === "idle" || n.status === "error",
    );

    if (
      nodesToProcess.length === 0 &&
      nodes.some((n) => n.status === "success")
    ) {
      onImportCompleted();
      return;
    }

    for (const node of nodesToProcess) {
      setNodes((prev) =>
        prev.map((n) =>
          n._id === node._id
            ? { ...n, status: "processing", error: undefined }
            : n,
        ),
      );

      try {
        await createNodeAction(
          node.hostname,
          node.modelId,
          node.apiKey,
          node.chipId,
          node.hostIdentity,
        );

        setNodes((prev) =>
          prev.map((n) =>
            n._id === node._id ? { ...n, status: "success" } : n,
          ),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setNodes((prev) =>
          prev.map((n) =>
            n._id === node._id ? { ...n, status: "error", error: msg } : n,
          ),
        );
      }
    }
    setIsProcessing(false);
  };

  const allSuccess =
    nodes.length > 0 && nodes.every((n) => n.status === "success");
  const hasPending = nodes.some(
    (n) => n.status === "idle" || n.status === "error",
  );

  const labelClass =
    "block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5";
  const inputClass =
    "w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200  focus:border-zinc-500 disabled:opacity-50 transition-colors";

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-200">Review Import</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Review your node configurations before importing. You can edit
            values or remove entries.
          </p>
        </div>

        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
            <p className="text-sm">No nodes to import.</p>
            <button
              onClick={onCancel}
              className="mt-2 text-sm text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
            >
              Go Back
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {nodes.map((node) => {
              const isReadOnly =
                node.status === "processing" || node.status === "success";
              const isError = node.status === "error";
              const isSuccess = node.status === "success";

              return (
                <div
                  key={node._id}
                  className={clsx(
                    "p-4 rounded-lg border transition-colors",
                    // Monochrome states: error uses zinc-900 (darker) with dashed border?
                    // No, let's use zinc-800 for all, but maybe different border intensity.
                    // Actually, let's keep success clean (maybe zinc-800/80)
                    // and error visible via the icon and message text color.
                    "bg-zinc-800/30 border-zinc-700/50",
                  )}
                >
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Hostname */}
                      <div>
                        <label className={labelClass}>Hostname</label>
                        <input
                          disabled={isReadOnly}
                          value={node.hostname}
                          onChange={(e) =>
                            handleFieldChange(
                              node._id,
                              "hostname",
                              e.target.value,
                            )
                          }
                          className={inputClass}
                          placeholder="node.example.com"
                        />
                      </div>
                      {/* Model */}
                      <div>
                        <label className={labelClass}>Model</label>
                        <select
                          disabled={isReadOnly}
                          value={node.modelId}
                          onChange={(e) =>
                            handleFieldChange(
                              node._id,
                              "modelId",
                              e.target.value,
                            )
                          }
                          className={clsx(inputClass, "appearance-none")}
                        >
                          <option value="" disabled>
                            Select Model
                          </option>
                          {availableModels.map((m) => (
                            <option key={m.modelId} value={m.modelId}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* Host Identity */}
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Host Identity</label>
                        <input
                          disabled={isReadOnly}
                          value={node.hostIdentity}
                          onChange={(e) =>
                            handleFieldChange(
                              node._id,
                              "hostIdentity",
                              e.target.value,
                            )
                          }
                          className={clsx(inputClass, "")}
                          placeholder="age1..."
                        />
                      </div>
                      {/* Chip ID */}
                      <div>
                        <label className={labelClass}>Chip ID</label>
                        <input
                          disabled={isReadOnly}
                          value={node.chipId}
                          onChange={(e) =>
                            handleFieldChange(
                              node._id,
                              "chipId",
                              e.target.value,
                            )
                          }
                          className={inputClass}
                          placeholder="Hex ID"
                        />
                      </div>
                      {/* API Key */}
                      <div>
                        <label className={labelClass}>API Key</label>
                        <input
                          disabled={isReadOnly}
                          type="password"
                          value={node.apiKey}
                          onChange={(e) =>
                            handleFieldChange(
                              node._id,
                              "apiKey",
                              e.target.value,
                            )
                          }
                          className={inputClass}
                          placeholder="Secret Key"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 items-center pt-6">
                      {!isReadOnly && (
                        <button
                          onClick={() => handleRemove(node._id)}
                          className="text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 cursor-pointer rounded hover:bg-zinc-700/50"
                          title="Remove"
                        >
                          <Trash size={16} />
                        </button>
                      )}
                      {node.status === "processing" && (
                        <CircleNotch
                          size={20}
                          className="animate-spin text-zinc-400"
                        />
                      )}
                      {isSuccess && (
                        // Pure Zinc-100 success check
                        <CheckCircle
                          size={20}
                          className="text-zinc-100"
                          weight="fill"
                        />
                      )}
                      {isError && (
                        // Error remains text-zinc-400 (dimmer warning) or zinc-500
                        <WarningCircle
                          size={20}
                          className="text-zinc-500"
                          weight="fill"
                        />
                      )}
                    </div>
                  </div>
                  {isError && (
                    <div className="mt-3 text-xs text-zinc-400 bg-zinc-900/50 border border-zinc-800 px-3 py-2 rounded-md">
                      {node.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-750 px-5 py-3 flex justify-end bg-zinc-900 z-10">
        <button
          onClick={allSuccess ? onImportCompleted : handleProcessImport}
          disabled={isProcessing || (!hasPending && !allSuccess)}
          className={clsx(
            "text-sm font-medium flex items-center gap-1.5  focus:ring-0 transition-colors",
            isProcessing || (!hasPending && !allSuccess)
              ? "text-zinc-500 "
              : "text-zinc-100 hover:text-zinc-200 cursor-pointer",
          )}
        >
          {isProcessing
            ? "Processing..."
            : allSuccess
              ? "Done"
              : `Import ${
                  nodes.filter((n) => n.status !== "success").length
                } Nodes`}
          {!isProcessing && <CaretRight size={14} weight="bold" />}
        </button>
      </div>
    </div>
  );
};

export default NodeImportReview;
