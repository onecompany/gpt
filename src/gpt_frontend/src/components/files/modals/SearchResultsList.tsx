import React from "react";
import { AnimatePresence } from "framer-motion";
import { CircleNotch } from "@phosphor-icons/react";
import type { SearchResult } from "@/types";
import { SearchResultItem } from "./SearchResultItem";

interface SearchResultsListProps {
  results: SearchResult[];
  isSearching: boolean;
  query: string;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  results,
  isSearching,
  query,
}) => {
  if (isSearching) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <CircleNotch size={24} className="text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">No results found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <AnimatePresence>
        {results.map((result) => (
          <SearchResultItem key={result.id} result={result} query={query} />
        ))}
      </AnimatePresence>
    </div>
  );
};

SearchResultsList.displayName = "SearchResultsList";
