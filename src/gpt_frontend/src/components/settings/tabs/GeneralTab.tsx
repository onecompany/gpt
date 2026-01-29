import React from "react";
import { useChatStore } from "@/store/chatStore";
import { CompressionLevel } from "@/types";
import { Switch } from "@headlessui/react";
import clsx from "clsx";

const GeneralTab: React.FC = () => {
  const { compressionLevel, setCompressionLevel, renderMode, setRenderMode } =
    useChatStore();

  const handleCompressionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCompressionLevel(e.target.value as CompressionLevel);
  };

  const isMarkdownEnabled = renderMode === "markdown";

  const handleRenderModeToggle = () => {
    setRenderMode(isMarkdownEnabled ? "plain" : "markdown");
  };

  return (
    <div className="px-5 py-4 space-y-3.5">
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-750">
        <label className="text-sm font-medium text-zinc-200">Language</label>
        <select
          className="px-1 text-sm text-zinc-200  bg-zinc-875"
          defaultValue="english"
        >
          <option value="english">English</option>
        </select>
      </div>
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-750">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-zinc-200">
            Markdown Rendering
          </label>
          <p className="text-xs text-zinc-400 mt-1">
            Render code, math, and diagrams.
          </p>
        </div>
        <Switch
          checked={isMarkdownEnabled}
          onChange={handleRenderModeToggle}
          className={clsx(
            isMarkdownEnabled ? "bg-zinc-300" : "bg-zinc-700",
            "relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
          )}
        >
          <span
            className={clsx(
              isMarkdownEnabled
                ? "translate-x-5 bg-zinc-900"
                : "translate-x-0 bg-zinc-500",
              "pointer-events-none inline-block h-4 w-4 transform rounded-full shadow transition duration-200",
            )}
          />
        </Switch>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-zinc-200">
            Image Compression
          </label>
          <p className="text-xs text-zinc-400 mt-1">
            Reduces image size before uploading.
          </p>
        </div>
        <select
          value={compressionLevel}
          onChange={handleCompressionChange}
          className="px-1 text-sm text-zinc-200  bg-zinc-875"
        >
          <option value="extreme">Extreme</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="lossless">Lossless</option>
        </select>
      </div>
    </div>
  );
};

export default GeneralTab;
