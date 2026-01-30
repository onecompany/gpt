import React from "react";
import {
  DownloadSimple,
  MagnifyingGlass,
  CircleNotch,
  X,
  CaretDown,
  TextT,
  Brain,
  Sparkle,
} from "@phosphor-icons/react";
import { getFileTypeAndIcon, formatFileSize } from "@/utils/fileUtils";
import type { FileItem } from "@/types";
import type { SearchMode } from "@/store/embeddingStore";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/Dropdown";

interface FilePreviewHeaderProps {
  file: FileItem;
  isSearchable: boolean;
  searchQuery: string;
  isSearching: boolean;
  searchMode: SearchMode;
  isEmbeddingAvailable: boolean;
  onSearchChange: (query: string) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onDownload: () => void;
  onClose: () => void;
}

const SEARCH_MODE_CONFIG: Record<
  SearchMode,
  { label: string; icon: typeof TextT; description: string }
> = {
  text: {
    label: "Text",
    icon: TextT,
    description: "Keyword matching (BM25)",
  },
  embedding: {
    label: "Semantic",
    icon: Brain,
    description: "AI-powered meaning search",
  },
  hybrid: {
    label: "Hybrid",
    icon: Sparkle,
    description: "Combined text + semantic",
  },
};

export const FilePreviewHeader: React.FC<FilePreviewHeaderProps> = ({
  file,
  isSearchable,
  searchQuery,
  isSearching,
  searchMode,
  isEmbeddingAvailable,
  onSearchChange,
  onSearchModeChange,
  onDownload,
  onClose,
}) => {
  const { Icon, color } = getFileTypeAndIcon(file.name);
  const fileSize = formatFileSize(file.size);
  const currentModeConfig = SEARCH_MODE_CONFIG[searchMode];
  const CurrentModeIcon = currentModeConfig.icon;

  return (
    <div className="shrink-0 p-3 border-b border-zinc-750 flex items-center justify-between gap-3 min-h-14.25">
      <div className="flex items-center gap-3 min-w-0">
        <Icon size={28} weight="light" className={color} />
        <div className="min-w-0">
          <p
            className="text-sm font-medium text-zinc-100 truncate"
            title={file.name}
          >
            {file.name}
          </p>
          <p className="text-xs text-zinc-400">{fileSize}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isSearchable && (
          <>
            <Dropdown as="div" className="relative">
              <DropdownTrigger className="flex items-center gap-0.5 p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/80 transition-colors">
                <CurrentModeIcon size={16} weight="bold" />
                <CaretDown size={10} weight="bold" />
              </DropdownTrigger>
              <DropdownContent align="start" width="w-40">
                {(Object.keys(SEARCH_MODE_CONFIG) as SearchMode[]).map((mode) => {
                  const config = SEARCH_MODE_CONFIG[mode];
                  const ModeIcon = config.icon;
                  const isDisabled =
                    (mode === "embedding" || mode === "hybrid") &&
                    !isEmbeddingAvailable;
                  const isSelected = mode === searchMode;

                  return (
                    <DropdownItem
                      key={mode}
                      disabled={isDisabled}
                      onClick={() => onSearchModeChange(mode)}
                      className={isSelected ? "bg-zinc-700" : ""}
                    >
                      <ModeIcon size={14} className="mr-1.5 shrink-0" />
                      <span className="text-sm">{config.label}</span>
                      {isDisabled && (
                        <span className="ml-auto text-xs text-zinc-500">N/A</span>
                      )}
                    </DropdownItem>
                  );
                })}
              </DropdownContent>
            </Dropdown>

            <div className="relative w-32 sm:w-48">
              <MagnifyingGlass
                size={16}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              />
              {isSearching && (
                <CircleNotch
                  size={16}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin"
                />
              )}
              <input
                type="search"
                placeholder="Search in file..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-md focus:ring-0 text-sm"
              />
            </div>
          </>
        )}
        <button
          onClick={onDownload}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/80 focus:ring-0"
          aria-label="Download"
        >
          <DownloadSimple size={18} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/80 focus:ring-0"
          aria-label="Close"
        >
          <X size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
};

FilePreviewHeader.displayName = "FilePreviewHeader";
