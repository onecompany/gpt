import React from "react";
import {
  DotsThreeVertical,
  PencilSimple,
  Trash,
  DownloadSimple,
  Eye,
} from "@phosphor-icons/react";
import { FileItem, Folder } from "@/types";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/Dropdown";
import clsx from "clsx";

interface FileActionDropdownProps {
  item: FileItem | Folder;
  onRename: () => void;
  onDelete: () => void;
  onDownload?: () => void;
  onView?: () => void;
}

export const FileActionDropdown: React.FC<FileActionDropdownProps> = ({
  item,
  onRename,
  onDelete,
  onDownload,
  onView,
}) => {
  // Check if item has parentId property that might be null (Folder) vs FileItem
  // For Folder: parentId is FolderId | null
  // For FileItem: parentId is FolderId
  // We can distinguish by type property if available, or structural check.
  // In our types, FileItem has 'size', Folder does not.
  const isFolder = !("size" in item);
  const iconClass = "text-zinc-400 group-hover:text-zinc-200";

  return (
    <Dropdown as="div" className="relative">
      {({ open }) => (
        <>
          <DropdownTrigger
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className={clsx(
              "flex items-center justify-center p-1.5 rounded-lg transition-all duration-200",
              open ? "text-zinc-200" : "text-zinc-500 hover:text-zinc-200",
              "focus:opacity-100 ",
              open ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <DotsThreeVertical size={20} weight="bold" />
          </DropdownTrigger>

          <DropdownContent align="end" width="min-w-[9rem]" className="z-50">
            {!isFolder && onView && (
              <DropdownItem
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onView();
                }}
              >
                <Eye weight="regular" className={iconClass} size={20} />
                <span className="ml-2.5">View</span>
              </DropdownItem>
            )}
            <DropdownItem
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onRename();
              }}
            >
              <PencilSimple weight="regular" className={iconClass} size={20} />
              <span className="ml-2.5">Rename</span>
            </DropdownItem>
            {!isFolder && onDownload && (
              <DropdownItem
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onDownload();
                }}
              >
                <DownloadSimple
                  weight="regular"
                  className={iconClass}
                  size={20}
                />
                <span className="ml-2.5">Download</span>
              </DropdownItem>
            )}
            <DropdownSeparator />
            <DropdownItem
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash weight="regular" className={iconClass} size={20} />
              <span className="ml-2.5">Delete</span>
            </DropdownItem>
          </DropdownContent>
        </>
      )}
    </Dropdown>
  );
};
