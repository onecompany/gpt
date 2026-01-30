import { create } from "zustand";
import { Model } from "@/types";
import { IndexApi } from "@/services/api/indexApi";

// Default embedding model ID (Qwen3 Embedding 8B via DeepInfra)
export const DEFAULT_EMBEDDING_MODEL_ID = "deepinfra-qwen3-embedding-8b";

interface ModelsState {
  models: Model[];
  imageModels: Model[];
  embeddingModels: Model[];
  loading: boolean;
  hasFetched: boolean;
  error: string | null;
  fetchModels: (force?: boolean) => Promise<void>;
  updateNodeCounts: (counts: { [modelId: string]: number }) => void;
  getCheapestImageModel: () => Model | null;
  getEmbeddingModel: () => Model | null;
  isEmbeddingModelAvailable: () => boolean;
  reset: () => void;
}

const fetchModelsLogic = async (
  set: (
    partial:
      | ModelsState
      | Partial<ModelsState>
      | ((state: ModelsState) => ModelsState | Partial<ModelsState>),
    replace?: boolean | undefined,
  ) => void,
  hasFetched: boolean,
  force: boolean,
) => {
  if (!force && !hasFetched) {
    set({ loading: true, error: null });
  }

  try {
    const models = await IndexApi.getModels();

    const imageModels = models.filter((m) => m.max_image_attachments > 0);
    const embeddingModels = models.filter((m) => m.isEmbedding);

    set({
      models: models,
      imageModels,
      embeddingModels,
      loading: false,
      hasFetched: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch models.";
    console.error("fetchModels error:", message);
    set({ error: message, loading: false });
  }
};

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  imageModels: [],
  embeddingModels: [],
  loading: false,
  hasFetched: false,
  error: null,
  updateNodeCounts: (counts) =>
    set((state) => {
      let hasChanged = false;
      const newModels = state.models.map((model) => {
        const newCount = counts[model.modelId] ?? 0;
        if (model.nodeCount !== newCount) {
          hasChanged = true;
        }
        return {
          ...model,
          nodeCount: newCount,
        };
      });

      if (hasChanged) {
        const newImageModels = newModels.filter(
          (m) => m.max_image_attachments > 0,
        );
        const newEmbeddingModels = newModels.filter((m) => m.isEmbedding);
        return {
          models: newModels,
          imageModels: newImageModels,
          embeddingModels: newEmbeddingModels,
        };
      }

      return {};
    }),
  fetchModels: async (force = false) => {
    // If loading and not forced, return
    if (!force && get().loading) {
      return;
    }
    // Corrected state setter signature passing
    await fetchModelsLogic((args) => set(args), get().hasFetched, force);
  },
  getCheapestImageModel: () => {
    const { imageModels } = get();
    if (imageModels.length === 0) return null;

    return [...imageModels].sort(
      (a, b) =>
        a.inputTokenPrice +
        a.outputTokenPrice -
        (b.inputTokenPrice + b.outputTokenPrice),
    )[0];
  },
  getEmbeddingModel: () => {
    const { embeddingModels } = get();
    // Try to find the default embedding model first
    const defaultModel = embeddingModels.find(
      (m) => m.modelId === DEFAULT_EMBEDDING_MODEL_ID,
    );
    if (defaultModel && defaultModel.nodeCount > 0 && defaultModel.status === "Active") {
      return defaultModel;
    }
    // Fall back to any available embedding model
    const availableModel = embeddingModels.find(
      (m) => m.nodeCount > 0 && m.status === "Active",
    );
    return availableModel || null;
  },
  isEmbeddingModelAvailable: () => {
    const model = get().getEmbeddingModel();
    return model !== null;
  },
  reset: () => {
    set({
      models: [],
      imageModels: [],
      embeddingModels: [],
      loading: false,
      hasFetched: false,
      error: null,
    });
  },
}));
