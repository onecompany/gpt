import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import useMediaQuery from "@/hooks/useMediaQuery";
import { FilesPageHeader } from "./FilesPageHeader";
import { BreadcrumbNav } from "./BreadcrumbNav";
import { UploadQueueDropdown } from "../dropdowns/UploadQueueDropdown";
import { FileList } from "./FileList";
import { UploadModal } from "./modals/UploadModal";
import { ViewFileModal } from "./modals/ViewFileModal";
import type { FileItem, Folder, GlobalSearchResult } from "@/types";
import { useFileStore } from "@/store/fileStore";
import { useEmbeddingStore } from "@/store/embeddingStore";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileId } from "@/types/brands";

type SortField = "name" | "size" | "uploadedAt" | "type";
type SortOrder = "asc" | "desc";
type ViewMode = "grid" | "list" | "chunks";

export const FilesPageComponent: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    status,
    error,
    files: allFiles,
    folders,
    currentFolderId,
    rootFolderId,
    history,
    navigateToPath,
    navigateToFolder,
    navigateToHistoryIndex,
    createFolder,
    renameItem,
    deleteItems,
    folderContents,
    searchableChunks,
    buildGlobalSearchIndex,
    indexingStatus,
    indexingProgress,
    indexingError,
  } = useFileStore();
  const { runSearch } = useEmbeddingStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("uploadedAt");
  const [sortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewingFile, setViewingFile] = useState<FileItem | null>(null);
  const [searchResults, setSearchResults] = useState<
    GlobalSearchResult[] | null
  >(null);
  const [isChunkSearching, setIsChunkSearching] = useState(false);

  const isMobile = useMediaQuery("(max-width: 640px)");
  const pathFromUrl = searchParams.get("path");
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    navigateToPath(pathFromUrl);
  }, [pathFromUrl, navigateToPath]);

  useEffect(() => {
    if (status === "loading" || history.length === 0 || rootFolderId === null)
      return;

    const pathFromHistory =
      history.length > 1
        ? history
            .slice(1)
            .map((h) => h.name)
            .join("/")
        : null;

    if (pathFromUrl !== pathFromHistory) {
      const newUrl = pathFromHistory
        ? `${pathname}?path=${encodeURIComponent(pathFromHistory)}`
        : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [history, status, router, pathname, pathFromUrl, rootFolderId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (isMobile) setViewMode("grid");
  }, [isMobile]);

  useEffect(() => {
    const performSearch = async () => {
      setIsChunkSearching(true);
      try {
        const allSearchableChunks = Array.from(
          searchableChunks.values(),
        ).flat();

        console.log(
          `[FilesPage] Searching over ${allSearchableChunks.length} total chunks from ${searchableChunks.size} files.`,
        );
        if (allSearchableChunks.length === 0) {
          setSearchResults([]);
          return;
        }

        const results = await runSearch(
          debouncedSearchQuery,
          allSearchableChunks,
          "text",
        );

        const chunkToFileMap = new Map<string, { name: string; id: FileId }>();
        searchableChunks.forEach((_chunks, fileId) => {
          const file = allFiles.get(fileId);
          if (file) {
            _chunks.forEach((chunk) => {
              chunkToFileMap.set(`${fileId}-${chunk.chunk_index}`, {
                name: file.name,
                id: file.id,
              });
            });
          }
        });

        const resultsWithFileInfo: GlobalSearchResult[] = results
          .map((result) => ({
            ...result,
            fileInfo: chunkToFileMap.get(result.id)!,
          }))
          .filter((r): r is GlobalSearchResult => !!r.fileInfo);

        console.log(
          `[FilesPage] Search complete. Found ${resultsWithFileInfo.length} results.`,
        );
        setSearchResults(resultsWithFileInfo);
      } catch (error) {
        console.error("Chunk search failed:", error);
        setSearchResults([]);
      } finally {
        setIsChunkSearching(false);
      }
    };

    if (viewMode !== "chunks") {
      setSearchResults(null);
      return;
    }

    if (debouncedSearchQuery.trim()) {
      if (indexingStatus === "idle") {
        void buildGlobalSearchIndex();
      } else if (indexingStatus === "complete") {
        void performSearch();
      }
    }
  }, [
    debouncedSearchQuery,
    viewMode,
    indexingStatus,
    buildGlobalSearchIndex,
    runSearch,
    searchableChunks,
    allFiles,
  ]);


  const { displayedFolders, displayedFiles } = useMemo(() => {
    if (currentFolderId === null)
      return { displayedFolders: [], displayedFiles: [] };

    const content = folderContents.get(currentFolderId);
    if (!content) return { displayedFolders: [], displayedFiles: [] };

    const filteredFolders = content.folders
      .map((id) => folders.get(id))
      .filter(
        (f): f is Folder =>
          !!f &&
          f.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
      );

    const filteredFiles = content.files
      .map((id) => allFiles.get(id))
      .filter(
        (f): f is FileItem =>
          !!f &&
          f.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
      );

    filteredFolders.sort((a, b) => a.name.localeCompare(b.name));
    filteredFiles.sort((a, b) => {
      if (sortField === "name") return a.name.localeCompare(b.name);
      if (sortField === "size") return a.size - b.size;
      return b.uploadedAt.getTime() - a.uploadedAt.getTime();
    });

    if (sortOrder === "desc") {
      filteredFolders.reverse();
      filteredFiles.reverse();
    }

    return { displayedFolders: filteredFolders, displayedFiles: filteredFiles };
  }, [
    folders,
    allFiles,
    currentFolderId,
    debouncedSearchQuery,
    sortField,
    sortOrder,
    folderContents,
  ]);

  const handleFolderClick = useCallback(
    (folder: Folder) => {
      navigateToFolder(folder.id);
    },
    [navigateToFolder],
  );

  const handleNavigateHistory = useCallback(
    (index: number) => {
      navigateToHistoryIndex(index);
    },
    [navigateToHistoryIndex],
  );

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  }, []);

  const selectAllItems = useCallback(() => {
    const allIds = [
      ...displayedFolders.map((f) => f.id),
      ...displayedFiles.map((f) => f.id),
    ];
    setSelectedItems(new Set(allIds));
  }, [displayedFolders, displayedFiles]);

  const handleRenameItem = useCallback(
    (itemId: string, isFolder: boolean) => {
      // Cast the ID back to the specific type for lookup
      const item = isFolder
        ? folders.get(itemId as any)
        : allFiles.get(itemId as any);

      if (!item) return;
      const newName = prompt(`Enter new name for "${item.name}":`, item.name);
      if (newName && newName.trim() && newName.trim() !== item.name) {
        renameItem(itemId, isFolder ? "folder" : "file", newName.trim());
      }
    },
    [allFiles, folders, renameItem],
  );

  const handleDeleteSelected = useCallback(() => {
    const itemsToDelete = Array.from(selectedItems).map((id) => ({
      id,
      type: folders.has(id as any) ? ("folder" as const) : ("file" as const),
    }));
    if (itemsToDelete.length === 0) return;
    if (confirm(`Delete ${itemsToDelete.length} selected items?`)) {
      deleteItems(itemsToDelete);
      setSelectedItems(new Set());
    }
  }, [selectedItems, folders, deleteItems]);

  const handleCreateFolder = useCallback(() => {
    const folderName = prompt("Enter new folder name:");
    if (folderName && folderName.trim() && currentFolderId !== null) {
      createFolder(folderName.trim(), currentFolderId);
    }
  }, [currentFolderId, createFolder]);

  const handleDownloadFile = useCallback(async (file: FileItem) => {
    console.log("Download requested for:", file.name);
    // Download logic moved to ViewFileModal or dedicated handler
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    if (mode === "chunks") {
      setSelectedItems(new Set());
    }
    setViewMode(mode);
  };

  const handleFileView = useCallback(
    (fileOrFileId: FileItem | FileId) => {
      const fileToView =
        typeof fileOrFileId === "string"
          ? allFiles.get(fileOrFileId)
          : fileOrFileId;
      if (fileToView) {
        setViewingFile(fileToView);
      }
    },
    [allFiles],
  );

  if (rootFolderId === null && status !== "error") {
    return (
      <div className="flex grow items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <CircleNotchIcon size={24} className="text-zinc-400 animate-spin" />
        </motion.div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <motion.div
        className="p-6 text-red-400 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-lg font-medium mb-2">Error</p>
        <p className="text-sm">{error}</p>
      </motion.div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full max-w-7xl mx-auto w-full px-3 lg:px-4">
      <div className="flex-1 flex flex-col overflow-hidden">
        <FilesPageHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onCreateFolder={handleCreateFolder}
          onUpload={() => setShowUploadModal(true)}
          hasSelection={selectedItems.size > 0}
          selectionCount={selectedItems.size}
          onClearSelection={() => setSelectedItems(new Set())}
          onDeleteSelected={handleDeleteSelected}
          isMobile={isMobile}
        />
        <div className="flex items-center justify-between mt-3.5 mb-1 min-h-6 gap-4">
          <BreadcrumbNav
            folderHistory={history}
            onNavigateHistory={handleNavigateHistory}
            className="flex-1 min-w-0"
          />
          <AnimatePresence>
            <UploadQueueDropdown />
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentFolderId}
            className="flex-1 overflow-y-auto py-3 lg:py-4"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <FileList
              folders={displayedFolders}
              files={displayedFiles}
              selectedItems={selectedItems}
              viewMode={viewMode}
              isMobile={isMobile}
              debouncedSearchQuery={debouncedSearchQuery}
              sortField={sortField}
              sortOrder={sortOrder}
              onSortChange={setSortField}
              onItemSelect={toggleItemSelection}
              onSelectAll={selectAllItems}
              onClearSelection={() => setSelectedItems(new Set())}
              onFolderOpen={handleFolderClick}
              onFileView={handleFileView}
              onRename={handleRenameItem}
              onDelete={(id, isFolder) =>
                deleteItems([{ id, type: isFolder ? "folder" : "file" }])
              }
              onDownload={handleDownloadFile}
              onCreateFolder={handleCreateFolder}
              onUpload={() => setShowUploadModal(true)}
              searchResults={searchResults}
              isChunkSearching={isChunkSearching}
              indexingStatus={indexingStatus}
              indexingProgress={indexingProgress}
              indexingError={indexingError}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        currentFolderId={currentFolderId}
      />
      <ViewFileModal file={viewingFile} onClose={() => setViewingFile(null)} />
    </div>
  );
};

FilesPageComponent.displayName = "FilesPageComponent";
