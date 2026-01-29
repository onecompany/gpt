import React, { useEffect, useMemo } from "react";
import { useModelsStore } from "@/store/modelsStore";
import { useGovernanceStore } from "@/store/governanceStore";
import {
  CircleNotch,
  Pencil,
  Pause,
  Play,
  CheckCircle,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { Panorama, Toolbox, Brain } from "@phosphor-icons/react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { BackendModelPreset } from "@/constants/modelPresets";
import { Model } from "@/types";
import { toast } from "sonner";

const formatPrice = (price: number): string => {
  const pricePerMillion = price * 1_000_000;
  if (pricePerMillion < 0.01 && pricePerMillion > 0) {
    return pricePerMillion.toExponential(2);
  }
  return pricePerMillion.toFixed(2);
};

interface ModelsTabProps {
  onEdit: (model: Model) => void;
}

const ModelsTab: React.FC<ModelsTabProps> = ({ onEdit }) => {
  const { models, loading, error, hasFetched, fetchModels } = useModelsStore();
  const { updateModel, loading: governanceLoading } = useGovernanceStore();

  useEffect(() => {
    fetchModels(false);
  }, [fetchModels]);

  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => {
      if (a.provider.localeCompare(b.provider) !== 0) {
        return a.provider.localeCompare(b.provider);
      }
      return a.name.localeCompare(b.name);
    });
  }, [models]);

  const handleToggleStatus = async (model: Model) => {
    const newStatus =
      model.status === "Active" ? { Paused: null } : { Active: null };

    const backendModel: BackendModelPreset = {
      model_id: model.modelId,
      name: model.name,
      description: "",
      max_context: model.maxContext,
      max_output: model.maxOutput,
      input_token_price: model.inputTokenPrice,
      output_token_price: model.outputTokenPrice,
      maker: model.maker,
      provider: model.provider,
      provider_model: model.providerModel || "",
      provider_endpoint: model.providerEndpoint || "",
      max_image_attachments: model.max_image_attachments,
      max_tools: model.max_tools,
      aa_score: model.aaScore !== undefined ? [model.aaScore] : [],
      release_date: model.releaseDate ? [model.releaseDate] : [],
      status: newStatus,
      extra_body_json: model.extra_body_json,
    };

    try {
      await updateModel(backendModel);
      toast.success(`Model "${model.name}" status updated.`, {
        icon: <CheckCircle size={18} weight="fill" className="text-zinc-100" />,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update model.";
      toast.error(msg);
    }
  };

  const isLoading = loading || governanceLoading;

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 text-left">Name</TableHead>
              <TableHead className="px-5 text-left">Provider</TableHead>
              <TableHead className="text-right px-5">Context</TableHead>
              <TableHead className="text-right px-5">Output</TableHead>
              <TableHead className="text-center px-5">Price ($/M)</TableHead>
              <TableHead className="text-center px-5">Features</TableHead>
              <TableHead className="text-right px-5">Nodes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !hasFetched && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <CircleNotch
                    size={24}
                    className="animate-spin text-zinc-500 mx-auto"
                  />
                </TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-4 text-center text-red-400"
                >
                  Error: {error}
                </TableCell>
              </TableRow>
            )}
            {!loading && hasFetched && sortedModels.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-sm text-center text-zinc-500"
                >
                  No models have been added to the protocol. Click
                  &quot;Restore&quot; to populate.
                </TableCell>
              </TableRow>
            )}
            {sortedModels.map((model) => (
              <TableRow key={model.modelId}>
                <TableCell
                  className={clsx(
                    "truncate max-w-50 px-5 transition-colors",
                    model.status === "Paused"
                      ? "text-zinc-500"
                      : "text-zinc-200",
                  )}
                  title={model.name}
                >
                  {model.name}
                </TableCell>
                <TableCell className="text-zinc-400 px-5">
                  {model.provider}
                </TableCell>
                <TableCell className="text-zinc-500 text-right px-5">
                  {model.maxContext.toLocaleString()}
                </TableCell>
                <TableCell className="text-zinc-500 text-right px-5">
                  {model.maxOutput.toLocaleString()}
                </TableCell>
                <TableCell className="text-zinc-500 text-center px-5">
                  {formatPrice(model.inputTokenPrice)} /{" "}
                  {formatPrice(model.outputTokenPrice)}
                </TableCell>
                <TableCell className="text-center px-5">
                  <div className="flex items-center justify-center gap-2.5">
                    <span
                      title={
                        model.max_tools > 0
                          ? `Tools Enabled (${model.max_tools})`
                          : "Tools Disabled"
                      }
                    >
                      <Toolbox
                        size={16}
                        className={clsx(
                          model.max_tools > 0
                            ? "text-zinc-400"
                            : "text-zinc-700",
                        )}
                        weight={model.max_tools > 0 ? "fill" : "regular"}
                      />
                    </span>
                    <span
                      title={
                        model.max_image_attachments > 0
                          ? `Vision Enabled (${model.max_image_attachments} imgs)`
                          : "Vision Disabled"
                      }
                    >
                      <Panorama
                        size={16}
                        className={clsx(
                          model.max_image_attachments > 0
                            ? "text-zinc-400"
                            : "text-zinc-700",
                        )}
                        weight={
                          model.max_image_attachments > 0 ? "fill" : "regular"
                        }
                      />
                    </span>
                    <span
                      title={
                        model.isReasoning
                          ? "Reasoning Enabled"
                          : "Reasoning Disabled"
                      }
                    >
                      <Brain
                        size={16}
                        className={clsx(
                          model.isReasoning ? "text-zinc-400" : "text-zinc-700",
                        )}
                        weight={model.isReasoning ? "fill" : "regular"}
                      />
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  className={clsx(
                    "text-right px-5",
                    model.nodeCount > 0 ? "text-zinc-400" : "text-zinc-600",
                  )}
                >
                  {model.nodeCount}
                </TableCell>
                <TableCell className="text-right px-5">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(model)}
                      disabled={isLoading}
                      className="p-1.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-50 transition-colors rounded-md hover:bg-zinc-800"
                      title="Edit Model"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(model)}
                      disabled={isLoading}
                      className={clsx(
                        "p-1.5 disabled:opacity-50 transition-colors rounded-md hover:bg-zinc-800",
                        model.status === "Active"
                          ? "text-zinc-400 hover:text-zinc-200" // Pause
                          : "text-zinc-500 hover:text-zinc-100", // Play
                      )}
                      title={
                        model.status === "Active"
                          ? "Pause Model"
                          : "Activate Model"
                      }
                    >
                      {model.status === "Active" ? (
                        <Pause size={16} />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ModelsTab;
