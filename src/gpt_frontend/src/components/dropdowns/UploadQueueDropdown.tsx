import React, { useMemo } from "react";
import { useFileStore } from "@/store/fileStore";
import {
  CircleNotch,
  WarningCircle,
  CheckCircle,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
} from "@/components/ui/Dropdown";
import type { FileUploadJob } from "@/types";
import { truncateFileName } from "@/utils/fileUtils";

interface QueueItemProps {
  job: FileUploadJob;
  onDismiss: (id: string) => void;
}

const QueueItem: React.FC<QueueItemProps> = ({ job, onDismiss }) => {
  const isError = job.status === "error";
  const isComplete = job.status === "complete";
  const isProcessing = !isError && !isComplete;

  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-750 transition-colors">
      <div className="shrink-0">
        {isError ? (
          <WarningCircle size={14} weight="fill" className="text-red-400" />
        ) : isComplete ? (
          <CheckCircle size={14} weight="fill" className="text-emerald-500" />
        ) : (
          <CircleNotch size={14} className="animate-spin text-zinc-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <span
          className="text-sm text-zinc-300 truncate block leading-tight"
          title={job.fileName}
        >
          {truncateFileName(job.fileName, 24)}
        </span>
        <span
          className={clsx(
            "text-xs truncate block leading-tight",
            isError ? "text-red-400" : "text-zinc-500",
          )}
        >
          {isError
            ? job.error || "Failed"
            : isComplete
              ? "Done"
              : job.subStatus || `${Math.round(job.progress)}%`}
        </span>
      </div>

      {!isProcessing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(job.id);
          }}
          className="shrink-0 p-0.5 rounded text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <X size={12} weight="bold" />
        </button>
      )}

      {isProcessing && (
        <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
          {Math.round(job.progress)}%
        </span>
      )}
    </div>
  );
};

export const UploadQueueDropdown: React.FC = () => {
  const fileProcessingJobs = useFileStore((state) => state.fileProcessingJobs);
  const dismissJob = useFileStore((state) => state.dismissJob);

  const jobs = useMemo(
    () => Object.values(fileProcessingJobs).reverse(),
    [fileProcessingJobs],
  );

  const activeCount = jobs.filter(
    (j) => j.status !== "complete" && j.status !== "error",
  ).length;

  const errorCount = jobs.filter((j) => j.status === "error").length;

  if (jobs.length === 0) {
    return null;
  }

  const hasActive = activeCount > 0;
  const hasError = errorCount > 0;

  const handleClearAll = () => {
    jobs.forEach((job) => {
      if (job.status === "complete" || job.status === "error") {
        dismissJob(job.id);
      }
    });
  };

  const completedCount = jobs.filter(
    (j) => j.status === "complete" || j.status === "error",
  ).length;

  return (
    <Dropdown as="div" className="relative">
      {({ open }) => (
        <>
          <DropdownTrigger
            className={clsx(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
              open
                ? "bg-zinc-750 text-zinc-200"
                : hasError
                  ? "text-red-400 hover:bg-zinc-800"
                  : hasActive
                    ? "text-zinc-400 hover:bg-zinc-800"
                    : "text-emerald-500 hover:bg-zinc-800",
            )}
          >
            {hasError ? (
              <WarningCircle size={14} weight="fill" />
            ) : hasActive ? (
              <CircleNotch size={14} className="animate-spin" />
            ) : (
              <CheckCircle size={14} weight="fill" />
            )}
            <span>
              {hasError
                ? `${errorCount} failed`
                : hasActive
                  ? activeCount
                  : "Done"}
            </span>
          </DropdownTrigger>

          <DropdownContent align="end" width="w-64" className="p-1 overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1 mb-1">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Uploads
              </span>
              {completedCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto">
              {jobs.map((job) => (
                <QueueItem key={job.id} job={job} onDismiss={dismissJob} />
              ))}
            </div>
          </DropdownContent>
        </>
      )}
    </Dropdown>
  );
};

UploadQueueDropdown.displayName = "UploadQueueDropdown";
