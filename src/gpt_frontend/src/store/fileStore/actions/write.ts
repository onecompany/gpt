import { StateCreator } from "zustand";
import { useAuthStore } from "../../authStore";
import { UserApi } from "@/services/api/userApi";
import type { FileSystemStore } from "../index";
import {
  FileUploadJob,
  Folder,
  FileItem,
  TextChunk,
  FileUploadStatus,
} from "@/types";
import { isTextMimeType } from "@/utils/fileUtils";
import { FileProcessingService } from "@/services/fileProcessingService";
import { FolderId, FileId, toFileId, toFolderId } from "@/types/brands";

// Module-level ephemeral storage for files
const fileBlobStore = new Map<string, File>();
const CONCURRENCY_LIMIT = 3;

export interface WriteActions {
  createFolder: (name: string, parentId: FolderId) => Promise<void>;
  uploadFiles: (
    filesToUpload: Array<{
      file: File;
      chunks?: Omit<TextChunk, "text">[];
    }>,
    parentId: FolderId,
  ) => Promise<void>;
  renameItem: (
    id: string, // Generic ID string, will be cast
    type: "file" | "folder",
    newName: string,
  ) => Promise<void>;
  deleteItems: (
    itemsToDelete: Array<{ id: string; type: "file" | "folder" }>,
  ) => Promise<void>;
  addFileJob: (
    file: File,
    uiId: string,
    modelId?: string,
    chunks?: Omit<TextChunk, "text">[],
  ) => void;
  _manageJobQueue: () => void;
  _executeJob: (jobId: string) => Promise<void>;
  dismissJob: (jobId: string) => void;
}

export const createWriteActions: StateCreator<
  FileSystemStore,
  [],
  [],
  WriteActions
> = (set, get) => ({
  createFolder: async (name, parentId) => {
    const { authClient, userCanisterId } = useAuthStore.getState();
    if (!authClient || !userCanisterId) return;
    set({ status: "loading", error: null });
    try {
      const newFolderId = toFolderId(
        await UserApi.createFolder(
          authClient.getIdentity(),
          userCanisterId,
          name,
          parentId,
        ),
      );

      const newFolder: Folder = {
        id: newFolderId,
        name: name,
        parentId: parentId,
      };

      set((state) => {
        const newFolders = new Map(state.folders);
        newFolders.set(newFolder.id, newFolder);

        const newFolderContents = new Map(state.folderContents);
        const parentContent = newFolderContents.get(parentId) || {
          folders: [],
          files: [],
        };

        if (!parentContent.folders.includes(newFolder.id)) {
          newFolderContents.set(parentId, {
            ...parentContent,
            folders: [...parentContent.folders, newFolder.id],
          });
        }

        return {
          folders: newFolders,
          folderContents: newFolderContents,
          status: "idle",
        };
      });

      void get().fetchFolderContents(parentId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: `Failed to create folder: ${msg}`, status: "error" });
    }
  },

  uploadFiles: async (filesToUpload, parentId) => {
    const { authClient, userCanisterId } = useAuthStore.getState();
    if (!authClient || !userCanisterId) return;

    try {
      const uploadedItems = await Promise.all(
        filesToUpload.map(async ({ file, chunks }) => {
          const content = new Uint8Array(await file.arrayBuffer());

          const processedChunks = chunks
            ? chunks.map((c) => ({
                chunk_index: c.chunk_index,
                start_char: c.start_char,
                end_char: c.end_char,
                // Ensure embedding is number[] for UserApi mapping compatibility
                embedding: Array.isArray(c.embedding)
                  ? (c.embedding as number[])
                  : Array.from(c.embedding as unknown as Iterable<number>),
              }))
            : undefined;

          const newFileId = toFileId(
            await UserApi.uploadFile(authClient.getIdentity(), userCanisterId, {
              name: file.name,
              parentFolderId: parentId,
              mimeType: file.type,
              content,
              chunks: processedChunks,
            }),
          );

          const mappedChunks: TextChunk[] = chunks
            ? chunks.map((c) => ({
                chunk_index: Number(c.chunk_index),
                start_char: Number(c.start_char),
                end_char: Number(c.end_char),
                embedding: Array.isArray(c.embedding)
                  ? (c.embedding as number[])
                  : Array.from(c.embedding as unknown as Iterable<number>),
              }))
            : [];

          const newFileItem: FileItem = {
            id: newFileId,
            name: file.name,
            size: file.size,
            uploadedAt: new Date(),
            mimeType: file.type,
            parentId: parentId,
            chunks: mappedChunks,
          };

          return newFileItem;
        }),
      );

      set((state) => {
        const newFiles = new Map(state.files);
        const newFolderContents = new Map(state.folderContents);
        const currentContent = newFolderContents.get(parentId) || {
          files: [],
          folders: [],
        };
        const newFileList = [...currentContent.files];

        uploadedItems.forEach((item) => {
          newFiles.set(item.id, item);
          if (!newFileList.includes(item.id)) {
            newFileList.push(item.id);
          }
        });

        newFolderContents.set(parentId, {
          ...currentContent,
          files: newFileList,
        });

        return {
          files: newFiles,
          folderContents: newFolderContents,
        };
      });

      const hasTextFile = filesToUpload.some(({ file }) =>
        isTextMimeType(file.type, file.name),
      );
      if (hasTextFile) {
        set({ isIndexStale: true });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Upload failed", { error: msg });
      throw e;
    }
  },

  renameItem: async (id, type, newName) => {
    const { authClient, userCanisterId } = useAuthStore.getState();
    if (!authClient || !userCanisterId) return;

    const parentId =
      type === "file"
        ? get().files.get(id as FileId)?.parentId
        : get().folders.get(id as FolderId)?.parentId;
    if (parentId === undefined || parentId === null) return;

    set({ status: "loading", error: null });
    try {
      await UserApi.renameItem(
        authClient.getIdentity(),
        userCanisterId,
        id,
        type,
        newName,
      );

      set((state) => {
        const updates: Partial<FileSystemStore> = { status: "idle" };

        if (type === "file") {
          const fileId = id as FileId;
          const file = state.files.get(fileId);
          if (file) {
            const newFiles = new Map(state.files);
            newFiles.set(fileId, { ...file, name: newName });
            updates.files = newFiles;

            const newSearchableChunks = new Map(state.searchableChunks);
            newSearchableChunks.delete(fileId);
            updates.searchableChunks = newSearchableChunks;
            updates.isIndexStale = true;
          }
        } else {
          const folderId = id as FolderId;
          const folder = state.folders.get(folderId);
          if (folder) {
            const newFolders = new Map(state.folders);
            newFolders.set(folderId, { ...folder, name: newName });
            updates.folders = newFolders;
          }
        }
        return updates;
      });

      void get().fetchFolderContents(parentId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: `Failed to rename item: ${msg}`, status: "error" });
    }
  },

  deleteItems: async (itemsToDelete) => {
    const { authClient, userCanisterId } = useAuthStore.getState();
    if (!authClient || !userCanisterId || itemsToDelete.length === 0) return;

    const firstItem = itemsToDelete[0];
    const parentId =
      firstItem.type === "file"
        ? get().files.get(firstItem.id as FileId)?.parentId
        : get().folders.get(firstItem.id as FolderId)?.parentId;

    set({ status: "loading", error: null });
    try {
      const deletePromises = itemsToDelete.map((item) =>
        UserApi.deleteItem(
          authClient.getIdentity(),
          userCanisterId,
          item.id,
          item.type,
        ),
      );
      await Promise.all(deletePromises);

      set((state) => {
        const newFiles = new Map(state.files);
        const newFolders = new Map(state.folders);
        const newSearchableChunks = new Map(state.searchableChunks);
        let indexChanged = false;

        itemsToDelete.forEach((item) => {
          if (item.type === "file") {
            const fileId = item.id as FileId;
            newFiles.delete(fileId);
            if (newSearchableChunks.has(fileId)) {
              newSearchableChunks.delete(fileId);
              indexChanged = true;
            }
          } else {
            const folderId = item.id as FolderId;
            newFolders.delete(folderId);
          }
        });

        const updates: Partial<FileSystemStore> = {
          files: newFiles,
          folders: newFolders,
          status: "idle",
        };

        if (indexChanged) {
          updates.searchableChunks = newSearchableChunks;
          updates.isIndexStale = true;
        }

        if (parentId !== undefined && parentId !== null) {
          const content = state.folderContents.get(parentId);
          if (content) {
            const newFolderContents = new Map(state.folderContents);
            newFolderContents.set(parentId, {
              files: content.files.filter(
                (fid) =>
                  !itemsToDelete.some((i) => i.type === "file" && i.id === fid),
              ),
              folders: content.folders.filter(
                (fid) =>
                  !itemsToDelete.some(
                    (i) => i.type === "folder" && i.id === fid,
                  ),
              ),
            });
            updates.folderContents = newFolderContents;
          }
        }

        return updates;
      });

      if (parentId !== undefined && parentId !== null) {
        void get().fetchFolderContents(parentId);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: `Deletion failed: ${msg}`, status: "error" });
    }
  },

  addFileJob: (file, uiId, modelId, chunks) => {
    const jobId = `${file.name}-${file.size}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    fileBlobStore.set(jobId, file);

    let fileType: FileUploadJob["fileType"] = "other";
    if (file.type === "application/pdf") fileType = "pdf";
    else if (isTextMimeType(file.type, file.name)) fileType = "markdown";
    else if (file.type.startsWith("image/")) fileType = "image";

    const mappedChunksForJob = chunks?.map((c) => ({
      chunk_index: Number(c.chunk_index),
      start_char: Number(c.start_char),
      end_char: Number(c.end_char),
      embedding: Array.isArray(c.embedding)
        ? (c.embedding as number[])
        : Array.from(c.embedding as unknown as Iterable<number>),
    }));

    const newJob: FileUploadJob = {
      id: jobId,
      uiId,
      fileName: file.name,
      fileType,
      status: "queued",
      subStatus: "Waiting in queue...",
      progress: 0,
      error: null,
      modelId,
      retries: 0,
      chunks: mappedChunksForJob,
    };

    set((state) => ({
      fileProcessingJobs: { ...state.fileProcessingJobs, [jobId]: newJob },
    }));

    setTimeout(() => get()._manageJobQueue(), 0);
  },

  dismissJob: (jobId: string) => {
    set((state) => {
      const job = state.fileProcessingJobs[jobId];
      if (job && (job.status === "complete" || job.status === "error")) {
        const newJobs = { ...state.fileProcessingJobs };
        delete newJobs[jobId];
        fileBlobStore.delete(jobId);
        return { fileProcessingJobs: newJobs };
      }
      return {};
    });
  },

  _manageJobQueue: () => {
    const { fileProcessingJobs } = get();
    const jobs = Object.values(fileProcessingJobs);

    const activeJobs = jobs.filter((j) =>
      ["embedding", "converting", "extracting", "uploading"].includes(j.status),
    );

    const activeCount = activeJobs.length;
    const slotsAvailable = CONCURRENCY_LIMIT - activeCount;

    if (slotsAvailable > 0) {
      const queuedJobs = jobs.filter((j) => j.status === "queued");
      const jobsToStart = queuedJobs.slice(0, slotsAvailable);

      jobsToStart.forEach((job) => {
        void get()._executeJob(job.id);
      });
    }
  },

  _executeJob: async (jobId: string) => {
    set((state) => {
      const currentJob = state.fileProcessingJobs[jobId];
      if (!currentJob) return {};
      return {
        fileProcessingJobs: {
          ...state.fileProcessingJobs,
          [jobId]: {
            ...currentJob,
            status: "converting",
            subStatus: "Starting...",
          },
        },
      };
    });

    try {
      const job = get().fileProcessingJobs[jobId];
      if (!job) throw new Error(`Job ${jobId} not found in state.`);

      const file = fileBlobStore.get(jobId);
      if (!file) throw new Error(`File blob for job ${jobId} not found.`);

      const { currentFolderId, files, folders, folderContents } = get();
      if (currentFolderId === null)
        throw new Error("No active folder to upload to.");

      const existingNames = [
        ...(folderContents
          .get(currentFolderId)
          ?.files.map((id) => files.get(id)?.name) || []),
        ...(folderContents
          .get(currentFolderId)
          ?.folders.map((id) => folders.get(id)?.name) || []),
      ].filter(Boolean) as string[];

      await FileProcessingService.processFile({
        file,
        fileName: job.fileName,
        fileType: job.fileType,
        modelId: job.modelId,
        parentId: Number(currentFolderId), // Pass as number to utility, service maps it back to FolderId
        chunks: job.chunks,
        existingFileNames: existingNames,
        uploadFilesAction: async (files, parentId) =>
          get().uploadFiles(files, parentId as unknown as FolderId),
        updateJob: (update) => {
          set((state) => {
            const current = state.fileProcessingJobs[jobId];
            if (!current) return {};
            const statusUpdate = update.status as FileUploadStatus | undefined;
            return {
              fileProcessingJobs: {
                ...state.fileProcessingJobs,
                [jobId]: {
                  ...current,
                  ...update,
                  status: statusUpdate ?? current.status,
                },
              },
            };
          });
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Critical error in _executeJob", { jobId, error });
      set((state) => {
        const current = state.fileProcessingJobs[jobId];
        if (!current) return {};
        return {
          fileProcessingJobs: {
            ...state.fileProcessingJobs,
            [jobId]: { ...current, status: "error", error: msg },
          },
        };
      });
    } finally {
      const finalStatus = get().fileProcessingJobs[jobId]?.status;
      if (finalStatus === "complete" || finalStatus === "error") {
        fileBlobStore.delete(jobId);
      }
      get()._manageJobQueue();
    }
  },
});
