import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CircleNotch,
  WarningCircle,
  Timer,
  Check,
} from "@phosphor-icons/react";
import clsx from "clsx";
import type { FileUploadJob } from "@/types";
import { useFileStore } from "@/store/fileStore";

interface FileUploadIndicatorProps {
  job: FileUploadJob;
}

const statusConfig = {
  queued: { icon: Timer, color: "text-zinc-500" },
  embedding: { icon: CircleNotch, color: "text-zinc-400 animate-spin" },
  converting: { icon: CircleNotch, color: "text-zinc-400 animate-spin" },
  extracting: { icon: CircleNotch, color: "text-zinc-400 animate-spin" },
  uploading: { icon: CircleNotch, color: "text-zinc-400 animate-spin" },
  complete: { icon: Check, color: "text-zinc-400" },
  error: { icon: WarningCircle, color: "text-red-500" },
};

export const FileUploadIndicator: React.FC<FileUploadIndicatorProps> = ({
  job,
}) => {
  const { dismissJob } = useFileStore();

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissJob(job.id);
  };

  const isDismissable = job.status === "complete" || job.status === "error";

  const currentStatusKey =
    job.retries && job.retries > 0 && job.status !== "error"
      ? "extracting"
      : job.status;
  const { icon: Icon, color: iconColor } =
    statusConfig[currentStatusKey] || statusConfig.queued;
  const detailedStatusText = job.error || job.subStatus;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className="relative bg-zinc-875 h-9 px-3 rounded-lg border border-zinc-750 flex items-center gap-3 w-full overflow-hidden shrink-0"
      title={`${job.fileName} - ${detailedStatusText}`}
    >
      {/* Progress Bar Background */}
      <motion.div
        className={clsx(
          "absolute top-0 left-0 h-full opacity-20 pointer-events-none",
          job.status === "error"
            ? "bg-red-500"
            : job.status === "complete"
              ? "bg-emerald-500"
              : "bg-zinc-100",
        )}
        initial={{ width: 0 }}
        animate={{
          width: job.status === "complete" ? "100%" : `${job.progress}%`,
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />

      {/* Icon */}
      <div className="relative shrink-0 w-4 h-4 flex items-center justify-center z-10">
        <Icon size={16} weight="regular" className={iconColor} />
      </div>

      {/* Single Row Content */}
      <div className="relative flex-1 min-w-0 z-10 flex items-center gap-2">
        <span
          className="text-sm font-medium text-zinc-200 truncate"
          title={job.fileName}
        >
          {job.fileName}
        </span>
        <span
          className={clsx(
            "text-xs truncate shrink-0",
            job.status === "error" ? "text-red-400" : "text-zinc-500",
          )}
        >
          — {detailedStatusText}
        </span>
      </div>

      {/* Dismiss Button */}
      <div className="relative w-5 h-5 flex items-center justify-center shrink-0 z-10">
        <AnimatePresence>
          {isDismissable && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={handleDismiss}
              className="p-0.5 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} weight="bold" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
