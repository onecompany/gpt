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
}

export type FileSystemActions = ReadActions &
  WriteActions & {
    reset: () => void;
    buildSearchIndexForFile: (fileId: FileId) => Promise<void>;
    buildGlobalSearchIndex: () => Promise<void>;
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
        const filesToIndex = Array.from(files.values()).filter(
          (file) =>
            isTextMimeType(file.mimeType, file.name) &&
            !searchableChunks.has(file.id),
        );

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
    reset: () => set(initialState),
  })),
);
