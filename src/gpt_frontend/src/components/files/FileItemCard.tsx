import React from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  Folder as FolderIcon,
  CheckCircle,
  Circle,
} from "@phosphor-icons/react";
import {
  getFileTypeAndIcon,
  formatFileSize,
  truncateFileName,
} from "@/utils/fileUtils";
import { FileActionDropdown } from "../dropdowns/FileActionDropdown";
import type { FileItem, Folder } from "@/types";

interface FileItemCardProps {
  item: FileItem | Folder;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload?: () => void;
  onView?: () => void;
}

export const FileItemCard: React.FC<FileItemCardProps> = ({
  item,
  isSelected,
  onSelect,
  onOpen,
  ...actionProps
}) => {
  const isFolder = !("size" in item);
  const { Icon, color } = isFolder
    ? { Icon: FolderIcon, color: "text-zinc-300" }
    : getFileTypeAndIcon(item.name);

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={clsx(
        "relative p-2.5 rounded-lg border transition-all duration-200 cursor-pointer group focus-within:outline-none focus-within:ring-0",
        isSelected
          ? "bg-zinc-800/80 border-zinc-600 shadow-md"
          : "bg-zinc-875 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 hover:shadow-lg",
      )}
      onClick={onOpen}
    >
      <button
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onSelect();
        }}
        className={clsx(
          "absolute top-1.5 left-1.5 z-10 p-0.5 rounded-full  focus:ring-0",
          isSelected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 hover:bg-zinc-700/50",
        )}
        aria-label="Select item"
      >
        {isSelected ? (
          <CheckCircle size={18} weight="fill" className="text-zinc-300" />
        ) : (
          <Circle
            size={18}
            weight="regular"
            className="text-zinc-500 hover:text-zinc-300"
          />
        )}
      </button>

      <div className="absolute top-1.5 right-1.5 z-10">
        <FileActionDropdown item={item} {...actionProps} />
      </div>

      <div className="pt-5 pb-0.5 flex flex-col items-center gap-1.5">
        <div className="p-2 bg-zinc-800/50 rounded-xl group-hover:scale-105 transition-transform duration-300">
          <Icon size={40} weight="light" className={color} />
        </div>
        <div className="w-full text-center px-1">
          <p
            className="text-sm font-medium text-zinc-200 truncate"
            title={item.name}
          >
            {truncateFileName(item.name)}
          </p>
          {!isFolder && (
            <p className="text-xs text-zinc-500 mt-0.5 ">
              {formatFileSize((item as FileItem).size)}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
