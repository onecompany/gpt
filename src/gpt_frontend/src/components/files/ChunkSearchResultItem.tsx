import React from "react";
import { motion } from "framer-motion";
import type { GlobalSearchResult } from "@/types";
import { SearchHighlight } from "@/components/ui";
import { getFileTypeAndIcon } from "@/utils/fileUtils";
import { FileId } from "@/types/brands";

interface ChunkSearchResultItemProps {
  result: GlobalSearchResult;
  query: string;
  onFileView: (fileId: FileId) => void;
}

export const ChunkSearchResultItem: React.FC<ChunkSearchResultItemProps> = ({
  result,
  query,
  onFileView,
}) => {
  const { Icon, color } = result.fileInfo
    ? getFileTypeAndIcon(result.fileInfo.name)
    : { Icon: () => null, color: "" };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="p-3 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-850"
    >
      <div className="flex justify-between items-center mb-2">
        {result.fileInfo && (
          <button
            onClick={() => onFileView(result.fileInfo!.id)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 group cursor-pointer"
          >
            <Icon size={14} className={`${color} shrink-0`} />
            <span
              className="font-medium text-zinc-300 group-hover:underline truncate"
              title={result.fileInfo.name}
            >
              {result.fileInfo.name}
            </span>
          </button>
        )}
        <span className="text-xs  text-zinc-500">
          Score: {result.rrf_score.toFixed(4)}
        </span>
      </div>
      <SearchHighlight text={result.text} query={query} />
    </motion.div>
  );
};
