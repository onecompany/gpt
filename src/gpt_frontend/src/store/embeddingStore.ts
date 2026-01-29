import { create } from "zustand";
import { TextChunk, SearchResult } from "@/types";

type EmbeddingStatus = "IDLE" | "LOADING" | "READY" | "ERROR";

// Define strict return types for worker operations
type EmbedResultData = (TextChunk & { text: string })[];
type SearchResultData = SearchResult[];
type WorkerResultData = EmbedResultData | SearchResultData;

type WorkerPayload =
  | { type: "status"; payload: { status: EmbeddingStatus; message: string } }
  | { type: "model_info"; payload: ModelInfo }
  | { type: "progress"; payload: { progress: number; chunks: number } }
  | {
      type: "embed_result";
      payload: { reqId: string; result: WorkerResultData };
    }
  | { type: "embed_error"; payload: { reqId: string; error: string } };

interface ModelInfo {
  isQuantized: boolean;
  dtype: string;
  modelSize: number;
}

interface PendingRequest {
  resolve: (value: WorkerResultData) => void;
  reject: (reason?: unknown) => void;
  onProgress?: (progress: number, chunks: number) => void;
}

interface EmbeddingState {
  worker: Worker | null;
  status: EmbeddingStatus;
  statusMessage: string;
  modelInfo: ModelInfo | null;
  initWorker: () => void;
  embedFileContent: (
    fileContent: string,
    onProgress?: (progress: number, chunks: number) => void,
  ) => Promise<EmbedResultData>;
  runHybridSearch: (
    query: string,
    chunks: EmbedResultData,
  ) => Promise<SearchResultData>;
  _pendingRequests: Map<string, PendingRequest>;
  resetWorker: () => void;
  getWorkerHealth: () => { isHealthy: boolean; details: string };
  getModelInfo: () => Promise<ModelInfo | null>;
}

export const useEmbeddingStore = create<EmbeddingState>((set, get) => ({
  worker: null,
  status: "IDLE",
  statusMessage: "Waiting to initialize.",
  modelInfo: null,
  _pendingRequests: new Map(),

  initWorker: () => {
    console.log(
      "Worker was archived and is no longer in use. To be rewritten with better embedding support.",
    );
    /*     const currentWorker = get().worker;
        if (currentWorker && get().status === "READY") {
          console.log("[EmbeddingStore] Worker already initialized and ready.");
          return;
        }
    
        if (currentWorker) {
          console.log("[EmbeddingStore] Cleaning up existing worker...");
          currentWorker.terminate();
        }
    
        console.log("[EmbeddingStore] Initializing new optimized worker...");
    
        try {
          const worker = new Worker(
            new URL("../services/embedding.worker.ts", import.meta.url),
          );
    
          const initTimeout = setTimeout(() => {
            console.error(
              "[EmbeddingStore] Worker initialization timeout after 60s",
            );
            set({
              status: "ERROR",
              statusMessage:
                "Worker initialization timed out. Please refresh and try again.",
            });
            worker.terminate();
          }, 60000);
    
          worker.onmessage = (e: MessageEvent<WorkerPayload>) => {
            const { type, payload } = e.data;
    
            switch (type) {
              case "status":
                clearTimeout(initTimeout);
                console.log(
                  `[EmbeddingStore] Status update: ${payload.status} - ${payload.message}`,
                );
                set({ status: payload.status, statusMessage: payload.message });
    
                if (payload.status === "READY") {
                  worker.postMessage({ type: "get_model_info" });
                }
                break;
    
              case "model_info":
                set({ modelInfo: payload });
                console.log("[EmbeddingStore] Received model info:", payload);
                break;
    
              case "progress": {
                const { progress, chunks } = payload;
                get()._pendingRequests.forEach((request) => {
                  if (request.onProgress) {
                    request.onProgress(progress, chunks);
                  }
                });
                break;
              }
    
              case "embed_result": {
                const { reqId, result } = payload;
                console.log(`[EmbeddingStore] Resolved request ${reqId}.`);
                const promise = get()._pendingRequests.get(reqId);
                if (promise) {
                  promise.resolve(result);
                  get()._pendingRequests.delete(reqId);
                } else {
                  console.warn(
                    `[EmbeddingStore] No pending request found for reqId: ${reqId}`,
                  );
                }
                break;
              }
    
              case "embed_error": {
                const { reqId, error } = payload;
                console.error(`[EmbeddingStore] Failed request ${reqId}: ${error}`);
                const promise = get()._pendingRequests.get(reqId);
                if (promise) {
                  promise.reject(new Error(error));
                  get()._pendingRequests.delete(reqId);
                } else {
                  console.warn(
                    `[EmbeddingStore] No pending request found for error reqId: ${reqId}`,
                  );
                }
                break;
              }
    
              default:
                console.warn(`[EmbeddingStore] Unknown message type: ${type}`);
            }
          };
    
          worker.onerror = (e) => {
            console.error("[EmbeddingStore] Worker error:", e);
            clearTimeout(initTimeout);
            set({
              status: "ERROR",
              statusMessage: `Worker error: ${e.message || "Unknown error"}`,
            });
    
            const pendingRequests = get()._pendingRequests;
            pendingRequests.forEach((promise) => {
              promise.reject(new Error("Worker crashed"));
            });
            pendingRequests.clear();
          };
    
          set({
            worker,
            status: "LOADING",
            statusMessage: "Worker created, initializing optimized model...",
          });
    
          worker.postMessage({ type: "initialize_model" });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error("[EmbeddingStore] Failed to create worker:", error);
          set({
            status: "ERROR",
            statusMessage: `Failed to create worker: ${msg}`,
          });
        } */
  },

  embedFileContent: (
    fileContent: string,
    onProgress?: (progress: number, chunks: number) => void,
  ): Promise<EmbedResultData> => {
    return new Promise((resolve, reject) => {
      const worker = get().worker;
      const status = get().status;

      if (status !== "READY" || !worker) {
        const errorMsg = `Embedding service not ready. Status: ${status}`;
        console.error(`[EmbeddingStore] ${errorMsg}`);
        return reject(new Error(errorMsg));
      }

      if (!fileContent) {
        return reject(new Error("File content is empty"));
      }

      if (fileContent.length > 5 * 1024 * 1024) {
        return reject(new Error("File content exceeds 5MB limit"));
      }

      const reqId = `file-${Date.now()}-${Math.random()}`;
      console.log(
        `[EmbeddingStore] Starting embedding request ${reqId} for content of length ${fileContent.length}`,
      );

      // Cast specific resolve to generic handler to store in mixed Map
      get()._pendingRequests.set(reqId, {
        resolve: resolve as (value: WorkerResultData) => void,
        reject,
        onProgress,
      });

      try {
        worker.postMessage({
          type: "embed_file_content",
          payload: { fileContent, reqId },
        });
      } catch (error: unknown) {
        get()._pendingRequests.delete(reqId);
        console.error(
          `[EmbeddingStore] Failed to send message to worker:`,
          error,
        );
        const msg = error instanceof Error ? error.message : String(error);
        reject(new Error(`Failed to send to worker: ${msg}`));
        return;
      }

      setTimeout(() => {
        if (get()._pendingRequests.has(reqId)) {
          get()._pendingRequests.delete(reqId);
          console.error(
            `[EmbeddingStore] Request ${reqId} timed out after 120s`,
          );
          reject(
            new Error("File embedding request timed out after 120 seconds."),
          );
        }
      }, 120000);
    });
  },

  runHybridSearch: (
    query: string,
    chunks: EmbedResultData,
  ): Promise<SearchResultData> => {
    return new Promise((resolve, reject) => {
      const worker = get().worker;
      const status = get().status;

      if (status !== "READY" || !worker) {
        const errorMsg = `Search service not ready. Status: ${status}`;
        console.error(`[EmbeddingStore] ${errorMsg}`);
        return reject(new Error(errorMsg));
      }

      if (!query || !query.trim()) {
        return resolve([]);
      }

      if (!chunks || chunks.length === 0) {
        return resolve([]);
      }

      const reqId = `search-${Date.now()}-${Math.random()}`;
      console.log(
        `[EmbeddingStore] Starting search request ${reqId} for query "${query}" over ${chunks.length} chunks`,
      );

      // Cast specific resolve to generic handler to store in mixed Map
      get()._pendingRequests.set(reqId, {
        resolve: resolve as (value: WorkerResultData) => void,
        reject,
      });

      try {
        worker.postMessage({
          type: "run_hybrid_search",
          payload: { query, chunks, reqId },
        });
      } catch (error: unknown) {
        get()._pendingRequests.delete(reqId);
        console.error(
          `[EmbeddingStore] Failed to send search message to worker:`,
          error,
        );
        const msg = error instanceof Error ? error.message : String(error);
        reject(new Error(`Failed to send to worker: ${msg}`));
        return;
      }

      setTimeout(() => {
        if (get()._pendingRequests.has(reqId)) {
          get()._pendingRequests.delete(reqId);
          console.error(`[EmbeddingStore] Search request ${reqId} timed out`);
          reject(new Error("Search request timed out."));
        }
      }, 30000);
    });
  },

  getModelInfo: (): Promise<ModelInfo | null> => {
    return new Promise((resolve) => {
      const worker = get().worker;
      const currentInfo = get().modelInfo;

      if (currentInfo) {
        return resolve(currentInfo);
      }

      if (!worker || get().status !== "READY") {
        return resolve(null);
      }

      worker.postMessage({ type: "get_model_info" });

      setTimeout(() => {
        resolve(get().modelInfo);
      }, 1000);
    });
  },

  resetWorker: () => {
    console.log("[EmbeddingStore] Resetting worker...");

    const worker = get().worker;
    if (worker) {
      worker.terminate();
    }

    const pendingRequests = get()._pendingRequests;
    pendingRequests.forEach((promise) => {
      promise.reject(new Error("Worker reset"));
    });
    pendingRequests.clear();

    set({
      worker: null,
      status: "IDLE",
      statusMessage: "Worker reset. Ready to reinitialize.",
      modelInfo: null,
      _pendingRequests: new Map(),
    });
  },

  getWorkerHealth: () => {
    const { status, statusMessage, _pendingRequests, modelInfo } = get();
    const pendingCount = _pendingRequests.size;

    const isHealthy = status === "READY" && pendingCount < 10;
    const details = `Status: ${status}, Message: ${statusMessage}, Pending requests: ${pendingCount}, Model: ${
      modelInfo?.dtype || "unknown"
    }`;

    return { isHealthy, details };
  },
}));
