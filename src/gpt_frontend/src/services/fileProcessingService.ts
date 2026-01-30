import type { TextChunk } from "@/types";
import { isTextMimeType } from "@/utils/fileUtils";
import { convertPdfToImages } from "@/utils/pdfUtils";
import { useChatStore } from "@/store/chatStore";
import { getUniqueFileName } from "@/utils/fileUtils";
import type { FolderId } from "@/types/brands";

// Chunk size for text search (embedding generation disabled for now)
const CHUNK_SIZE = 8000; // 8k chars per chunk for better granularity
const CHUNK_OVERLAP = 500; // Overlap for context continuity

// Sentence-ending patterns for intelligent splitting
const SENTENCE_ENDINGS = /[.!?]\s+/g;
const PARAGRAPH_BREAK = /\n\n+/g;

/**
 * Finds the best split point near target position (sentence or paragraph boundary).
 */
function findBestSplitPoint(
  text: string,
  targetPos: number,
  searchRange: number = 500,
): number {
  if (targetPos >= text.length) return text.length;

  const searchStart = Math.max(0, targetPos - searchRange);
  const searchEnd = Math.min(text.length, targetPos + searchRange);
  const searchText = text.substring(searchStart, searchEnd);

  // Look for paragraph breaks first (highest priority)
  let bestPos = targetPos;
  const paragraphMatches = [...searchText.matchAll(PARAGRAPH_BREAK)];
  for (const match of paragraphMatches) {
    const absPos = searchStart + (match.index ?? 0) + match[0].length;
    if (
      Math.abs(absPos - targetPos) < Math.abs(bestPos - targetPos) &&
      absPos <= targetPos + searchRange / 2
    ) {
      bestPos = absPos;
    }
  }

  // If no paragraph break found nearby, look for sentence endings
  if (bestPos === targetPos) {
    const sentenceMatches = [...searchText.matchAll(SENTENCE_ENDINGS)];
    for (const match of sentenceMatches) {
      const absPos = searchStart + (match.index ?? 0) + match[0].length;
      if (
        Math.abs(absPos - targetPos) < Math.abs(bestPos - targetPos) &&
        absPos <= targetPos + searchRange / 2
      ) {
        bestPos = absPos;
      }
    }
  }

  return Math.min(bestPos, text.length);
}

/**
 * Creates chunks from text content with intelligent boundary detection.
 * Used for text search (embedding generation disabled for now).
 */
function createChunks(text: string): Omit<TextChunk, "text" | "sentences">[] {
  const chunks: Omit<TextChunk, "text" | "sentences">[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    // Find target end position
    const targetEnd = start + CHUNK_SIZE;

    // Find best split point (sentence/paragraph boundary)
    const end = findBestSplitPoint(text, targetEnd);

    chunks.push({
      chunk_index: chunkIndex,
      start_char: start,
      end_char: end,
      embedding: [], // Will be filled by EmbeddingService
    });

    chunkIndex++;

    // Calculate next start with overlap, but don't go backwards
    const nextStart = end - CHUNK_OVERLAP;
    start = Math.max(end, nextStart);

    // Prevent infinite loop
    if (start >= text.length || end >= text.length) break;
  }

  // Handle edge case of very short text
  if (chunks.length === 0 && text.length > 0) {
    chunks.push({
      chunk_index: 0,
      start_char: 0,
      end_char: text.length,
      embedding: [],
    });
  }

  return chunks;
}


// Helper to retry async operations (e.g., OCR)
const retryAsync = async <T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number,
  onRetry: (attempt: number, error: Error) => void,
): Promise<T> => {
  let lastError: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < retries) {
        onRetry(i + 1, lastError);
        await new Promise((res) => setTimeout(res, delay * Math.pow(2, i)));
      }
    }
  }
  throw lastError || new Error("Unknown retry error");
};

export interface ProcessFileOptions {
  file: File;
  fileName: string; // Original or sanitized name
  fileType: "pdf" | "markdown" | "image" | "other";
  modelId?: string; // Required for PDF/OCR
  parentId: FolderId;
  chunks?: Omit<TextChunk, "text">[]; // Pre-existing chunks
  existingFileNames: string[]; // For rename collision handling
  uploadFilesAction: (
    files: Array<{
      file: File;
      chunks?: Omit<TextChunk, "text">[];
    }>,
    parentId: FolderId,
  ) => Promise<void>;
  updateJob: (update: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status?: any;
    subStatus?: string;
    progress?: number;
    error?: string | null;
    retries?: number;
  }) => void;
}

export const FileProcessingService = {
  processFile: async (options: ProcessFileOptions) => {
    const {
      file,
      fileName,
      fileType,
      modelId,
      parentId,
      chunks,
      existingFileNames,
      uploadFilesAction,
      updateJob,
    } = options;

    try {
      if (fileType === "pdf") {
        if (!modelId) throw new Error("Missing modelId for PDF processing.");

        updateJob({ status: "converting", subStatus: "Preparing PDF..." });

        const allPageFiles: File[] = [];
        // Sequential generator to keep memory low
        for await (const {
          pageFile,
          pageNumber,
          totalPages,
        } of convertPdfToImages(file)) {
          updateJob({
            progress: (pageNumber / totalPages) * 45, // 0-45% for conversion
            subStatus: `Converting page ${pageNumber} of ${totalPages}`,
          });
          allPageFiles.push(pageFile);
        }

        updateJob({
          status: "extracting",
          subStatus: `Extracting text from ${allPageFiles.length} pages...`,
        });

        // OCR Execution - Process all batches in parallel
        const OCR_BATCH_SIZE = 3;
        const MAX_OCR_RETRIES = 2;
        const pageBatches: File[][] = [];
        for (let i = 0; i < allPageFiles.length; i += OCR_BATCH_SIZE) {
          pageBatches.push(allPageFiles.slice(i, i + OCR_BATCH_SIZE));
        }

        const totalBatches = pageBatches.length;
        let completedCount = 0;

        // Process all batches in parallel
        const batchPromises = pageBatches.map(async (batch, index) => {
          try {
            const result = await retryAsync(
              () => useChatStore.getState().executeOcrOnImages(batch, modelId),
              MAX_OCR_RETRIES,
              2000,
              (attempt) => {
                console.log(
                  `OCR batch ${index + 1}/${totalBatches} retry ${attempt}/${MAX_OCR_RETRIES}`,
                );
              },
            );
            completedCount++;
            updateJob({
              progress: 45 + (completedCount / totalBatches) * 45,
              subStatus: `Extracted ${completedCount}/${totalBatches} batches...`,
            });
            return { index, status: "fulfilled" as const, value: result };
          } catch (e) {
            console.error("Batch failed completely", {
              batchIndex: index + 1,
              error: e,
            });
            completedCount++;
            updateJob({
              progress: 45 + (completedCount / totalBatches) * 45,
              subStatus: `Extracted ${completedCount}/${totalBatches} batches...`,
            });
            return { index, status: "rejected" as const, reason: e };
          }
        });

        // Wait for all batches to complete
        const batchResults = await Promise.all(batchPromises);

        // Sort results by original index to maintain page order
        const results = batchResults.sort((a, b) => a.index - b.index);

        const successfulResults = results
          .filter(
            (
              r,
            ): r is { index: number; status: "fulfilled"; value: string } =>
              r.status === "fulfilled" && !!r.value?.trim(),
          )
          .map((r) => r.value);

        if (successfulResults.length === 0) {
          throw new Error("OCR extraction failed for all pages.");
        }

        const allMarkdown = successfulResults.join("\n\n");
        const finalFileName = getUniqueFileName(
          `${fileName.replace(/\.pdf$/i, "")}.md`,
          existingFileNames,
        );
        const markdownFile = new File([allMarkdown], finalFileName, {
          type: "text/markdown",
        });

        // Create chunks for text search (embedding generation disabled)
        updateJob({
          status: "chunking",
          subStatus: "Creating text chunks...",
          progress: 90,
        });
        const finalChunks = createChunks(allMarkdown);
        console.log(
          `[FileProcessing] Created ${finalChunks.length} chunks for text search`,
        );

        updateJob({
          status: "uploading",
          subStatus: "Uploading processed file...",
          progress: 95,
        });
        await uploadFilesAction(
          [{ file: markdownFile, chunks: finalChunks }],
          parentId,
        );
      } else if (
        fileType === "markdown" ||
        isTextMimeType(file.type, fileName)
      ) {
        if (!chunks) {
          // Create chunks for text search (embedding generation disabled)
          updateJob({
            status: "chunking",
            subStatus: "Creating text chunks...",
            progress: 30,
          });
          const fileContent = await file.text();
          const finalChunks = createChunks(fileContent);
          console.log(
            `[FileProcessing] Created ${finalChunks.length} chunks for text search`,
          );

          updateJob({
            status: "uploading",
            subStatus: "Uploading...",
            progress: 90,
          });
          await uploadFilesAction([{ file, chunks: finalChunks }], parentId);
        } else {
          // Pre-chunked (unlikely in this flow, but supported)
          updateJob({
            status: "uploading",
            subStatus: "Uploading...",
            progress: 90,
          });
          await uploadFilesAction([{ file, chunks }], parentId);
        }
      } else {
        // Generic/Image Processing Strategy
        updateJob({
          status: "uploading",
          subStatus: "Uploading...",
          progress: 50,
        });
        await uploadFilesAction([{ file }], parentId);
      }

      updateJob({ status: "complete", subStatus: "Done!", progress: 100 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Job failed", { fileName, error: e });
      updateJob({
        status: "error",
        error: msg || "An unknown error occurred during processing",
      });
    }
  },
};
