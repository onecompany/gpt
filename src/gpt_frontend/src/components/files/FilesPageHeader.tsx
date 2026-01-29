import React from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import clsx from "clsx";
import {
  MagnifyingGlass,
  Upload,
  List,
  GridFour,
  FolderPlus,
  Trash,
  ListMagnifyingGlass,
} from "@phosphor-icons/react";

type ViewMode = "grid" | "list" | "chunks";

interface FilesPageHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  hasSelection: boolean;
  selectionCount: number;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  isMobile: boolean;
}

const SegmentedControl: React.FC<{
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}> = ({ viewMode, onViewModeChange }) => (
  <div
    role="radiogroup"
    aria-label="View mode"
    className="flex items-center rounded-lg bg-zinc-800 p-0.5"
  >
    {[
      { mode: "grid", Icon: GridFour, label: "Grid view" },
      { mode: "list", Icon: List, label: "List view" },
      { mode: "chunks", Icon: ListMagnifyingGlass, label: "Chunks view" },
    ].map(({ mode, Icon, label }) => (
      <motion.button
        key={mode}
        role="radio"
        aria-checked={viewMode === mode}
        onClick={() => onViewModeChange(mode as ViewMode)}
        className={clsx(
          "relative px-3 py-1.5 rounded-md duration-200  focus-visible:outline-none focus-visible:ring-0 cursor-pointer",
          viewMode !== mode && "hover:text-zinc-200",
        )}
        aria-label={label}
      >
        {viewMode === mode && (
          <motion.div
            layoutId="view-mode-active-bg"
            className="absolute inset-0 bg-zinc-700 rounded-md"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Icon
          size={18}
          weight="regular"
          className={clsx(
            "relative z-10",
            viewMode === mode ? "text-zinc-100" : "text-zinc-400",
          )}
        />
      </motion.button>
    ))}
  </div>
);

const DefaultActions: React.FC<{
  isMobile: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onCreateFolder: () => void;
  onUpload: () => void;
}> = ({ isMobile, viewMode, onViewModeChange, onCreateFolder, onUpload }) => (
  <motion.div
    initial={{ opacity: 0, x: 5 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 5 }}
    transition={{ duration: 0.15, ease: "easeInOut" }}
    className="flex items-center gap-2"
  >
    {!isMobile && (
      <SegmentedControl
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />
    )}
    <motion.button
      onClick={onCreateFolder}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 rounded-lg duration-200 text-sm font-medium  focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
      aria-label="New Folder"
    >
      <FolderPlus weight="regular" size={16} />
      {!isMobile && "New Folder"}
    </motion.button>
    <motion.button
      onClick={onUpload}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg duration-200 text-sm font-medium  focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
      aria-label="Upload Files"
    >
      <Upload weight="regular" size={16} />
      {!isMobile && "Upload"}
    </motion.button>
  </motion.div>
);

const SelectionActions: React.FC<{
  selectionCount: number;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
}> = ({ selectionCount, onClearSelection, onDeleteSelected }) => (
  <motion.div
    initial={{ opacity: 0, x: 5 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 5 }}
    transition={{ duration: 0.15, ease: "easeInOut" }}
    className="flex items-center gap-3"
  >
    <span className="text-sm text-zinc-400 font-medium">
      {selectionCount} selected
    </span>
    <button
      onClick={onClearSelection}
      className="text-sm text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded-md  focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
    >
      Clear
    </button>
    <motion.button
      onClick={onDeleteSelected}
      className="p-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 rounded-lg duration-200  focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
      aria-label="Delete Selected Items"
    >
      <Trash size={16} weight="regular" />
    </motion.button>
  </motion.div>
);

export const FilesPageHeader: React.FC<FilesPageHeaderProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onCreateFolder,
  onUpload,
  hasSelection,
  selectionCount,
  onClearSelection,
  onDeleteSelected,
  isMobile,
}) => {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 10, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.25,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className="shrink-0 pt-3.5 pb-2">
      <motion.div
        className="flex items-center gap-3 h-9"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          variants={itemVariants}
          className="relative flex-1 min-w-30"
        >
          <MagnifyingGlass
            weight="regular"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
          />
          <input
            type="search"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-2 py-1.5 bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-md  focus-visible:outline-none focus-visible:ring-0 text-sm"
          />
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="flex items-center gap-2 shrink-0"
        >
          <AnimatePresence initial={false} mode="wait">
            {hasSelection && viewMode !== "chunks" ? (
              <SelectionActions
                key="selection-actions"
                selectionCount={selectionCount}
                onClearSelection={onClearSelection}
                onDeleteSelected={onDeleteSelected}
              />
            ) : (
              <DefaultActions
                key="default-actions"
                isMobile={isMobile}
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                onCreateFolder={onCreateFolder}
                onUpload={onUpload}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
};

FilesPageHeader.displayName = "FilesPageHeader";
