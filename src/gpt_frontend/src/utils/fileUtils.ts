import {
  FilePdf,
  FileText,
  ImageSquare,
  File as FileIcon,
  FileCode,
} from "@phosphor-icons/react";

export const getFileExtension = (fileName: string): string => {
  if (!fileName || fileName.lastIndexOf(".") === -1) return "";
  return fileName
    .slice(((fileName.lastIndexOf(".") - 1) >>> 0) + 2)
    .toLowerCase();
};

const CODE_EXTENSIONS = new Set([
  "js",
  "ts",
  "jsx",
  "tsx",
  "py",
  "java",
  "json",
  "html",
  "css",
  "scss",
  "less",
  "rs",
  "go",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "php",
  "rb",
  "swift",
  "kt",
  "kts",
  "sh",
  "bash",
  "zsh",
  "sql",
  "xml",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "log",
]);

export const getFileTypeAndIcon = (
  fileName: string,
): { type: string; Icon: React.ElementType; color: string } => {
  const ext = getFileExtension(fileName);

  if (CODE_EXTENSIONS.has(ext)) {
    return { type: "Code", Icon: FileCode, color: "text-zinc-300" };
  }

  switch (ext) {
    case "pdf":
      return { type: "PDF", Icon: FilePdf, color: "text-zinc-300" };
    case "txt":
    case "md":
      return { type: "Text", Icon: FileText, color: "text-zinc-300" };
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      return { type: "Image", Icon: ImageSquare, color: "text-zinc-300" };
    default:
      return {
        type: ext.toUpperCase() || "File",
        Icon: FileIcon,
        color: "text-zinc-400",
      };
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatDate = (date: Date): string => {
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays < 7 && date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const truncateFileName = (
  name: string,
  maxLength: number = 30,
): string => {
  if (name.length <= maxLength) return name;

  const lastDotIndex = name.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return name.substring(0, maxLength) + "…";
  }

  const extension = name.substring(lastDotIndex);
  const nameWithoutExt = name.substring(0, lastDotIndex);

  if (extension.length >= maxLength - 3) {
    return name.substring(0, maxLength) + "…";
  }

  const availableLength = maxLength - extension.length - 1;
  return nameWithoutExt.substring(0, availableLength) + "…" + extension;
};

const TEXT_BASED_APPLICATION_MIME_TYPES = new Set([
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/toml",
  "application/yaml",
  "application/x-rust-crate",
  "application/x-sh",
  "application/x-shellscript",
  "application/x-python-code",
  "application/x-yaml",
]);

const TEXT_BASED_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "xml",
  "toml",
  "yaml",
  "yml",
  "html",
  "css",
  "js",
  "ts",
  "jsx",
  "tsx",
  "rs",
  "py",
  "java",
  "sh",
  "bash",
]);

export const isTextMimeType = (
  mimeType?: string,
  fileName?: string,
): boolean => {
  if (mimeType) {
    if (mimeType.startsWith("text/")) return true;
    if (TEXT_BASED_APPLICATION_MIME_TYPES.has(mimeType)) return true;
  }

  if (fileName) {
    const ext = getFileExtension(fileName);
    if (TEXT_BASED_EXTENSIONS.has(ext)) return true;
  }

  return false;
};

export function getUniqueFileName(
  desiredName: string,
  existingNames: string[],
): string {
  const existingSet = new Set(existingNames);
  if (!existingSet.has(desiredName)) {
    return desiredName;
  }

  const dotIndex = desiredName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? desiredName.slice(0, dotIndex) : desiredName;
  const extension = dotIndex > 0 ? desiredName.slice(dotIndex) : "";

  let counter = 1;
  let newName: string;
  do {
    newName = `${baseName} (${counter})${extension}`;
    counter++;
  } while (existingSet.has(newName));

  return newName;
}
