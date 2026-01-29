import React from "react";
import { useChatStore } from "@/store/chatStore";
import { CircleNotch, Play } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { MessageId } from "@/types/brands";

interface ToolActionBarProps {
  chatId: string;
  assistantMessageId: string;
}

export const ToolActionBar: React.FC<ToolActionBarProps> = ({
  chatId,
  assistantMessageId,
}) => {
  const compositeKey = `${chatId}:${assistantMessageId}`;
  const isLoading = useChatStore(
    (state) => state.isProcessingTools[compositeKey] ?? false,
  );
  const runAndContinueFromTools = useChatStore(
    (state) => state.runAndContinueFromTools,
  );

  const handleRun = () => {
    if (isLoading) return;
    runAndContinueFromTools(chatId, assistantMessageId);
  };

  return (
    <div className="mt-3">
      <motion.button
        onClick={handleRun}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium duration-150 text-zinc-100 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-wait  focus-visible:outline-none focus-visible:ring-0"
        whileTap={{ scale: isLoading ? 1 : 0.97 }}
      >
        {isLoading ? (
          <>
            <CircleNotch
              size={16}
              weight="bold"
              className="animate-spin text-zinc-400"
            />
            <span>Running...</span>
          </>
        ) : (
          <>
            <Play size={16} weight="bold" />
            <span>Run Tools</span>
          </>
        )}
      </motion.button>
    </div>
  );
};

ToolActionBar.displayName = "ToolActionBar";
