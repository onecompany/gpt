import React from "react";
import { useChatStore } from "@/store/chatStore";
import { CompressionLevel } from "@/types";

const GeneralTab: React.FC = () => {
  const { compressionLevel, setCompressionLevel } = useChatStore();

  const handleCompressionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCompressionLevel(e.target.value as CompressionLevel);
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
