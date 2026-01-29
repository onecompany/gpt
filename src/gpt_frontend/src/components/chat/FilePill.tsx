import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  FileText,
  FilePdf,
  FileCode,
  FileImage,
  File as IconFile,
} from "@phosphor-icons/react";
import { Attachment } from "@/types";
import clsx from "clsx";
import { truncateFileName } from "@/utils/fileUtils";

interface FilePillProps {
  attachment: Attachment;
  onRemove: (id: string) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
};

const useImageBackground = (imageUrl?: string): string => {
  const [needsBackground, setNeedsBackground] = useState(false);

  React.useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Sample 10x10 to save performance
      canvas.width = 10;
      canvas.height = 10;
      ctx.drawImage(img, 0, 0, 10, 10);
      const data = ctx.getImageData(0, 0, 10, 10).data;

      // Simple heuristic for transparency
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) {
          setNeedsBackground(true);
          break;
        }
      }
    };

    img.src = imageUrl;
  }, [imageUrl]);

  return needsBackground ? "bg-zinc-900" : "";
};

export const FilePill: React.FC<FilePillProps> = ({ attachment, onRemove }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const imageBg = useImageBackground(attachment.previewUrl);

  const fileSize = formatFileSize(attachment.size);
  const infoText = attachment.lines
    ? `${fileSize} · ${attachment.lines.toLocaleString()} lines`
    : fileSize;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onRemove(attachment.id);
      }
    },
    [attachment.id, onRemove],
  );

  // Choose the icon component based on file type/extension.
  let IconComponent: typeof IconFile = IconFile;

  if (attachment.type === "image") {
    IconComponent = FileImage;
  } else {
    const ext = attachment.name.split(".").pop()?.toLowerCase();

    if (ext === "pdf") {
      IconComponent = FilePdf;
    } else if (ext === "txt" || ext === "md") {
      IconComponent = FileText;
    } else if (
      ext === "js" ||
      ext === "ts" ||
      ext === "jsx" ||
      ext === "tsx" ||
      ext === "py" ||
      ext === "java" ||
      ext === "json" ||
      ext === "html" ||
      ext === "css"
    ) {
      IconComponent = FileCode;
    } else {
      IconComponent = IconFile;
    }
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.9, x: 10 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9, width: 0, margin: 0 }}
      transition={{ duration: 0.2 }}
      className="relative shrink-0 group focus-within:ring-0 focus-within:outline-none rounded-lg outline-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <div
        className={clsx(
          "h-10 rounded-lg border flex items-center overflow-hidden pr-8 relative transition-colors duration-150",
          isHovered || isFocused
            ? "border-zinc-600 bg-zinc-800"
            : "border-zinc-700 bg-zinc-850",
        )}
      >
        {attachment.type === "image" && attachment.previewUrl ? (
          <div className={clsx("h-full w-10 shrink-0", imageBg)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-zinc-800/50">
            <IconComponent size={18} className="text-zinc-400" />
          </div>
        )}

        <div className="flex-1 min-w-0 px-3 flex flex-col justify-center">
          <p
            className="text-xs font-medium text-zinc-200 truncate leading-tight"
            title={attachment.name}
          >
            {truncateFileName(attachment.name)}
          </p>
          <p className="text-[0.65rem] text-zinc-500 truncate leading-tight mt-0.5">
            {infoText}
          </p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(attachment.id);
          }}
          onKeyDown={handleKeyDown}
          className={clsx(
            "absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full",
            "text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all duration-150  focus:bg-zinc-700 focus:text-white",
            isHovered || isFocused
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus:opacity-100",
          )}
          aria-label={`Remove ${attachment.name}`}
          tabIndex={0}
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </motion.div>
  );
};

FilePill.displayName = "FilePill";
