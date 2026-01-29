import React from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { ArrowLeft, CaretRight } from "@phosphor-icons/react";
import { FolderId } from "@/types/brands";

interface BreadcrumbNavProps {
  folderHistory: Array<{ id: FolderId; name: string }>;
  onNavigateHistory: (index: number) => void;
  className?: string;
}

export const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({
  folderHistory,
  onNavigateHistory,
  className,
}) => {
  const isRoot = folderHistory.length <= 1;
  const rootFolder = folderHistory[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className={clsx(
        "h-6 flex items-center min-w-0 px-1",
        !className && "px-4 mt-3.5 ml-0.5 shrink-0",
        className,
      )}
    >
      {isRoot ? (
        <div
          className="flex items-center gap-2 text-sm font-medium text-zinc-100 cursor-default truncate"
          title={rootFolder?.name}
        >
          {rootFolder?.name}
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => onNavigateHistory(folderHistory.length - 2)}
            className="rounded-md text-zinc-400 hover:text-zinc-100 duration-100 shrink-0  focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
            aria-label="Go back to parent folder"
          >
            <ArrowLeft weight="regular" size={16} />
          </button>
          <nav
            aria-label="Breadcrumb"
            className="flex items-center text-sm text-zinc-400 min-w-0 overflow-hidden flex-1"
          >
            {folderHistory.map((folder, index) => (
              <React.Fragment key={folder.id}>
                {index > 0 && (
                  <CaretRight
                    size={12}
                    className="mx-1 text-zinc-600 shrink-0"
                  />
                )}
                <button
                  onClick={() => onNavigateHistory(index)}
                  disabled={index === folderHistory.length - 1}
                  className={clsx(
                    "duration-150 px-2 py-1 rounded-md truncate max-w-30  focus-visible:outline-none focus-visible:ring-0",
                    index === folderHistory.length - 1
                      ? "text-zinc-100 font-medium cursor-default"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer",
                  )}
                  title={folder.name}
                >
                  {folder.name}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </div>
      )}
    </motion.div>
  );
};

BreadcrumbNav.displayName = "BreadcrumbNav";
