import React, { memo, useMemo } from "react";
import { RadioGroup } from "@headlessui/react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  CircleNotch,
  XCircle,
  Cube,
  TextColumns,
  CurrencyDollar,
  Panorama,
  Toolbox,
} from "@phosphor-icons/react";
import { Icons, ModelIcons } from "@/components/icons";
import { Model, ModelType } from "@/types";
import { useModelsStore } from "@/store/modelsStore";
import { useChatStore } from "@/store/chatStore";
import {
  Dropdown,
  DropdownTrigger,
  DropdownTransition,
} from "@/components/ui/Dropdown";

const formatPrice = (price: number): string => {
  const pricePerMillion = price * 1_000_000;
  return pricePerMillion.toFixed(2);
};

const getLogo = (type: ModelType, className?: string) => {
  const IconComponent = ModelIcons[type] || Icons.robot;
  return (
    <IconComponent
      weight="regular"
      size="1.125rem"
      className={className || "text-zinc-400"}
    />
  );
};

const ModelDetail = memo(
  ({ icon, text }: { icon: React.ReactNode; text: string }) => (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="text-zinc-400 shrink-0">{icon}</div>
      <span className="text-sm text-zinc-400 truncate">{text}</span>
    </div>
  ),
);
ModelDetail.displayName = "ModelDetail";

const ModelPricingDetail = memo(
  ({
    inputPrice,
    outputPrice,
  }: {
    inputPrice: number;
    outputPrice: number;
  }) => (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="text-zinc-400 shrink-0">
        <CurrencyDollar size={16} />
      </div>
      <div className="flex items-center gap-2 text-sm text-zinc-400 truncate">
        <span>
          ${formatPrice(inputPrice)}/M in, ${formatPrice(outputPrice)}/M out
        </span>
      </div>
    </div>
  ),
);
ModelPricingDetail.displayName = "ModelPricingDetail";

const ModelSelectorItem = memo(({ model }: { model: Model }) => {
  const ModelIcon = ModelIcons[model.maker] || Icons.robot;

  return (
    <RadioGroup.Option
      value={model}
      className={({ active, checked }) =>
        clsx(
          "relative w-full text-left cursor-pointer  rounded-lg select-none group duration-150 ease-in-out",
          checked || active ? "bg-zinc-775" : "hover:bg-zinc-775",
        )
      }
    >
      {({ checked }) => (
        <div className="px-2 py-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={clsx(
                  "shrink-0",
                  checked
                    ? "text-zinc-200"
                    : "text-zinc-400 group-hover:text-zinc-200",
                )}
              >
                <ModelIcon size="1.125rem" />
              </div>
              <p
                className={clsx(
                  "text-sm truncate",
                  checked
                    ? "text-zinc-50 font-medium"
                    : "text-zinc-200 group-hover:text-zinc-50",
                )}
              >
                {model.name}
              </p>

              <div
                className={clsx(
                  "flex items-center gap-1.5 shrink-0",
                  checked
                    ? "text-zinc-400"
                    : "text-zinc-500 group-hover:text-zinc-400",
                )}
              >
                {model.max_tools > 0 && <Toolbox size={14} weight="bold" />}
                {model.max_image_attachments > 0 && (
                  <Panorama size={14} weight="bold" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-center w-5 h-5 shrink-0 ml-2">
              <div
                className={clsx(
                  "w-3.5 h-3.5 rounded-full border-[1.5px] p-0.5 flex items-center justify-center",
                  checked
                    ? "border-zinc-200"
                    : "border-zinc-600 group-hover:border-zinc-500",
                )}
              >
                <AnimatePresence>
                  {checked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="w-full h-full bg-zinc-200 rounded-full"
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {checked && (
              <motion.div
                key="details"
                initial="collapsed"
                animate="open"
                exit="collapsed"
                variants={{
                  open: { height: "auto", opacity: 1, marginTop: 6 },
                  collapsed: { height: 0, opacity: 0, marginTop: 0 },
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="pl-0.5 space-y-1.5 pt-2">
                  <ModelDetail
                    icon={<TextColumns size={16} />}
                    text={`Context: ${model.maxContext.toLocaleString()}`}
                  />
                  <ModelPricingDetail
                    inputPrice={model.inputTokenPrice}
                    outputPrice={model.outputTokenPrice}
                  />
                  {model.releaseDate && (
                    <ModelDetail
                      icon={<Icons.calendar size={16} />}
                      text={`Released: ${model.releaseDate}`}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </RadioGroup.Option>
  );
});
ModelSelectorItem.displayName = "ModelSelectorItem";

const SkeletonItem = () => (
  <div className="rounded-lg p-2 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 bg-zinc-800 rounded-full" />
        <div className="h-4 w-32 bg-zinc-800 rounded" />
      </div>
      <div className="h-4 w-12 bg-zinc-800 rounded" />
    </div>
  </div>
);

export const ModelDropdown: React.FC = () => {
  const { models, loading, error } = useModelsStore();
  const { selectedModel, setSelectedModel } = useChatStore();

  const sortedModels = useMemo(() => {
    const activeModels = models.filter((m) => m.status === "Active");
    const compatible = activeModels.filter((model) => model.nodeCount > 0);
    const groups: Record<string, Model[]> = {};

    for (const model of compatible) {
      if (!groups[model.maker]) {
        groups[model.maker] = [];
      }
      groups[model.maker].push(model);
    }

    const makers = Object.keys(groups);

    makers.sort((makerA, makerB) => {
      const maxScoreA = Math.max(...groups[makerA].map((m) => m.aaScore ?? -1));
      const maxScoreB = Math.max(...groups[makerB].map((m) => m.aaScore ?? -1));
      return maxScoreB - maxScoreA;
    });

    return makers.flatMap((maker) =>
      groups[maker].sort((a, b) => {
        const scoreA = a.aaScore ?? -1;
        const scoreB = b.aaScore ?? -1;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.name.localeCompare(b.name);
      }),
    );
  }, [models]);

  const isDisabled = loading || !!error || sortedModels.length === 0;

  const renderTriggerContent = (open: boolean) => {
    if (loading) {
      return (
        <>
          <CircleNotch
            size="1.125rem"
            className="mr-2 animate-spin text-zinc-400"
          />
          <span className="text-sm text-zinc-400">Loading...</span>
        </>
      );
    }
    if (error) {
      return (
        <>
          <XCircle size="1.125rem" className="mr-2 text-red-400" />
          <span className="text-sm text-red-400">Error</span>
        </>
      );
    }
    if (sortedModels.length === 0) {
      return (
        <>
          <XCircle size="1.125rem" className="mr-2 text-zinc-500" />
          <span className="text-sm text-zinc-500">No models available</span>
        </>
      );
    }
    if (selectedModel) {
      return (
        <>
          <div className="flex items-center justify-center mr-0 md:mr-2">
            {getLogo(
              selectedModel.maker,
              open
                ? "text-zinc-200"
                : "text-zinc-400 group-hover:text-zinc-300",
            )}
          </div>
          <span
            className={clsx(
              "truncate text-sm md:flex hidden items-center",
              open
                ? "text-zinc-200"
                : "text-zinc-400 group-hover:text-zinc-300",
            )}
          >
            {selectedModel.name}
          </span>
          <Icons.caretDown
            className={clsx(
              "ml-1.5 hidden md:flex",
              open
                ? "text-zinc-200"
                : "text-zinc-500 group-hover:text-zinc-400",
            )}
            size={16}
            weight="bold"
          />
        </>
      );
    }
    return (
      <>
        <Cube size="1.125rem" className="mr-2 text-zinc-400" />
        <span className="text-sm text-zinc-300">Select model</span>
        <Icons.caretDown
          className="text-zinc-400 ml-1.5"
          size={16}
          weight="bold"
        />
      </>
    );
  };

  return (
    <Dropdown as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <DropdownTrigger
            disabled={isDisabled}
            className={clsx(
              "flex w-full items-center py-1.5 px-2 text-left text-sm font-normal rounded-lg group",
              isDisabled && " opacity-60 bg-transparent hover:bg-transparent",
            )}
            aria-label={
              isDisabled ? "Model selection not available" : "Pick a chat model"
            }
          >
            {renderTriggerContent(open)}
          </DropdownTrigger>

          <DropdownTransition>
            <Dropdown.Items
              className="absolute bg-zinc-825 left-0 mt-2 z-50 w-screen max-w-[18rem] sm:max-w-[20rem] rounded-xl ring-1 ring-zinc-700  shadow-2xl origin-top-left p-1"
              static
            >
              <div className="flex-1 overflow-y-auto max-h-[75vh]">
                <RadioGroup
                  value={selectedModel}
                  onChange={setSelectedModel}
                  aria-label="Chat Models"
                >
                  <div className="relative flex flex-col space-y-0.5">
                    {loading && sortedModels.length === 0 ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonItem key={i} />
                      ))
                    ) : error ? (
                      <div className="text-center text-red-400 p-4 text-sm">
                        {error}
                      </div>
                    ) : (
                      sortedModels.map((model) => (
                        <ModelSelectorItem key={model.modelId} model={model} />
                      ))
                    )}
                  </div>
                </RadioGroup>
              </div>
            </Dropdown.Items>
          </DropdownTransition>
        </>
      )}
    </Dropdown>
  );
};

ModelDropdown.displayName = "ModelDropdown";
