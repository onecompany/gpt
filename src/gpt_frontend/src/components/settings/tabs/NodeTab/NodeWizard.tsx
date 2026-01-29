import React, { useState } from "react";
import clsx from "clsx";
import { CaretRight } from "@phosphor-icons/react";
import { Model } from "@/types";
import {
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_SELECT_CLASS,
} from "@/styles/formStyles";
import { cn } from "@/utils/utils";

interface NodeWizardProps {
  hostname: string;
  modelId: string;
  apiKey: string;
  chipId: string;
  hostIdentity: string;
  availableModels: Model[];
  isLoading: boolean;
  onHostnameChange: (val: string) => void;
  onModelIdChange: (val: string) => void;
  onApiKeyChange: (val: string) => void;
  onChipIdChange: (val: string) => void;
  onHostIdentityChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirm: () => void;
}

const NodeWizard: React.FC<NodeWizardProps> = ({
  hostname,
  modelId,
  apiKey,
  chipId,
  hostIdentity,
  availableModels,
  isLoading,
  onHostnameChange,
  onModelIdChange,
  onApiKeyChange,
  onChipIdChange,
  onHostIdentityChange,
  onConfirm,
}) => {
  const [localState, setLocalState] = useState(() => {
    let initialModelId = modelId;
    if (!initialModelId && availableModels.length > 0) {
      initialModelId = availableModels[0].modelId;
    }
    return {
      hostname,
      modelId: initialModelId,
      apiKey,
      chipId,
    };
  });

  const handleHostnameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalState((prev) => ({ ...prev, hostname: value }));
    onHostnameChange(value);
  };

  const handleModelIdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setLocalState((prev) => ({ ...prev, modelId: value }));
    onModelIdChange(value);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalState((prev) => ({ ...prev, apiKey: value }));
    onApiKeyChange(value);
  };

  const handleChipIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalState((prev) => ({ ...prev, chipId: value }));
    onChipIdChange(value);
  };

  const isFormValid =
    localState.hostname.trim() !== "" &&
    localState.modelId.trim() !== "" &&
    localState.apiKey.trim() !== "" &&
    localState.chipId.trim() !== "" &&
    hostIdentity.trim() !== "";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
          To register a new node with GPT Protocol and begin earning rewards,
          provide the required details below. For detailed setup instructions,
          refer to our{" "}
          <a
            href="https://github.com/onecompany/gpt"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-zinc-300 hover:text-zinc-100"
          >
            repository
          </a>
          . Ensure the provided hostname is publicly accessible and resolves to
          your node’s IP address and port.
        </p>
        <div className="flex flex-col space-y-4">
          <div className="flex gap-4 flex-col sm:flex-row">
            <div className="flex-1">
              <label htmlFor="node-hostname" className={FORM_LABEL_CLASS}>
                Node Hostname
              </label>
              <input
                id="node-hostname"
                type="text"
                value={localState.hostname}
                onChange={handleHostnameChange}
                placeholder="node1.mydomain.com"
                className={FORM_INPUT_CLASS}
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                The public domain name of this node.
              </p>
            </div>
            <div className="flex-1">
              <label htmlFor="node-host-identity" className={FORM_LABEL_CLASS}>
                Host Identity
              </label>
              <input
                id="node-host-identity"
                type="text"
                value={hostIdentity}
                onChange={onHostIdentityChange}
                placeholder="age1..."
                className={FORM_INPUT_CLASS}
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                The age identity string from &apos;./gpt_host id&apos;.
              </p>
            </div>
            <div className="flex-1">
              <label htmlFor="node-chip-id" className={FORM_LABEL_CLASS}>
                Expected Chip ID (Hex)
              </label>
              <input
                id="node-chip-id"
                type="text"
                value={localState.chipId}
                onChange={handleChipIdChange}
                placeholder="Fetched on host"
                className={FORM_INPUT_CLASS}
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                Hardware ID for attestation.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col space-y-4">
          <div className="flex gap-4 flex-col sm:flex-row">
            <div className="flex-1">
              <label htmlFor="node-model" className={FORM_LABEL_CLASS}>
                Model
              </label>
              <select
                id="node-model"
                value={localState.modelId}
                onChange={handleModelIdChange}
                className={FORM_SELECT_CLASS}
              >
                <option value="" disabled>
                  Select a Model
                </option>
                {availableModels.map((model) => (
                  <option key={model.modelId} value={model.modelId}>
                    {model.name} ({model.modelId})
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 mt-1.5">
                Choose the AI model this node will serve.
              </p>
            </div>
            <div className="flex-1">
              <label htmlFor="node-api-key" className={FORM_LABEL_CLASS}>
                Provider API Key
              </label>
              <input
                id="node-api-key"
                type="password"
                value={localState.apiKey}
                onChange={handleApiKeyChange}
                placeholder="Enter provider API key"
                className={FORM_INPUT_CLASS}
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                API keys are stored securely on the index.
              </p>
            </div>
            <div className="flex-1">
              <label
                htmlFor="node-contract-length"
                className={FORM_LABEL_CLASS}
              >
                Contract Length
              </label>
              <select
                id="node-contract-length"
                disabled
                className={cn(FORM_SELECT_CLASS, "text-zinc-500 ")}
              >
                <option value="7">7 Days (Default)</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days</option>
              </select>
              <p className="text-xs text-zinc-500 mt-1.5">
                Future commitment duration.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-5 border-t border-zinc-750 py-3 flex justify-end">
        <button
          onClick={onConfirm}
          disabled={!isFormValid || isLoading}
          className={clsx(
            "text-sm font-medium flex items-center gap-1.5  focus:ring-0",
            !isFormValid || isLoading
              ? "text-zinc-500 "
              : "text-zinc-100 hover:text-zinc-200 cursor-pointer",
          )}
        >
          {isLoading ? "Creating..." : "Create Node"}
          {!isLoading && <CaretRight size={14} weight="bold" />}
        </button>
      </div>
    </div>
  );
};

export default NodeWizard;
