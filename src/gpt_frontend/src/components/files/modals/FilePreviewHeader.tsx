import React from "react";
import {
  DownloadSimple,
  MagnifyingGlass,
  CircleNotch,
  X,
} from "@phosphor-icons/react";
import { getFileTypeAndIcon, formatFileSize } from "@/utils/fileUtils";
import type { FileItem } from "@/types";

interface FilePreviewHeaderProps {
  file: FileItem;
  isSearchable: boolean;
  searchQuery: string;
  isSearching: boolean;
  onSearchChange: (query: string) => void;
  onDownload: () => void;
  onClose: () => void;
}

export const FilePreviewHeader: React.FC<FilePreviewHeaderProps> = ({
  file,
  isSearchable,
  searchQuery,
  isSearching,
  onSearchChange,
  onDownload,
  onClose,
}) => {
  const { Icon, color } = getFileTypeAndIcon(file.name);
  const fileSize = formatFileSize(file.size);

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
          <div className="relative w-32 sm:w-64">
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
              className="w-full pl-8 pr-2 py-1.5 bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-md  focus:ring-0 text-sm"
            />
          </div>
        )}
        <button
          onClick={onDownload}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/80  focus:ring-0"
          aria-label="Download"
        >
          <DownloadSimple size={18} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/80  focus:ring-0"
          aria-label="Close"
        >
          <X size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
};

FilePreviewHeader.displayName = "FilePreviewHeader";
