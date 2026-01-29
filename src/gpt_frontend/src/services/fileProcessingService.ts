import type { TextChunk } from "@/types";
import { isTextMimeType } from "@/utils/fileUtils";
import { useEmbeddingStore } from "@/store/embeddingStore";
import { convertPdfToImages } from "@/utils/pdfUtils";
import { useChatStore } from "@/store/chatStore";
import { getUniqueFileName } from "@/utils/fileUtils";

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
  parentId: number;
  chunks?: Omit<TextChunk, "text">[]; // Pre-existing chunks
  existingFileNames: string[]; // For rename collision handling
  uploadFilesAction: (
    files: Array<{
      file: File;
      chunks?: Omit<TextChunk, "text">[];
    }>,
    parentId: number,
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
          subStatus: `Batching ${allPageFiles.length} pages for extraction...`,
        });

        // OCR Execution
        const OCR_BATCH_SIZE = 3;
        const MAX_OCR_RETRIES = 2;
        const pageBatches: File[][] = [];
        for (let i = 0; i < allPageFiles.length; i += OCR_BATCH_SIZE) {
          pageBatches.push(allPageFiles.slice(i, i + OCR_BATCH_SIZE));
        }

        const totalBatches = pageBatches.length;
        const results: Array<
          | { status: "fulfilled"; value: string }
          | { status: "rejected"; reason: unknown }
        > = new Array(totalBatches);

        // Process batches with limited concurrency handled by the loop/promise structure
        for (let i = 0; i < pageBatches.length; i++) {
          const batch = pageBatches[i];
          try {
            const result = await retryAsync(
              () => useChatStore.getState().executeOcrOnImages(batch, modelId),
              MAX_OCR_RETRIES,
              2000,
              (attempt) => {
                updateJob({
                  subStatus: `OCR batch ${i + 1}/${totalBatches} failed, retrying (${attempt}/${MAX_OCR_RETRIES})...`,
                });
              },
            );
            results[i] = { status: "fulfilled", value: result };
          } catch (e) {
            console.error("Batch failed completely", {
              batchIndex: i + 1,
              error: e,
            });
            results[i] = { status: "rejected", reason: e };
          }

          const completedCount = i + 1;
          // 45% -> 90% for OCR
          const extractionProgress = (completedCount / totalBatches) * 45;
          updateJob({
            progress: 45 + extractionProgress,
            subStatus: `Extracted text from batch ${completedCount}/${totalBatches}.`,
          });
        }

        const successfulResults = results
          .filter(
            (r): r is { status: "fulfilled"; value: string } =>
              r?.status === "fulfilled" && !!r.value?.trim(),
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

        // Embedding
        updateJob({ status: "embedding", subStatus: "Embedding content..." });
        const { embedFileContent } = useEmbeddingStore.getState();
        const chunksWithText = await embedFileContent(allMarkdown, (p) =>
          updateJob({
            progress: 90 + p * 0.1, // 90-100% for embedding
            subStatus: `Embedding... ${Math.round(p)}%`,
          }),
        );

        // Explicitly map properties to avoid destructuring unused variables
        const finalChunks = chunksWithText.map((c) => ({
          chunk_index: c.chunk_index,
          start_char: c.start_char,
          end_char: c.end_char,
          embedding: c.embedding, // number[]
        }));

        updateJob({
          status: "uploading",
          subStatus: "Uploading processed file...",
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
          updateJob({ status: "embedding", subStatus: "Embedding content..." });
          const { embedFileContent } = useEmbeddingStore.getState();
          const fileContent = await file.text();

          const chunksWithText = await embedFileContent(fileContent, (p) =>
            updateJob({
              progress: p * 0.9, // 0-90% for embedding
              subStatus: `Embedding... ${Math.round(p)}%`,
            }),
          );

          // Explicitly map properties to avoid destructuring unused variables
          const finalChunks = chunksWithText.map((c) => ({
            chunk_index: c.chunk_index,
            start_char: c.start_char,
            end_char: c.end_char,
            embedding: c.embedding,
          }));

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
