import { create } from "zustand";
import { Model } from "@/types";
import { IndexApi } from "@/services/api/indexApi";

interface ModelsState {
  models: Model[];
  imageModels: Model[];
  loading: boolean;
  hasFetched: boolean;
  error: string | null;
  fetchModels: (force?: boolean) => Promise<void>;
  updateNodeCounts: (counts: { [modelId: string]: number }) => void;
  getCheapestImageModel: () => Model | null;
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

    set({
      models: models,
      imageModels,
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
        return { models: newModels, imageModels: newImageModels };
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
  reset: () => {
    set({
      models: [],
      imageModels: [],
      loading: false,
      hasFetched: false,
      error: null,
    });
  },
}));
