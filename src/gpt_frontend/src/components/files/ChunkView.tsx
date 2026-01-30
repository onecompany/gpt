import React from "react";
import { AnimatePresence } from "framer-motion";
import {
  CircleNotch,
  MagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  GlobalSearchResult,
  IndexingStatus,
  IndexingProgress,
} from "@/types";
import { ChunkSearchResultItem } from "./ChunkSearchResultItem";
import { FilesEmptyState } from "./FilesEmptyState";
import { FileId } from "@/types/brands";

interface ChunkViewProps {
  searchQuery: string;
  searchResults: GlobalSearchResult[] | null;
  isSearching: boolean;
  onFileView: (fileId: FileId) => void;
  indexingStatus: IndexingStatus;
  indexingProgress: IndexingProgress | null;
  indexingError: string | null;
}

export const ChunkView: React.FC<ChunkViewProps> = ({
  searchQuery,
  searchResults,
  isSearching,
  onFileView,
  indexingStatus,
  indexingProgress,
  indexingError,
}) => {
  // Show results count when we have search results
  const showResultsCount = searchResults && searchResults.length > 0;

  const renderContent = () => {
    if (isSearching) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <CircleNotch size={24} className="text-zinc-500 animate-spin" />
          <p className="text-sm text-zinc-500 mt-2">Searching...</p>
        </div>
      );
    }

    if (indexingStatus === "in-progress" && indexingProgress) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <CircleNotch size={24} className="text-zinc-500 animate-spin" />
          <p className="text-sm font-medium text-zinc-300 mt-2">
            Indexing Files ({indexingProgress.processed}/{indexingProgress.total})
          </p>
          <p className="text-xs text-zinc-500 mt-1 truncate max-w-xs">
            {indexingProgress.currentFile}
          </p>
        </div>
      );
    }

    if (indexingStatus === "error") {
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-center text-red-400">
          <WarningCircle size={32} className="mb-2" />
          <p className="text-sm font-medium">Failed to build search index</p>
          <p className="text-xs text-zinc-500 mt-1">{indexingError}</p>
        </div>
      );
    }

    if (!searchQuery.trim()) {
      return (
        <FilesEmptyState
          icon={MagnifyingGlass}
          title="Search All Files"
          description="Start typing to search the content of all your documents."
        />
      );
    }

    if (searchResults && searchResults.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-zinc-500">No results found.</p>
        </div>
      );
    }

    if (searchResults) {
      return (
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence>
            {searchResults.map((result) => (
              <ChunkSearchResultItem
                key={`${result.id}-${result.fileInfo?.id}`}
                result={result}
                query={searchQuery}
                onFileView={onFileView}
              />
            ))}
          </AnimatePresence>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {showResultsCount && (
        <div className="flex items-center mb-3 shrink-0">
          <span className="text-xs text-zinc-500">
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      {renderContent()}
    </div>
  );
};
