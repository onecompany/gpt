import React from "react";
import clsx from "clsx";
import {
  CaretUpIcon,
  CaretDownIcon,
  CheckCircleIcon,
  CircleIcon,
  FolderNotchIcon,
  MagnifyingGlassIcon,
  UploadIcon,
  FolderPlusIcon,
} from "@phosphor-icons/react";
import { FileItemCard } from "./FileItemCard";
import { FileListItem } from "./FileListItem";
import { FilesEmptyState } from "./FilesEmptyState";
import type {
  FileItem,
  Folder,
  GlobalSearchResult,
  IndexingStatus,
  IndexingProgress,
} from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { ChunkView } from "./ChunkView";
import { FileId } from "@/types/brands";

type SortField = "name" | "size" | "uploadedAt" | "type";
type SortOrder = "asc" | "desc";
type ViewMode = "grid" | "list" | "chunks";

interface FileListProps {
  folders: Folder[];
  files: FileItem[];
  selectedItems: Set<string>; // Strings = IDs
  viewMode: ViewMode;
  isMobile: boolean;
  debouncedSearchQuery: string;
  sortField: SortField;
  sortOrder: SortOrder;
  searchResults: GlobalSearchResult[] | null;
  isChunkSearching: boolean;
  indexingStatus: IndexingStatus;
  indexingProgress: IndexingProgress | null;
  indexingError: string | null;
  onSortChange: (field: SortField) => void;
  onItemSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onFolderOpen: (folder: Folder) => void;
  onFileView: (fileOrFileId: FileItem | FileId) => void;
  onRename: (id: string, isFolder: boolean) => void;
  onDelete: (id: string, isFolder: boolean) => void;
  onDownload: (file: FileItem) => void;
  onCreateFolder: () => void;
  onUpload: () => void;
}

const listHeaders: {
  key: SortField;
  label: string;
  className?: string;
  thClassName?: string;
}[] = [
  { key: "name", label: "Name", className: "w-2/5", thClassName: "text-left" },
  {
    key: "uploadedAt",
    label: "Modified",
    className: "w-1/5",
    thClassName: "text-left",
  },
  { key: "size", label: "Size", className: "w-1/5", thClassName: "text-left" },
  { key: "type", label: "Type", className: "w-1/5", thClassName: "text-left" },
];

export const FileList: React.FC<FileListProps> = ({
  folders,
  files,
  selectedItems,
  viewMode,
  isMobile,
  debouncedSearchQuery,
  sortField,
  sortOrder,
  searchResults,
  isChunkSearching,
  indexingStatus,
  indexingProgress,
  indexingError,
  onSortChange,
  onItemSelect,
  onSelectAll,
  onClearSelection,
  onFolderOpen,
  onFileView,
  onRename,
  onDelete,
  onDownload,
  onCreateFolder,
  onUpload,
}) => {
  const allItems = [...folders, ...files];
  const hasSelection = selectedItems.size > 0;

  if (viewMode === "chunks") {
    return (
      <ChunkView
        searchQuery={debouncedSearchQuery}
        searchResults={searchResults}
        isSearching={isChunkSearching}
        onFileView={(fileId) => onFileView(fileId)}
        indexingStatus={indexingStatus}
        indexingProgress={indexingProgress}
        indexingError={indexingError}
      />
    );
  }

  if (allItems.length === 0) {
    if (debouncedSearchQuery) {
      return (
        <FilesEmptyState
          icon={MagnifyingGlassIcon}
          title="No results found"
          description={`No files or folders matched "${debouncedSearchQuery}".`}
        />
      );
    }

    return (
      <FilesEmptyState
        icon={FolderNotchIcon}
        title="No files yet"
        description="Upload documents or create folders to organize your workspace."
        actions={
          <>
            <button
              onClick={onCreateFolder}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm font-medium transition-colors border border-zinc-700 hover:border-zinc-600  focus:ring-0"
            >
              <FolderPlusIcon size={18} />
              New Folder
            </button>
            <button
              onClick={onUpload}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg text-sm font-medium transition-colors shadow-sm  focus:ring-0"
            >
              <UploadIcon size={18} />
              Upload Files
            </button>
          </>
        }
      />
    );
  }

  if (viewMode === "grid" || isMobile) {
    return (
      <motion.div
        layout
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 pb-20"
      >
        <AnimatePresence mode="popLayout">
          {folders.map((folder) => (
            <FileItemCard
              key={`folder-${folder.id}`}
              item={folder}
              isSelected={selectedItems.has(folder.id)}
              onSelect={() => onItemSelect(folder.id)}
              onOpen={() => onFolderOpen(folder)}
              onRename={() => onRename(folder.id, true)}
              onDelete={() => onDelete(folder.id, true)}
            />
          ))}
          {files.map((file) => (
            <FileItemCard
              key={`file-${file.id}`}
              item={file}
              isSelected={selectedItems.has(file.id)}
              onSelect={() => onItemSelect(file.id)}
              onOpen={() => onFileView(file)}
              onRename={() => onRename(file.id, false)}
              onDelete={() => onDelete(file.id, false)}
              onDownload={() => onDownload(file)}
              onView={() => onFileView(file)}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-900/30 overflow-visible mb-20">
      <table className="min-w-full table-fixed">
        <thead className="bg-zinc-850/50 backdrop-blur-sm border-b border-zinc-800">
          <tr>
            <th className="w-8 px-2.5 py-2 text-center align-middle">
              <motion.button
                onClick={hasSelection ? onClearSelection : onSelectAll}
                className="text-zinc-400 hover:text-zinc-200 p-0.5 flex items-center justify-center h-full w-full cursor-pointer  focus-visible:outline-none focus-visible:ring-0 rounded"
              >
                {hasSelection ? (
                  <CheckCircleIcon size={16} weight="fill" />
                ) : (
                  <CircleIcon size={16} weight="regular" />
                )}
              </motion.button>
            </th>
            {listHeaders.map((header) => (
              <th
                key={header.key}
                className={clsx(
                  "px-3 py-2 text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-zinc-200 align-middle select-none",
                  header.thClassName,
                  header.className,
                )}
                onClick={() => onSortChange(header.key)}
              >
                <div className="flex items-center gap-1.5 group">
                  <span>{header.label}</span>
                  {sortField === header.key &&
                    (sortOrder === "asc" ? (
                      <CaretUpIcon
                        size={12}
                        weight="bold"
                        className="text-zinc-300"
                      />
                    ) : (
                      <CaretDownIcon
                        size={12}
                        weight="bold"
                        className="text-zinc-300"
                      />
                    ))}
                </div>
              </th>
            ))}
            <th className="w-10 px-1.5 py-2 align-middle"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          <AnimatePresence mode="popLayout">
            {folders.map((folder) => (
              <FileListItem
                key={`folder-${folder.id}`}
                item={folder}
                isSelected={selectedItems.has(folder.id)}
                onSelect={() => onItemSelect(folder.id)}
                onOpen={() => onFolderOpen(folder)}
                onRename={() => onRename(folder.id, true)}
                onDelete={() => onDelete(folder.id, true)}
              />
            ))}
            {files.map((file) => (
              <FileListItem
                key={`file-${file.id}`}
                item={file}
                isSelected={selectedItems.has(file.id)}
                onSelect={() => onItemSelect(file.id)}
                onOpen={() => onFileView(file)}
                onRename={() => onRename(file.id, false)}
                onDelete={() => onDelete(file.id, false)}
                onDownload={() => onDownload(file)}
                onView={() => onFileView(file)}
              />
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
};
