import React, { useState, useRef, useCallback, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import {
  FileArrowUp,
  X,
  WarningCircle,
  CircleNotch,
  Sparkle,
  Info,
  Check,
} from "@phosphor-icons/react";
import { useFileStore } from "@/store/fileStore";
import { useEmbeddingStore } from "@/store/embeddingStore";
import { processAndCompressFiles } from "@/utils/fileProcessor";
import {
  getFileTypeAndIcon,
  formatFileSize,
  truncateFileName,
} from "@/utils/fileUtils";
import type { Attachment, TextChunk, Model } from "@/types";
import { useModelsStore } from "@/store/modelsStore";
import { FolderId } from "@/types/brands";

type StagedFileStatus =
  | "pending"
  | "embedding"
  | "processing_error"
  | "ready"
  | "complete";

type StagedFile = Attachment & {
  status: StagedFileStatus;
  subStatus: string;
  error?: string;
  chunks?: Omit<TextChunk, "text">[];
  progress: number;
};

const MAX_FILE_SIZE = 1_940_000;
const MAX_FILES_AT_ONCE = 100;
const AUTO_DISMISS_DELAY_MS = 4000;

const OcrModelSelector: React.FC<{
  models: Model[];
  selectedModelId: string;
  onSelect: (modelId: string) => void;
}> = ({ models, selectedModelId, onSelect }) => {
  if (models.length === 0) {
    return <div className="text-xs text-red-400">No OCR models available.</div>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {models.map((model) => (
        <button
          key={model.modelId}
          onClick={() => onSelect(model.modelId)}
          className={clsx(
            "px-2 py-0.5 text-xs rounded-full border cursor-pointer  focus:ring-0",
            selectedModelId === model.modelId
              ? "bg-zinc-600 border-zinc-500 text-zinc-50"
              : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100",
          )}
        >
          {model.name}
        </button>
      ))}
    </div>
  );
};

const FileQueueItem: React.FC<{
  item: StagedFile;
  onRemove: () => void;
  imageModels: Model[];
  selectedOcrModelId?: string;
  onOcrModelSelect: (modelId: string) => void;
}> = ({
  item,
  onRemove,
  imageModels,
  selectedOcrModelId,
  onOcrModelSelect,
}) => {
  const { Icon, color } = getFileTypeAndIcon(item.name);
  const infoText = item.lines
    ? `${formatFileSize(item.size)} · ${item.lines.toLocaleString()} lines`
    : formatFileSize(item.size);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (item.status === "complete") {
      timer = setTimeout(() => {
        onRemove();
      }, AUTO_DISMISS_DELAY_MS);
    }
    return () => clearTimeout(timer);
  }, [item.status, onRemove]);

  const renderStatusIndicator = () => {
    switch (item.status) {
      case "embedding":
      case "pending":
        return (
          <div
            className="flex items-center gap-1 text-xs text-zinc-500"
            title={`Processing... (${Math.round(item.progress)}%)`}
          >
            <CircleNotch size={12} className="animate-spin" />
            <span>{Math.round(item.progress)}%</span>
          </div>
        );
      case "processing_error":
        return (
          <div
            className="flex items-center gap-1 text-xs text-red-400"
            title={item.error || "Processing failed"}
          >
            <WarningCircle size={12} weight="fill" />
            <span className="truncate max-w-30">{item.error || "Failed"}</span>
          </div>
        );
      case "ready":
        if (item.type === "text" && item.chunks) {
          return (
            <div
              className="flex items-center gap-1 text-xs text-zinc-400"
              title={`Ready (${item.chunks.length} chunks)`}
            >
              <Sparkle size={12} weight="fill" />
              <span>Ready</span>
            </div>
          );
        }
        return <span className="text-xs text-zinc-500">Ready</span>;
      case "complete":
        return (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <Check size={12} weight="bold" />
            <span>Done</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        height: 0,
        marginBottom: 0,
        marginTop: 0,
        scale: 0.9,
        transition: { duration: 0.2 },
      }}
      className={clsx(
        "flex flex-col gap-2 p-2 rounded-lg border relative overflow-hidden",
        item.status === "processing_error"
          ? "bg-red-950/20 border-red-900/30"
          : "bg-zinc-800 border-zinc-700/50",
      )}
    >
      {item.status !== "ready" &&
        item.status !== "processing_error" &&
        item.status !== "complete" && (
          <div
            className="absolute left-0 bottom-0 top-0 bg-zinc-700/30 z-0 pointer-events-none transition-all duration-300 ease-out"
            style={{ width: `${item.progress}%` }}
          />
        )}

      <div className="flex items-center w-full gap-3 relative z-10">
        <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-zinc-700/50 rounded-md">
          <Icon size={20} className={color} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <p
              className="text-sm font-medium text-zinc-200 truncate pr-2"
              title={item.name}
            >
              {truncateFileName(item.name, 35)}
            </p>
            {renderStatusIndicator()}
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-zinc-500">{infoText}</p>
            {item.subStatus &&
              item.status !== "complete" &&
              item.status !== "ready" && (
                <p className="text-xs text-zinc-500 truncate max-w-37.5">
                  {item.subStatus}
                </p>
              )}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 -mr-1 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 cursor-pointer transition-colors  focus:ring-0"
          aria-label={`Remove ${item.name}`}
        >
          <X size={14} weight="bold" />
        </button>
      </div>
      {item.file.type === "application/pdf" && (
        <div className="pl-11 relative z-10">
          <OcrModelSelector
            models={imageModels}
            selectedModelId={selectedOcrModelId || ""}
            onSelect={onOcrModelSelect}
          />
        </div>
      )}
    </motion.div>
  );
};

export const UploadModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentFolderId: FolderId | null;
}> = ({ isOpen, onClose, currentFolderId }) => {
  const [stagedFilesForUI, setStagedFilesForUI] = useState<StagedFile[]>([]);
  const stagedFilesRef = useRef<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrModelSelections, setOcrModelSelections] = useState<
    Map<string, string>
  >(new Map());

  const imageModels = useModelsStore((state) => state.imageModels);
  const { addFileJob } = useFileStore();
  const { initWorker, status: embeddingStatus } = useEmbeddingStore();

  useEffect(() => {
    if (isOpen && embeddingStatus === "IDLE") {
      initWorker();
    }
  }, [isOpen, embeddingStatus, initWorker]);

  const resetState = useCallback(() => {
    stagedFilesRef.current = [];
    setStagedFilesForUI([]);
    setValidationErrors([]);
    setOcrModelSelections(new Map());
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(resetState, 300);
  }, [onClose, resetState]);

  const updateUI = useCallback(() => {
    setStagedFilesForUI([...stagedFilesRef.current]);
  }, []);

  const validateFiles = (
    files: File[],
  ): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];
    if (files.length > MAX_FILES_AT_ONCE) {
      errors.push(
        `Cannot upload more than ${MAX_FILES_AT_ONCE} files at once.`,
      );
      files = files.slice(0, MAX_FILES_AT_ONCE);
    }
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(
          `"${file.name}" exceeds maximum file size of ${formatFileSize(
            MAX_FILE_SIZE,
          )}.`,
        );
        continue;
      }
      if (
        stagedFilesRef.current.some(
          (staged) => staged.name === file.name && staged.size === file.size,
        )
      ) {
        errors.push(`"${file.name}" is already in the upload queue.`);
        continue;
      }
      valid.push(file);
    }
    return { valid, errors };
  };

  const handleFileSelection = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const allFiles = Array.from(fileList);
      const { valid: validFiles, errors } = validateFiles(allFiles);
      if (errors.length > 0) {
        setValidationErrors(errors);
        setTimeout(() => setValidationErrors([]), 5000);
      }
      if (validFiles.length === 0) return;

      const newFiles = await processAndCompressFiles(validFiles, "high");
      const newStagedFiles: StagedFile[] = newFiles.map((att) => ({
        ...att,
        id: `${att.name}-${att.file.lastModified}-${Math.random()}`,
        status: "ready",
        subStatus: "Ready to upload",
        progress: 0,
      }));

      if (imageModels.length > 0) {
        setOcrModelSelections((prev) => {
          const next = new Map(prev);
          newStagedFiles.forEach((f) => {
            if (f.file.type === "application/pdf") {
              next.set(f.id, imageModels[0].modelId);
            }
          });
          return next;
        });
      }

      stagedFilesRef.current.push(...newStagedFiles);
      updateUI();
    },
    [updateUI, imageModels],
  );

  const handleRemoveFile = useCallback(
    (id: string) => {
      const fileToRemove = stagedFilesRef.current.find((f) => f.id === id);
      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      stagedFilesRef.current = stagedFilesRef.current.filter(
        (f) => f.id !== id,
      );
      updateUI();
      setOcrModelSelections((prev) => {
        const newSelections = new Map(prev);
        newSelections.delete(id);
        return newSelections;
      });
    },
    [updateUI],
  );

  const handleUpload = () => {
    if (!currentFolderId) return;

    const itemsToUpload = stagedFilesRef.current.filter(
      (f) => f.status === "ready",
    );

    itemsToUpload.forEach((stagedFile) => {
      const modelId =
        stagedFile.file.type === "application/pdf"
          ? ocrModelSelections.get(stagedFile.id)
          : undefined;
      addFileJob(stagedFile.file, stagedFile.id, modelId, stagedFile.chunks);
    });

    handleClose();
  };

  const isUploadDisabled =
    stagedFilesForUI.filter((f) => f.status === "ready").length === 0;
  const readyCount = stagedFilesForUI.filter(
    (f) => f.status === "ready",
  ).length;
  const buttonText = readyCount > 0 ? `Upload ${readyCount} File(s)` : "Upload";

  const totalSize = stagedFilesForUI.reduce((sum, f) => sum + f.size, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          static
          open={isOpen}
          onClose={handleClose}
          className="relative z-50"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal Positioning */}
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-lg"
            >
              <Dialog.Panel className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between border-b border-zinc-800 px-5 py-4 bg-zinc-900/50 backdrop-blur-md z-10">
                  <div>
                    <Dialog.Title className="text-base font-semibold text-zinc-100">
                      Upload Files
                    </Dialog.Title>
                    <Dialog.Description className="text-xs text-zinc-400 mt-0.5">
                      Add documents to your secure vault.
                    </Dialog.Description>
                  </div>
                  <button
                    onClick={handleClose}
                    className="text-zinc-500 hover:text-zinc-200  focus:ring-0 p-1.5 rounded-full hover:bg-zinc-800 transition-colors"
                  >
                    <X size={16} weight="bold" />
                  </button>
                </div>

                {/* Validation Errors */}
                <AnimatePresence>
                  {validationErrors.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-500/10 border-b border-red-500/20 shrink-0"
                    >
                      <div className="px-5 py-3 max-h-32 overflow-y-auto custom-scrollbar">
                        {validationErrors.map((error, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-2 mb-1.5 last:mb-0"
                          >
                            <WarningCircle
                              size={14}
                              className="text-red-400 mt-0.5 shrink-0"
                            />
                            <p className="text-xs text-red-300 font-medium">
                              {error}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 min-h-0">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      handleFileSelection(e.dataTransfer.files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={clsx(
                      "border-2 border-dashed rounded-xl py-10 text-center cursor-pointer transition-all duration-200 ease-in-out group",
                      isDragging
                        ? "border-blue-500/50 bg-blue-500/5"
                        : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50",
                    )}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className={clsx(
                          "p-3 rounded-full transition-colors",
                          isDragging
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200",
                        )}
                      >
                        <FileArrowUp weight="light" size={32} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          Click or drag files to upload
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Up to {formatFileSize(MAX_FILE_SIZE)} each
                        </p>
                      </div>
                    </div>
                  </div>

                  {stagedFilesForUI.length > 0 && (
                    <div className="mt-6 mb-2 flex items-center justify-between px-1">
                      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Queue ({stagedFilesForUI.length})
                      </span>
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {formatFileSize(totalSize)}
                      </span>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.markdown,.csv,.html,.css,.js,.ts,.jsx,.tsx,.json,.xml,.rs,.py,.java,.sh,.toml,.yaml,.yml,image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelection(e.target.files)}
                  />

                  <div className="space-y-2 pb-2">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {stagedFilesForUI.map((item) => (
                        <FileQueueItem
                          key={item.id}
                          item={item}
                          onRemove={() => handleRemoveFile(item.id)}
                          imageModels={imageModels}
                          selectedOcrModelId={ocrModelSelections.get(item.id)}
                          onOcrModelSelect={(modelId) =>
                            setOcrModelSelections(
                              new Map(ocrModelSelections).set(item.id, modelId),
                            )
                          }
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  {embeddingStatus === "LOADING" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3"
                    >
                      <Info size={18} className="text-blue-400 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium text-blue-300">
                          Initializing AI Engine
                        </p>
                        <p className="text-blue-400/80 mt-0.5">
                          This prepares your browser for secure local
                          processing.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Footer */}
                <div className="shrink-0 flex justify-end items-center gap-3 px-5 py-4 border-t border-zinc-800 bg-zinc-900 z-10">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors  focus:ring-0"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={isUploadDisabled}
                    className={clsx(
                      "px-5 py-2 text-sm font-medium rounded-lg transition-all shadow-lg  focus:ring-0",
                      isUploadDisabled
                        ? "bg-zinc-800 text-zinc-500  shadow-none"
                        : "bg-zinc-100 text-zinc-900 hover:bg-white hover:scale-[1.02]",
                    )}
                  >
                    {buttonText}
                  </button>
                </div>
              </Dialog.Panel>
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};
