import React from "react";
import clsx from "clsx";
import {
  Folder as FolderIcon,
  CheckCircle,
  Circle,
} from "@phosphor-icons/react";
import {
  getFileTypeAndIcon,
  formatDate,
  formatFileSize,
  truncateFileName,
} from "@/utils/fileUtils";
import { FileActionDropdown } from "../dropdowns/FileActionDropdown";
import type { FileItem, Folder } from "@/types";
import { motion } from "framer-motion";

interface FileListItemProps {
  item: FileItem | Folder;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload?: () => void;
  onView?: () => void;
}

export const FileListItem: React.FC<FileListItemProps> = ({
  item,
  isSelected,
  onSelect,
  onOpen,
  ...actionProps
}) => {
  const isFolder = !("size" in item);
  const { Icon, color, type } = isFolder
    ? { Icon: FolderIcon, color: "text-zinc-300", type: "Folder" }
    : getFileTypeAndIcon(item.name);

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={clsx(
        "hover:bg-zinc-800/60 cursor-pointer group duration-150",
        isSelected ? "bg-zinc-800/80" : "bg-transparent",
      )}
      onClick={onOpen}
    >
      <td className="px-2.5 py-1.5 text-center align-middle w-8">
        <button
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onSelect();
          }}
          className="p-0.5 flex items-center justify-center h-full w-full rounded  focus-visible:outline-none focus-visible:ring-0"
          aria-label={isSelected ? "Deselect" : "Select"}
        >
          {isSelected ? (
            <CheckCircle size={16} weight="fill" className="text-zinc-300" />
          ) : (
            <Circle
              size={16}
              weight="regular"
              className="text-zinc-600 hover:text-zinc-400"
            />
          )}
        </button>
      </td>
      <td className="px-3 py-1.5 align-middle">
        <div className="flex items-center gap-2">
          <Icon size={18} className={`${color} shrink-0`} />
          <span className="text-sm text-zinc-200 truncate" title={item.name}>
            {truncateFileName(item.name)}
          </span>
        </div>
      </td>
      <td className="px-3 py-1.5 text-sm text-zinc-400 align-middle">
        {isFolder ? "—" : formatDate((item as FileItem).uploadedAt)}
      </td>
      <td className="px-3 py-1.5 text-sm text-zinc-400 align-middle ">
        {isFolder ? "—" : formatFileSize((item as FileItem).size)}
      </td>
      <td className="px-3 py-1.5 text-sm text-zinc-400 align-middle">{type}</td>
      <td className="px-1.5 py-1.5 text-right align-middle w-10">
        <div className="flex justify-end">
          <FileActionDropdown item={item} {...actionProps} />
        </div>
      </td>
    </motion.tr>
  );
};
