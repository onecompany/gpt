import { StateCreator } from "zustand";
import { Model, CompressionLevel, RenderMode, Tool } from "../../../../types";
import { ChatStoreState } from "../../index";
import { chatParameterOptions } from "@/constants/constants";

// Removed unused _state parameter
const handleModelChange = (model: Model | null): Partial<ChatStoreState> => {
  if (!model) {
    return { selectedModel: null, selectedTools: [] };
  }
  const newMaxOutput = model.maxOutput;
  const calculatedContext = model.maxContext - model.maxOutput;
  const newMaxContext = Math.max(
    chatParameterOptions.context.min,
    calculatedContext,
  );

  return {
    selectedModel: model,
    maxOutput: newMaxOutput,
    maxContext: newMaxContext,
    reasoningEffort: "medium", // Reset effort on model change
  };
};

export interface ConfigSetterActions {
  setTemperature: (temp: number) => void;
  setMaxOutput: (output: number) => void;
  setMaxContext: (context: number) => void;
  setCompressionLevel: (level: CompressionLevel) => void;
  setRenderMode: (mode: RenderMode) => void;
  setSelectedModel: (model: Model | null) => void;
  setDefaultModel: (model: Model | null) => void;
  toggleTool: (tool: Tool) => void;
  toggleSingleTool: (tool: Tool) => void;
  setReasoningEffort: (effort: string) => void;
}

export const createConfigSetterActions: StateCreator<
  ChatStoreState,
  [],
  [],
  ConfigSetterActions
> = (set) => ({
  setTemperature: (temp) => set({ temperature: temp }),
  setMaxOutput: (output) => set({ maxOutput: output }),
  setMaxContext: (context) => set({ maxContext: context }),
  setCompressionLevel: (level) => set({ compressionLevel: level }),
  setRenderMode: (mode) => set({ renderMode: mode }),

  setSelectedModel: (model) =>
    set(() => ({
      ...handleModelChange(model),
      hasUserSelectedModel: true,
    })),

  setDefaultModel: (model) =>
    set(() => ({
      ...handleModelChange(model),
    })),

  toggleTool: (tool) =>
    set((state) => {
      const isSelected = state.selectedTools.some((t) => t.name === tool.name);
      if (isSelected) {
        return {
          selectedTools: state.selectedTools.filter(
            (t) => t.name !== tool.name,
          ),
        };
      } else {
        const maxTools = state.selectedModel?.max_tools ?? 0;
        if (state.selectedTools.length < maxTools) {
          return { selectedTools: [...state.selectedTools, tool] };
        }
        return {};
      }
    }),

  toggleSingleTool: (tool) =>
    set((state) => ({
      selectedTools: state.selectedTools.some((t) => t.name === tool.name)
        ? []
        : [tool],
    })),

  setReasoningEffort: (effort) => set({ reasoningEffort: effort }),
});
