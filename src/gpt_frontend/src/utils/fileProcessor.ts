import Compressor from "compressorjs";
import type { Attachment, CompressionLevel } from "@/types";
import { isTextMimeType } from "./fileUtils";

const countLines = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (typeof text !== "string") {
        resolve(0);
        return;
      }
      const lineCount = (text.match(/\n/g) || []).length + 1;
      resolve(lineCount);
    };
    reader.onerror = () => resolve(0);
    reader.readAsText(file);
  });
};

export const processAndCompressFiles = async (
  files: File[],
  compressionLevel: CompressionLevel = "medium",
): Promise<Omit<Attachment, "id">[]> => {
  const qualityMap = {
    extreme: 0.1,
    high: 0.3,
    medium: 0.5,
    low: 0.7,
  };

  const attachmentPromises = files.map(
    async (file): Promise<Omit<Attachment, "id"> | null> => {
      const isImage = file.type.startsWith("image/");
      let processedFile = file;

      if (isImage && compressionLevel !== "lossless") {
        try {
          const compressedBlob = await new Promise<Blob>((resolve, reject) => {
            new Compressor(file, {
              quality: qualityMap[compressionLevel],
              mimeType: "image/webp",
              success: resolve,
              error: reject,
            });
          });
          const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
          processedFile = new File([compressedBlob], newName, {
            type: "image/webp",
            lastModified: Date.now(),
          });
        } catch (error) {
          console.error(
            "Image compression failed for %s, using original file.",
            file.name,
            error,
          );
        }
      }

      if (isImage) {
        return {
          name: processedFile.name,
          size: processedFile.size,
          type: "image",
          file: processedFile,
          previewUrl: URL.createObjectURL(processedFile),
        };
      } else {
        const lines = isTextMimeType(file.type, file.name)
          ? await countLines(file)
          : undefined;
        return {
          name: file.name,
          size: file.size,
          type: "text",
          file: file,
          lines,
        };
      }
    },
  );

  const attachments = (await Promise.all(attachmentPromises)).filter(
    (a): a is Omit<Attachment, "id"> => a !== null,
  );

  return attachments;
};
