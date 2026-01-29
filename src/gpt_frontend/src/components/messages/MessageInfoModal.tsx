import React, { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Cpu, CalendarBlank, ChartBar, Coins } from "@phosphor-icons/react";
import { Message } from "@/types";
import { useModelsStore } from "@/store/modelsStore";

interface MessageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message;
}

const formatCost = (cost: number) => {
  if (cost === 0) return "$0.00";
  if (cost < 0.000001) return "< $0.000001";
  return `$${cost.toFixed(6)}`;
};

const InfoRow = ({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
}) => (
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 ring-1 ring-inset ring-zinc-700/50">
      <Icon size={18} />
    </div>
    <div>
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-sm font-medium text-zinc-200">{value}</p>
        {subValue && <span className="text-xs text-zinc-500">{subValue}</span>}
      </div>
    </div>
  </div>
);

export const MessageInfoModal: React.FC<MessageInfoModalProps> = ({
  isOpen,
  onClose,
  message,
}) => {
  const { models } = useModelsStore();
  const model = models.find((m) => m.modelId === message.modelId);

  const promptTokens = message.usage?.prompt_tokens || 0;
  const completionTokens = message.usage?.completion_tokens || 0;
  const totalTokens = message.usage?.total_tokens || 0;

  const cost = model
    ? (promptTokens / 1_000_000) * model.inputTokenPrice +
      (completionTokens / 1_000_000) * model.outputTokenPrice
    : 0;

  const dateStr = new Date(message.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-xl bg-zinc-875 shadow-2xl ring-1 ring-zinc-800 transition-all text-left">
                {/* Header matching SettingsHeader style */}
                <div className="flex items-center justify-between border-b border-zinc-750 px-5 py-3">
                  <Dialog.Title className="text-base font-semibold text-zinc-100">
                    Message Info
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-zinc-400 hover:text-zinc-200  cursor-pointer"
                  >
                    <X size={16} weight="bold" />
                  </button>
                </div>

                {/* Content matching Settings styling (clean rows) */}
                <div className="px-5 py-5 space-y-5">
                  <InfoRow
                    icon={Cpu}
                    label="Model"
                    value={model?.name || message.modelId || "Unknown"}
                    subValue={model?.provider}
                  />

                  <InfoRow
                    icon={CalendarBlank}
                    label="Timestamp"
                    value={dateStr}
                  />

                  <InfoRow
                    icon={Coins}
                    label="Est. Cost"
                    value={formatCost(cost)}
                  />

                  {/* Token Usage Section */}
                  <div className="pt-1">
                    <div className="flex items-center gap-2 mb-2.5">
                      <ChartBar size={14} className="text-zinc-500" />
                      <span className="text-xs font-medium text-zinc-400">
                        Token Usage
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-px bg-zinc-750 rounded-lg overflow-hidden border border-zinc-750">
                      <div className="bg-zinc-800 p-2.5 flex flex-col items-center justify-center">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">
                          Input
                        </span>
                        <span className="text-sm text-zinc-200">
                          {promptTokens}
                        </span>
                      </div>
                      <div className="bg-zinc-800 p-2.5 flex flex-col items-center justify-center">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">
                          Output
                        </span>
                        <span className="text-sm text-zinc-200">
                          {completionTokens}
                        </span>
                      </div>
                      <div className="bg-zinc-800 p-2.5 flex flex-col items-center justify-center">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">
                          Total
                        </span>
                        <span className="text-sm text-zinc-100 font-medium">
                          {totalTokens}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

MessageInfoModal.displayName = "MessageInfoModal";
