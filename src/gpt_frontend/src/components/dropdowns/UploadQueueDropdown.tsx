import React, { useMemo } from "react";
import { Menu } from "@headlessui/react";
import { useFileStore } from "@/store/fileStore";
import {
  CircleNotch,
  WarningCircle,
  CheckCircle,
  Trash,
} from "@phosphor-icons/react";
import { QueueItem } from "../files/QueueItem";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { DropdownTransition } from "@/components/ui/Dropdown";

export const UploadQueueDropdown: React.FC = () => {
  const fileProcessingJobs = useFileStore((state) => state.fileProcessingJobs);
  const dismissJob = useFileStore((state) => state.dismissJob);

  const jobs = useMemo(
    () => Object.values(fileProcessingJobs).reverse(), // Newest first
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

  let triggerIcon;
  let triggerLabel;
  let triggerClass =
    "text-zinc-400 hover:text-zinc-200 bg-transparent hover:bg-zinc-800";

  if (hasError) {
    triggerIcon = (
      <WarningCircle size={16} weight="fill" className="text-red-400/80" />
    );
    triggerLabel = `${errorCount} Failed`;
    triggerClass =
      "text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800 hover:text-zinc-100 border-zinc-800";
  } else if (hasActive) {
    triggerIcon = (
      <CircleNotch size={16} className="animate-spin text-zinc-400" />
    );
    triggerLabel = `${activeCount} Processing`;
    triggerClass = "text-zinc-300 bg-zinc-800/30 hover:bg-zinc-800";
  } else {
    triggerIcon = (
      <CheckCircle size={16} weight="fill" className="text-zinc-500" />
    );
    triggerLabel = "Done";
  }

  const handleClearCompleted = () => {
    jobs.forEach((job) => {
      if (job.status === "complete" || job.status === "error") {
        dismissJob(job.id);
      }
    });
  };

  const hasCompletedOrFailed = jobs.some(
    (j) => j.status === "complete" || j.status === "error",
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative shrink-0 z-50"
    >
      <Menu as="div" className="relative inline-block text-left">
        {({ open }) => (
          <>
            <Menu.Button
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border border-transparent  focus:ring-0",
                triggerClass,
                open && "bg-zinc-800 text-zinc-100 border-zinc-700/50",
              )}
            >
              {triggerIcon}
              <span>{triggerLabel}</span>
            </Menu.Button>

            <DropdownTransition>
              <Menu.Items
                className={clsx(
                  "absolute right-0 mt-2 w-80 origin-top-right",
                  "bg-zinc-875 ring-1 ring-zinc-700 rounded-xl shadow-2xl shadow-black/80  overflow-hidden",
                )}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50 bg-zinc-875 sticky top-0 z-20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Queue
                    </span>
                    <span className="text-xs text-zinc-400 bg-zinc-800 px-1.5 py-0 rounded-full tabular-nums border border-zinc-700/50">
                      {jobs.length}
                    </span>
                  </div>

                  {hasCompletedOrFailed && (
                    <button
                      onClick={handleClearCompleted}
                      className="text-xs font-medium text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800  focus:ring-0"
                    >
                      <Trash size={12} />
                      Clear
                    </button>
                  )}
                </div>

                <motion.div
                  layout
                  className="max-h-80 overflow-y-auto overflow-x-hidden p-1 flex flex-col gap-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {jobs.map((job) => (
                      <QueueItem
                        key={job.id}
                        job={job}
                        onDismiss={dismissJob}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </Menu.Items>
            </DropdownTransition>
          </>
        )}
      </Menu>
    </motion.div>
  );
};

UploadQueueDropdown.displayName = "UploadQueueDropdown";
