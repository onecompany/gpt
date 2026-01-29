import React from "react";
import { X } from "@phosphor-icons/react";

interface NodeProviderRowProps {
  index: number;
  provider: string;
  apiKey: string;
  availableProviders: string[];
  onProviderChange: (newProvider: string) => void;
  onApiKeyChange: (newApiKey: string) => void;
  onRemove: () => void;
  showRemove: boolean;
}

const NodeProviderRow: React.FC<NodeProviderRowProps> = ({
  provider,
  apiKey,
  availableProviders,
  onProviderChange,
  onApiKeyChange,
  onRemove,
  showRemove,
}) => {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1/4">
        <select
          value={provider}
          onChange={(e) => onProviderChange(e.target.value)}
          className="w-full px-2 py-1.25 rounded-md bg-zinc-800 text-sm text-zinc-200 placeholder-zinc-500  appearance-none"
        >
          {availableProviders.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <input
          type="text"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="API Key"
          className="w-full px-2 py-1.25 rounded-md bg-zinc-800 text-sm text-zinc-200 placeholder-zinc-500 "
        />
        {showRemove && (
          <button onClick={onRemove} className="text-zinc-400">
            <X size={14} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
};

export default NodeProviderRow;
