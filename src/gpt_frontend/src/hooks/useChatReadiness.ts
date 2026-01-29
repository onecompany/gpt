import { useAuthStore, AuthStatus } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useModelsStore } from "@/store/modelsStore";
import { ChatId } from "@/types/brands";

export type ReadinessReason =
  | "ok"
  | "initializing"
  | "not_registered"
  | "no_model_selected"
  | "model_offline"
  | "generating";

export interface ReadinessStatus {
  isReady: boolean;
  reason: ReadinessReason;
  message: string;
}

/**
 * Aggregates store states to determine if a message can be sent.
 * @param chatId - Optional. If provided, checks specific chat state. If null, assumes "New Chat" context.
 */
export function useChatReadiness(
  chatId: ChatId | string | null,
): ReadinessStatus {
  const authStatus = useAuthStore((state) => state.authStatus);
  const selectedModel = useChatStore((state) => state.selectedModel);
  // ChatId key for isGenerating can be "new" or a valid ChatId string
  const chatKey = chatId ?? "new";
  const isGenerating = useChatStore(
    (state) => state.isGenerating[chatKey] || false,
  );

  const models = useModelsStore((state) => state.models);

  if (authStatus === AuthStatus.INITIALIZING) {
    return {
      isReady: false,
      reason: "initializing",
      message: "System initializing...",
    };
  }

  if (authStatus !== AuthStatus.REGISTERED) {
    return {
      isReady: false,
      reason: "not_registered",
      message: "You must be registered to send messages.",
    };
  }

  if (isGenerating) {
    return {
      isReady: false,
      reason: "generating",
      message: "Please wait for the current response to finish.",
    };
  }

  if (!selectedModel) {
    return {
      isReady: false,
      reason: "no_model_selected",
      message: "Please select an AI model to start chatting.",
    };
  }

  const liveModel = models.find((m) => m.modelId === selectedModel.modelId);
  const activeNodeCount = liveModel ? liveModel.nodeCount : 0;

  if (activeNodeCount === 0) {
    return {
      isReady: false,
      reason: "model_offline",
      message: `No active nodes available for ${selectedModel.name}. Please select a different model.`,
    };
  }

  return {
    isReady: true,
    reason: "ok",
    message: "Ready to send",
  };
}
