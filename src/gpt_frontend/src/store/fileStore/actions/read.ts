import { StateCreator } from "zustand";
import { useAuthStore } from "../../authStore";
import { UserApi } from "@/services/api/userApi";
import type { FileSystemStore, FileSystemState } from "../index";
import { toFolderId, FolderId, FileId } from "@/types/brands";
import { fromBigInt } from "@/utils/candidUtils";

export interface ReadActions {
  fetchFolderContents: (folderId: FolderId | null) => Promise<void>;
  navigateToPath: (path: string | null) => Promise<void>;
  getFileContent: (
    fileId: FileId,
  ) => Promise<{ content: Uint8Array; mimeType: string } | null>;
  navigateToFolder: (folderId: FolderId) => void;
  navigateBack: () => void;
  navigateToHistoryIndex: (index: number) => void;
}

export const createReadActions: StateCreator<
  FileSystemStore,
  [],
  [],
  ReadActions
> = (set, get) => ({
  fetchFolderContents: async (folderId) => {
    const { authClient, userCanisterId } = useAuthStore.getState();
    if (!authClient || !userCanisterId) {
      set({ error: "Authentication required.", status: "error" });
      return;
    }

    if (get().hydrationStatus === "hydrating") return;
    set({ status: "loading", error: null, hydrationStatus: "hydrating" });

    try {
      const isInitialHydration = get().rootFolderId === null;
      const pathForHistory: { id: FolderId; name: string }[] = [];
      let finalRootId: FolderId | null = null;

      const response = await UserApi.getFolderContent(
        authClient.getIdentity(),
        userCanisterId,
        folderId,
      );

      const currentFolderIdNum = toFolderId(response.folderId);
      const parentIdNum = response.parentFolderId
        ? toFolderId(response.parentFolderId)
        : null;

      if (isInitialHydration) {
        pathForHistory.unshift({
          id: currentFolderIdNum,
          name: response.folderName,
        });
        if (parentIdNum === null) {
          finalRootId = currentFolderIdNum;
        }
      }

      set((state: FileSystemState) => {
        const newFiles = new Map(state.files);
        response.files.forEach((f) => newFiles.set(f.id, f));

        const newFolders = new Map(state.folders);
        response.folders.forEach((f) => newFolders.set(f.id, f));

        newFolders.set(currentFolderIdNum, {
          id: currentFolderIdNum,
          name: response.folderName,
          parentId: parentIdNum,
        });

        const newFolderContents = new Map(state.folderContents);
        newFolderContents.set(currentFolderIdNum, {
          folders: response.folders.map((f) => f.id),
          files: response.files.map((f) => f.id),
        });

        const historyUpdate =
          isInitialHydration && pathForHistory.length > 0
            ? pathForHistory
            : state.history.length === 0
              ? [{ id: currentFolderIdNum, name: response.folderName }]
              : state.history;

        return {
          files: newFiles,
          folders: newFolders,
          folderContents: newFolderContents,
          status: "idle",
          rootFolderId: finalRootId ?? state.rootFolderId,
          currentFolderId: currentFolderIdNum,
          history: historyUpdate,
        };
      });

      if (isInitialHydration) {
        set({ hydrationStatus: "hydrated" });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({
        hydrationStatus: "idle",
        error: `Failed to fetch content for folder ${
          folderId ?? "Home"
        }: ${msg}`,
        status: "error",
      });
    }
  },

  navigateToPath: async (path) => {
    const { authClient, userCanisterId } = useAuthStore.getState();
    if (!authClient || !userCanisterId) {
      set({ error: "Authentication required.", status: "error" });
      return;
    }
    if (get().status === "loading") return;
    set({ status: "loading", error: null });

    try {
      const result = await UserApi.getItemByPath(
        authClient.getIdentity(),
        userCanisterId,
        path ?? "/",
      );

      const targetFolderId =
        result.item.type === "folder"
          ? (result.item.id as FolderId)
          : (result.item.parentId as FolderId);

      const history: { id: FolderId; name: string }[] = [];
      let currentId: FolderId | null = targetFolderId;

      while (currentId !== null) {
        let folderName = get().folders.get(currentId)?.name;
        let parentId: FolderId | null =
          get().folders.get(currentId)?.parentId ?? null;

        if (!folderName) {
          const folderContent = await UserApi.getFolderContent(
            authClient.getIdentity(),
            userCanisterId,
            currentId,
          );
          folderName = folderContent.folderName;
          parentId = folderContent.parentFolderId
            ? toFolderId(folderContent.parentFolderId)
            : null;
        }

        history.unshift({ id: currentId, name: folderName });
        currentId = parentId;
      }

      set({ history });
      await get().fetchFolderContents(targetFolderId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({
        error: `Failed to navigate to path: ${msg}`,
        status: "error",
      });
      // Fallback to root or null fetch if path invalid
      await get().fetchFolderContents(null);
    }
  },

  getFileContent: async (fileId) => {
    const { authClient, userCanisterId } = useAuthStore.getState();
    if (!authClient || !userCanisterId) return null;

    try {
      return await UserApi.getFileContent(
        authClient.getIdentity(),
        userCanisterId,
        fileId,
      );
    } catch {
      return null;
    }
  },

  navigateToFolder: (folderId) => {
    const folder = get().folders.get(folderId);
    if (!folder) return;
    set((state: FileSystemState) => ({
      currentFolderId: folderId,
      history: [...state.history, { id: folderId, name: folder.name }],
    }));
    // Eagerly fetch if not in cache
    if (!get().folderContents.has(folderId)) {
      void get().fetchFolderContents(folderId);
    }
  },

  navigateBack: () => {
    const history = get().history;
    if (history.length > 1) get().navigateToHistoryIndex(history.length - 2);
  },

  navigateToHistoryIndex: (index) => {
    const history = get().history;
    if (index < 0 || index >= history.length) return;
    const target = history[index];
    set({ currentFolderId: target.id, history: history.slice(0, index + 1) });
  },
});
