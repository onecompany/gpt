import React, { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogPanel } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import type { FileItem, SearchResult } from "@/types";
import { isTextMimeType } from "@/utils/fileUtils";
import {
  CircleNotchIcon,
  WarningCircleIcon,
  FileIcon,
} from "@phosphor-icons/react";
import { useFileStore } from "@/store/fileStore";
import { useEmbeddingStore, type SearchMode } from "@/store/embeddingStore";
import { FilePreviewHeader } from "./FilePreviewHeader";
import { SearchResultsList } from "./SearchResultsList";

const SEARCH_DEBOUNCE_MS = 400;

export const ViewFileModal: React.FC<{
  file: FileItem | null;
  onClose: () => void;
}> = ({ file, onClose }) => {
  const { getFileContent, buildSearchIndexForFile } = useFileStore();
  const { runSearch, isEmbeddingAvailable } = useEmbeddingStore();
  const searchableChunks = useFileStore((state) =>
    file ? state.searchableChunks.get(file.id) : null,
  );

  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>("text");

  // Debounced search with ref to track latest values
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestSearchRef = useRef({ query: "", mode: searchMode });

  useEffect(() => {
    let objectUrl: string | null = null;
    const fetchAndProcessContent = async () => {
      if (!file) return;

      setIsLoadingContent(true);
      setError(null);
      setPreviewSrc(null);
      setTextContent(null);
      setSearchQuery("");
      setSearchResults([]);

      try {
        const contentResult = await getFileContent(file.id);
        if (!contentResult) throw new Error("Failed to load file content.");

        if (file.mimeType.startsWith("image/")) {
          const blob = new Blob([contentResult.content.slice()], {
            type: contentResult.mimeType,
          });
          objectUrl = URL.createObjectURL(blob);
          setPreviewSrc(objectUrl);
        } else if (isTextMimeType(file.mimeType, file.name)) {
          const text = new TextDecoder().decode(contentResult.content);
          setTextContent(text);

          const { searchableChunks: currentChunks } = useFileStore.getState();
          if (!currentChunks.has(file.id)) {
            if (file.chunks && file.chunks.length > 0) {
              void buildSearchIndexForFile(file.id);
            } else {
              console.warn(
                "[ViewFileModal] File is text-based but has no chunks. Search will be disabled.",
              );
            }
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Error loading file: ${msg}`);
        console.error("[ViewFileModal] Error in fetchAndProcessContent:", e);
      } finally {
        setIsLoadingContent(false);
      }
    };
    void fetchAndProcessContent();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, getFileContent, buildSearchIndexForFile]);

  // Check embedding availability for current chunks
  const embeddingAvailable = searchableChunks
    ? isEmbeddingAvailable(searchableChunks)
    : false;

  // Debounced search effect
  const performSearch = useCallback(async () => {
    const { query, mode } = latestSearchRef.current;

    if (!query.trim() || !searchableChunks) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await runSearch(query, searchableChunks, mode);
      setSearchResults(results);
    } catch (e: unknown) {
      console.error("Search failed:", e);
      setError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, [searchableChunks, runSearch]);

  useEffect(() => {
    // Update ref with latest values
    latestSearchRef.current = { query: searchQuery, mode: searchMode };

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Clear results immediately if query is empty
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    // Debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      void performSearch();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchMode, performSearch]);

  const handleDownload = async () => {
    if (!file) return;
    const result = await getFileContent(file.id);
    if (result) {
      const blob = new Blob([result.content.slice()], {
        type: result.mimeType,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      alert("Failed to download file.");
    }
  };

  const renderContent = () => {
    if (isLoadingContent) {
      return (
        <motion.div
          key="loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex items-center justify-center"
        >
          <CircleNotchIcon size={32} className="text-zinc-500 animate-spin" />
        </motion.div>
      );
    }

    if (error) {
      return (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col items-center justify-center text-red-400 text-center"
        >
          <WarningCircleIcon size={32} className="mb-2" />
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      );
    }

    if (searchQuery) {
      return (
        <motion.div
          key="search-results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col min-h-0"
        >
          <SearchResultsList
            results={searchResults}
            isSearching={isSearching}
            query={searchQuery}
          />
        </motion.div>
      );
    }

    if (previewSrc) {
      return (
        <motion.div
          key="image-preview"
          className="flex-1 flex items-center justify-center p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt={file!.name}
            className="max-w-full max-h-full object-contain"
          />
        </motion.div>
      );
    }

    if (textContent !== null) {
      return (
        <motion.div
          key="text-preview"
          className="flex-1 overflow-y-auto bg-zinc-950 p-4"
        >
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap wrap-break-word">
            {textContent}
          </pre>
        </motion.div>
      );
    }

    return (
      <motion.div
        key="placeholder"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 flex flex-col items-center justify-center text-center text-zinc-600"
      >
        <FileIcon size={80} weight="light" />
        <p className="mt-2 text-sm">
          Preview not available for this file type.
        </p>
      </motion.div>
    );
  };

  const isSearchable = !!searchableChunks;

  return (
    <AnimatePresence>
      {file && (
        <Dialog open={!!file} onClose={onClose} className="relative z-60">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="fixed inset-0 bg-black/75"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel
              as={motion.div}
              key="panel"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{
                opacity: 1,
                scale: 1,
                transition: { duration: 0.2 },
              }}
              exit={{
                opacity: 0,
                scale: 0.98,
                transition: { duration: 0.2 },
              }}
              className="w-full max-w-4xl h-[85vh] max-h-200 flex flex-col overflow-hidden rounded-xl bg-zinc-900 shadow-2xl ring-1 ring-zinc-700"
            >
              <FilePreviewHeader
                file={file}
                isSearchable={isSearchable}
                searchQuery={searchQuery}
                isSearching={isSearching}
                searchMode={searchMode}
                isEmbeddingAvailable={embeddingAvailable}
                onSearchChange={setSearchQuery}
                onSearchModeChange={setSearchMode}
                onDownload={handleDownload}
                onClose={onClose}
              />
              <div className="flex-1 flex flex-col min-h-0 relative">
                <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};
