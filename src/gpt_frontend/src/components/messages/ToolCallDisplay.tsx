import React from "react";
import { CircleNotch, Play, Toolbox } from "@phosphor-icons/react";
import clsx from "clsx";
import { ToolCall } from "@/types";

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
  onRunTools?: () => void;
  isLoading?: boolean;
}

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({
  toolCalls,
  onRunTools,
  isLoading = false,
}) => {
  if (!toolCalls || toolCalls.length === 0) return null;

  const getArgumentsPreview = (args: string): string => {
    try {
      const parsed = JSON.parse(args);
      const keys = Object.keys(parsed);
      if (keys.length === 0) return "()";
      const value = parsed[keys[0]];
      if (typeof value === "string" && value.length > 20) {
        return `(${keys[0]}: "${value.substring(0, 20)}...")`;
      }
      return `(${keys[0]}: ${JSON.stringify(value)})`;
    } catch {
      return args.length > 30 ? `(${args.substring(0, 30)}...)` : `(${args})`;
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 flex-wrap">
        <Toolbox size={14} className="text-zinc-500" />
        <span className="text-sm text-zinc-400">
          {toolCalls.length === 1 ? "Using tool" : "Using tools"}:
        </span>
        {toolCalls.map((call) => (
          <div
            key={call.id}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 
                     bg-zinc-850 border border-zinc-700 rounded-full
                     transition-all duration-100 hover:bg-zinc-800 hover:text-zinc-200 text-zinc-350 cursor-pointer"
          >
            <span className="text-xs">{call.function.name}:</span>
            <span className="text-xs text-zinc-400">
              {getArgumentsPreview(call.function.arguments)}
            </span>
          </div>
        ))}
      </div>

      {onRunTools && (
        <div className="flex items-center mt-3">
          <button
            onClick={onRunTools}
            disabled={isLoading}
            className={clsx(
              "inline-flex items-center gap-1.5 px-3 py-1.5 cursor-pointer",
              "text-xs font-medium rounded-lg",
              "transition-all duration-200",
              isLoading
                ? "bg-zinc-800/30 text-zinc-600 "
                : "bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 hover:text-zinc-100 ",
              "border border-zinc-700/50",
            )}
          >
            {isLoading ? (
              <>
                <CircleNotch size={12} className="animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play size={12} weight="bold" />
                Run {toolCalls.length > 1 ? ` ${toolCalls.length} ` : " "} tools
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

ToolCallDisplay.displayName = "ToolCallDisplay";
