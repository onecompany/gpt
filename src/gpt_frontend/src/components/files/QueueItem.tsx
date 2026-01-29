import React, { memo } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { X, Check, WarningCircle, CircleNotch } from "@phosphor-icons/react";
import type { FileUploadJob } from "@/types";
import { getFileTypeAndIcon, truncateFileName } from "@/utils/fileUtils";

interface QueueItemProps {
  job: FileUploadJob;
  onDismiss: (id: string) => void;
}

export const QueueItem: React.FC<QueueItemProps> = memo(({ job, onDismiss }) => {
  const { Icon } = getFileTypeAndIcon(job.fileName);
  const isError = job.status === "error";
  const isComplete = job.status === "complete";
  const isProcessing = !isError && !isComplete;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, height: 0, marginTop: 0 }}
      animate={{ opacity: 1, height: "auto", marginTop: 2 }} // Reduced margin
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className={clsx(
        "group relative flex items-center gap-2.5 rounded-lg px-2 py-6 border w-full overflow-hidden select-none",
        "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-colors",
      )}
    >
      {/* Progress Bar (Bottom Line) */}
      {isProcessing && job.progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800/50">
          <motion.div
            className="h-full bg-zinc-400"
            initial={{ width: 0 }}
            animate={{ width: `${job.progress}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 15 }}
          />
        </div>
      )}

      {/* Icon - Compact 32px */}
      <div className="shrink-0 text-zinc-400 flex items-center justify-center w-8 h-8 rounded-md bg-zinc-800/50 ring-1 ring-zinc-700/30">
        <Icon size={16} weight="light" />
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between">
          <span
            className="text-sm font-medium text-zinc-200 truncate leading-tight"
            title={job.fileName}
          >
            {truncateFileName(job.fileName, 24)}
          </span>
        </div>

        {/* Status Line - Tighter leading, smaller text */}
        <div className="flex items-center gap-1.5 text-xs leading-tight h-3.5 mt-0.5">
          {isError ? (
            <span className="text-red-400 flex items-center gap-1 font-medium truncate">
              <WarningCircle size={10} weight="fill" />
              <span className="truncate">{job.error || "Failed"}</span>
            </span>
          ) : isComplete ? (
            <span className="text-zinc-500 flex items-center gap-1 font-medium">
              <Check size={10} weight="bold" />
              Complete
            </span>
          ) : (
            <span className="text-zinc-400 flex items-center gap-1.5 truncate">
              <CircleNotch size={10} className="animate-spin text-zinc-500" />
              <span className="font-medium">
                {job.subStatus || "Processing..."}
              </span>
              <span className="text-zinc-500 tabular-nums ml-auto">
                {Math.round(job.progress)}%
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Dismiss Action */}
      <div className="shrink-0 flex items-center self-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(job.id);
          }}
          className={clsx(
            "p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/80 transition-all  focus:ring-0",
            // Visible on hover/focus or if mobile
            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100",
          )}
          aria-label="Dismiss"
        >
          <X size={12} weight="bold" />
        </button>
      </div>
    </motion.div>
  );
});

QueueItem.displayName = "QueueItem";
QueueItem.displayName = "QueueItem";
