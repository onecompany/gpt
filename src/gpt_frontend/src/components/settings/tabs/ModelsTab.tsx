import React, { useEffect, useState, useMemo } from "react";
import { useModelsStore } from "@/store/modelsStore";
import { CircleNotch } from "@phosphor-icons/react";
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
import { ContentTabs } from "@/components/ui/ContentTabs";

const formatPrice = (price: number): string => {
  const pricePerMillion = price * 1_000_000;
  if (pricePerMillion < 0.01 && pricePerMillion > 0) {
    return pricePerMillion.toExponential(2);
  }
  return pricePerMillion.toFixed(2);
};

type TabValue = "all" | "vision" | "tools" | "reasoning";

const ModelsTab: React.FC = () => {
  const { models, loading, error, hasFetched, fetchModels } = useModelsStore();
  const [activeTab, setActiveTab] = useState<TabValue>("all");

  useEffect(() => {
    // Ensure data is fetched when this tab mounts
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

  const filteredModels = useMemo(() => {
    return sortedModels.filter((model) => {
      switch (activeTab) {
        case "vision":
          return model.max_image_attachments > 0;
        case "tools":
          return model.max_tools > 0;
        case "reasoning":
          return model.isReasoning;
        case "all":
        default:
          return true;
      }
    });
  }, [sortedModels, activeTab]);

  return (
    <div className="flex flex-col w-full h-full">
      <ContentTabs
        activeTab={activeTab}
        onTabChange={(val) => setActiveTab(val as TabValue)}
        tabs={[
          { value: "all", label: "All" },
          { value: "vision", label: "Vision" },
          { value: "tools", label: "Tools" },
          { value: "reasoning", label: "Reasoning" },
        ]}
      >
        {!loading && (
          <span className="text-sm text-zinc-500">
            {filteredModels.length} Available
          </span>
        )}
      </ContentTabs>

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
            {/* UX Fix: Only show spinner if loading AND we have no data yet */}
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
            {!loading && hasFetched && filteredModels.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-sm text-center text-zinc-500"
                >
                  {activeTab === "all"
                    ? "No models have been added to the protocol."
                    : `No ${activeTab} models found.`}
                </TableCell>
              </TableRow>
            )}
            {filteredModels.map((model) => (
              <TableRow key={model.modelId}>
                <TableCell
                  className="truncate max-w-50 px-5"
                  title={model.name}
                >
                  {model.name}
                </TableCell>
                <TableCell className="text-zinc-300 px-5">
                  {model.provider}
                </TableCell>
                <TableCell className="text-zinc-400 text-right px-5">
                  {model.maxContext.toLocaleString()}
                </TableCell>
                <TableCell className="text-zinc-400 text-right px-5">
                  {model.maxOutput.toLocaleString()}
                </TableCell>
                <TableCell className="text-zinc-400 text-center px-5">
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
                    model.nodeCount > 0 ? "text-zinc-400" : "text-zinc-500",
                  )}
                >
                  {model.nodeCount}
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
