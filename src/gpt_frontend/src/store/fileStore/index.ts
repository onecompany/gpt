import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  FileItem,
  Folder,
  FileUploadJob,
  SearchableChunk,
  IndexingStatus,
  IndexingProgress,
} from "@/types";
import { createReadActions, ReadActions } from "./actions/read";
import { createWriteActions, WriteActions } from "./actions/write";
import { isTextMimeType } from "@/utils/fileUtils";
import { FileId, FolderId } from "@/types/brands";
import { EmbeddingService } from "@/services/embeddingService";

// IC response size limit is 2MB. With 1024-dim embeddings at 4 bytes each,
// each embedding is ~4KB. To stay safe, we limit batch embedding regeneration.
const MAX_EMBEDDING_BATCH_SIZE = 50; // ~200KB of embeddings per batch

export interface FileSystemState {
  files: Map<FileId, FileItem>;
  folders: Map<FolderId, Folder>;
  folderContents: Map<FolderId, { folders: FolderId[]; files: FileId[] }>;
  rootFolderId: FolderId | null;
  currentFolderId: FolderId | null;
  history: Array<{ id: FolderId; name: string }>;
  status: "idle" | "loading" | "error";
  error: string | null;
  fileProcessingJobs: Record<string, FileUploadJob>;
  searchableChunks: Map<FileId, SearchableChunk[]>;
  indexingStatus: IndexingStatus;
  indexingProgress: IndexingProgress | null;
  indexingError: string | null;
  isIndexStale: boolean;
  hydrationStatus: "idle" | "hydrating" | "hydrated";
  // Track files that need embedding regeneration (empty embeddings)
  filesNeedingEmbeddings: Set<FileId>;
}

export type FileSystemActions = ReadActions &
  WriteActions & {
    reset: () => void;
    buildSearchIndexForFile: (fileId: FileId) => Promise<void>;
    buildGlobalSearchIndex: () => Promise<void>;
    regenerateEmbeddingsForFile: (fileId: FileId) => Promise<void>;
    regenerateMissingEmbeddings: () => Promise<void>;
    hasValidEmbeddings: (fileId: FileId) => boolean;
  };

export type FileSystemStore = FileSystemState & FileSystemActions;

const initialState: FileSystemState = {
  files: new Map(),
  folders: new Map(),
  folderContents: new Map(),
  rootFolderId: null,
  currentFolderId: null,
  history: [],
  status: "idle",
  error: null,
  fileProcessingJobs: {},
  searchableChunks: new Map(),
  indexingStatus: "idle",
  indexingProgress: null,
  indexingError: null,
  isIndexStale: false,
  hydrationStatus: "idle",
  filesNeedingEmbeddings: new Set(),
};

// Helper to check if a file has valid (non-empty) embeddings
const fileHasValidEmbeddings = (file: FileItem): boolean => {
  if (!file.chunks || file.chunks.length === 0) return false;
  // Check if at least some chunks have non-empty embeddings
  return file.chunks.some(
    (chunk) =>
      chunk.embedding &&
      chunk.embedding.length > 0 &&
      chunk.embedding.some((v) => v !== 0),
  );
};

export const useFileStore = create<FileSystemStore>()(
  subscribeWithSelector((set, get, api) => ({
    ...initialState,
    ...createReadActions(set, get, api),
    ...createWriteActions(set, get, api),
    buildSearchIndexForFile: async (fileId) => {
      const logPrefix = `[FileStore:Index]`;
      if (get().searchableChunks.has(fileId)) {
        console.log(
          logPrefix,
          "Skipping index for file",
          fileId,
          "already indexed.",
        );
        return;
      }
      const file = get().files.get(fileId);
      if (!file || !isTextMimeType(file.mimeType, file.name)) return;

      console.log(
        logPrefix,
        "Building index for file",
        fileId,
        `("${file.name}")`,
      );
      const contentResult = await get().getFileContent(fileId);
      if (!contentResult)
        throw new Error(`Could not fetch content for file ${fileId}`);

      const text = new TextDecoder().decode(contentResult.content);
      const enrichedChunks: SearchableChunk[] = file.chunks.map((chunk) => ({
        ...chunk,
        id: `${file.id}-${chunk.chunk_index}`,
        fileId: file.id,
        text: text.substring(chunk.start_char, chunk.end_char),
      }));

      set((state) => {
        const newSearchableChunks = new Map(state.searchableChunks);
        newSearchableChunks.set(fileId, enrichedChunks);
        return { searchableChunks: newSearchableChunks };
      });
      console.log(
        logPrefix,
        "Indexing complete for file",
        fileId,
        ". Added",
        enrichedChunks.length,
        "chunks.",
      );
    },
    buildGlobalSearchIndex: async () => {
      const logPrefix = `[FileStore:Index]`;
      if (get().hydrationStatus !== "hydrated") {
        console.log(
          logPrefix,
          "Deferring global index build: File system not hydrated.",
        );
        return;
      }
      if (get().indexingStatus === "in-progress") {
        console.log(logPrefix, "Global index build already in progress.");
        return;
      }
      console.log(logPrefix, "Starting global search index build.");
      set({
        indexingStatus: "in-progress",
        isIndexStale: false,
        indexingError: null,
      });

      let wasSuccessful = false;
      try {
        const { files, searchableChunks, buildSearchIndexForFile } = get();

        // Debug logging for embedding diagnostics
        const allFiles = Array.from(files.values());
        const filesWithChunks = allFiles.filter(
          (f) => f.chunks && f.chunks.length > 0,
        );
        const filesWithValidEmbeddings = filesWithChunks.filter((f) =>
          fileHasValidEmbeddings(f),
        );
        console.log(logPrefix, "Files in store:", allFiles.length);
        console.log(logPrefix, "Files with chunks:", filesWithChunks.length);
        console.log(
          logPrefix,
          "Files with valid embeddings:",
          filesWithValidEmbeddings.length,
        );
        if (filesWithChunks.length > 0 && filesWithValidEmbeddings.length === 0) {
          const sample = filesWithChunks[0];
          console.log(logPrefix, "Sample file embedding debug:", {
            fileName: sample.name,
            chunksCount: sample.chunks.length,
            firstChunkEmbeddingLength: sample.chunks[0]?.embedding?.length,
            firstChunkEmbeddingSample: sample.chunks[0]?.embedding?.slice(0, 5),
          });
        }

        const filesToIndex = Array.from(files.values()).filter(
          (file) =>
            isTextMimeType(file.mimeType, file.name) &&
            !searchableChunks.has(file.id),
        );

        // Track files needing embeddings
        const filesNeedingEmbeddings = new Set<FileId>();
        for (const file of filesToIndex) {
          if (!fileHasValidEmbeddings(file)) {
            filesNeedingEmbeddings.add(file.id);
          }
        }
        set({ filesNeedingEmbeddings });

        if (filesToIndex.length === 0) {
          console.log(
            logPrefix,
            "No new files to index. Global index is up-to-date.",
          );
          wasSuccessful = true;
          return;
        }

        console.log(
          logPrefix,
          "Found",
          filesToIndex.length,
          "new file(s) to index.",
          filesNeedingEmbeddings.size,
          "need embedding regeneration.",
        );
        set({
          indexingProgress: {
            processed: 0,
            total: filesToIndex.length,
            currentFile: filesToIndex[0].name,
          },
        });

        const CONCURRENT_BATCH_SIZE = 5;
        for (let i = 0; i < filesToIndex.length; i += CONCURRENT_BATCH_SIZE) {
          const batch = filesToIndex.slice(i, i + CONCURRENT_BATCH_SIZE);
          console.log(
            logPrefix,
            "Processing batch",
            i / CONCURRENT_BATCH_SIZE + 1,
            "with",
            batch.length,
            "file(s).",
          );
          await Promise.all(
            batch.map(async (file, batchIndex) => {
              set({
                indexingProgress: {
                  processed: i + batchIndex,
                  total: filesToIndex.length,
                  currentFile: file.name,
                },
              });
              await buildSearchIndexForFile(file.id);
            }),
          );
        }
        wasSuccessful = true;
      } catch (e: unknown) {
        console.error(logPrefix, "Global index build failed:", e);
        const msg = e instanceof Error ? e.message : String(e);
        set({
          indexingError: msg,
        });
      } finally {
        const finalStatus = wasSuccessful ? "complete" : "error";
        console.log(
          logPrefix,
          "Global index build finished with status:",
          finalStatus,
        );
        set({
          indexingStatus: finalStatus,
          indexingProgress: null,
        });
        if (wasSuccessful && get().isIndexStale) {
          console.log(
            logPrefix,
            "Index became stale during build, re-running.",
          );
          setTimeout(() => get().buildGlobalSearchIndex(), 100);
        }
      }
    },

    /**
     * Check if a file has valid (non-empty) embeddings stored.
     */
    hasValidEmbeddings: (fileId: FileId): boolean => {
      const file = get().files.get(fileId);
      if (!file) return false;
      return fileHasValidEmbeddings(file);
    },

    /**
     * Regenerate embeddings for a single file.
     * Fetches file content and generates embeddings via EmbeddingService.
     */
    regenerateEmbeddingsForFile: async (fileId: FileId): Promise<void> => {
      const logPrefix = "[FileStore:Embedding]";
      const file = get().files.get(fileId);
      if (!file || !isTextMimeType(file.mimeType, file.name)) {
        console.log(logPrefix, "Skipping non-text file", fileId);
        return;
      }

      if (!EmbeddingService.isEmbeddingModelAvailable()) {
        console.warn(logPrefix, "Embedding model not available");
        return;
      }

      console.log(logPrefix, "Regenerating embeddings for file", fileId);

      // Fetch file content
      const contentResult = await get().getFileContent(fileId);
      if (!contentResult) {
        console.error(logPrefix, "Could not fetch content for file", fileId);
        return;
      }

      const text = new TextDecoder().decode(contentResult.content);

      // Generate embeddings for each chunk
      const updatedChunks = [...file.chunks];
      const BATCH_SIZE = 5;

      for (let i = 0; i < updatedChunks.length; i += BATCH_SIZE) {
        const batch = updatedChunks.slice(i, i + BATCH_SIZE);
        const batchTexts = batch.map((chunk) =>
          text.substring(chunk.start_char, chunk.end_char),
        );

        try {
          const embeddings = await EmbeddingService.generateEmbeddings(
            batchTexts,
            BATCH_SIZE,
          );

          for (let j = 0; j < batch.length; j++) {
            updatedChunks[i + j] = {
              ...batch[j],
              embedding: embeddings[j],
            };
          }
        } catch (error) {
          console.error(
            logPrefix,
            "Failed to generate embeddings for batch",
            i,
            error,
          );
        }
      }

      // Update file with new embeddings
      set((state) => {
        const newFiles = new Map(state.files);
        newFiles.set(fileId, {
          ...file,
          chunks: updatedChunks,
        });

        // Update searchable chunks if they exist
        const existingSearchableChunks = state.searchableChunks.get(fileId);
        if (existingSearchableChunks) {
          const newSearchableChunks = new Map(state.searchableChunks);
          const updatedSearchable = existingSearchableChunks.map(
            (chunk, idx) => ({
              ...chunk,
              embedding: updatedChunks[idx]?.embedding ?? chunk.embedding,
            }),
          );
          newSearchableChunks.set(fileId, updatedSearchable);

          // Remove from files needing embeddings
          const newFilesNeedingEmbeddings = new Set(state.filesNeedingEmbeddings);
          newFilesNeedingEmbeddings.delete(fileId);

          return {
            files: newFiles,
            searchableChunks: newSearchableChunks,
            filesNeedingEmbeddings: newFilesNeedingEmbeddings,
          };
        }

        // Remove from files needing embeddings
        const newFilesNeedingEmbeddings = new Set(state.filesNeedingEmbeddings);
        newFilesNeedingEmbeddings.delete(fileId);

        return {
          files: newFiles,
          filesNeedingEmbeddings: newFilesNeedingEmbeddings,
        };
      });

      console.log(
        logPrefix,
        "Successfully regenerated embeddings for file",
        fileId,
      );
    },

    /**
     * Regenerate embeddings for all files that are missing them.
     * Processes in batches to handle IC 2MB response limit efficiently.
     */
    regenerateMissingEmbeddings: async (): Promise<void> => {
      const logPrefix = "[FileStore:Embedding]";

      if (!EmbeddingService.isEmbeddingModelAvailable()) {
        console.warn(
          logPrefix,
          "Embedding model not available, skipping regeneration",
        );
        return;
      }

      const { files, filesNeedingEmbeddings, regenerateEmbeddingsForFile } =
        get();

      // Also check for files that might have been added since last check
      const allFilesNeedingEmbeddings = new Set(filesNeedingEmbeddings);
      for (const [fileId, file] of files.entries()) {
        if (
          isTextMimeType(file.mimeType, file.name) &&
          !fileHasValidEmbeddings(file)
        ) {
          allFilesNeedingEmbeddings.add(fileId);
        }
      }

      if (allFilesNeedingEmbeddings.size === 0) {
        console.log(logPrefix, "All files have valid embeddings");
        return;
      }

      console.log(
        logPrefix,
        `Regenerating embeddings for ${allFilesNeedingEmbeddings.size} files`,
      );

      const fileIds = Array.from(allFilesNeedingEmbeddings);
      let processed = 0;

      // Process in batches to avoid overwhelming the embedding service
      for (let i = 0; i < fileIds.length; i += MAX_EMBEDDING_BATCH_SIZE) {
        const batch = fileIds.slice(i, i + MAX_EMBEDDING_BATCH_SIZE);
        console.log(
          logPrefix,
          `Processing embedding batch ${Math.floor(i / MAX_EMBEDDING_BATCH_SIZE) + 1}`,
        );

        // Process files in the batch sequentially to avoid rate limits
        for (const fileId of batch) {
          try {
            await regenerateEmbeddingsForFile(fileId);
            processed++;
          } catch (error) {
            console.error(
              logPrefix,
              "Failed to regenerate embeddings for file",
              fileId,
              error,
            );
          }
        }

        console.log(
          logPrefix,
          `Completed ${processed}/${fileIds.length} files`,
        );
      }

      console.log(logPrefix, "Embedding regeneration complete");
    },

    reset: () => set(initialState),
  })),
);
