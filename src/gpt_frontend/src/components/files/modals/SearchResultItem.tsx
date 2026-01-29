import React from "react";
import { motion } from "framer-motion";
import type { SearchResult } from "@/types";
import { SearchHighlight } from "@/components/ui";

interface SearchResultItemProps {
  result: SearchResult;
  query: string;
}

export const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  query,
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="p-3 border-b border-zinc-800 last:border-b-0"
    >
      <div className="flex justify-between items-baseline mb-1.5 text-xs">
        <span className="text-zinc-500">Chunk #{result.id + 1}</span>
        <span className="text-zinc-400">
          Score: {result.rrf_score.toFixed(4)}
        </span>
      </div>
      <SearchHighlight text={result.text} query={query} />
    </motion.div>
  );
};

SearchResultItem.displayName = "SearchResultItem";
