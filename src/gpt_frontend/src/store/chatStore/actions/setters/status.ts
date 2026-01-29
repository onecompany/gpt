import { StateCreator } from "zustand";
import { ChatStoreState } from "../../index";
import { ChatId, JobId } from "@/types/brands";

export interface StatusSetterActions {
  setIsGenerating: (chatId: string, isGenerating: boolean) => void;
  setIsWaiting: (chatId: string, isWaiting: boolean) => void;
  setIsAITyping: (chatId: string, isAITyping: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setActiveChatJob: (
    chatId: ChatId,
    jobId: JobId,
    erroredViaStream?: boolean,
  ) => void;
  clearActiveChatJob: (chatId: ChatId) => void;
}

export const createStatusSetterActions: StateCreator<
  ChatStoreState,
  [],
  [],
  StatusSetterActions
> = (set) => ({
  // These keys can be "new" or a ChatId string
  setIsGenerating: (chatId, isGenerating) =>
    set((state) => ({
      isGenerating: { ...state.isGenerating, [chatId]: isGenerating },
    })),
  setIsWaiting: (chatId, isWaiting) =>
    set((state) => ({
      isWaiting: { ...state.isWaiting, [chatId]: isWaiting },
    })),
  setIsAITyping: (chatId, isAITyping) =>
    set((state) => ({
      isAITyping: { ...state.isAITyping, [chatId]: isAITyping },
    })),
  setIsLoading: (isLoading) => set({ isLoading }),

  setActiveChatJob: (chatId, jobId, erroredViaStream = false) =>
    set((state) => ({
      activeChatJobs: {
        ...state.activeChatJobs,
        [chatId]: { jobId, erroredViaStream },
      },
      isGenerating: { ...state.isGenerating, [chatId]: !erroredViaStream },
      isAITyping: { ...state.isAITyping, [chatId]: !erroredViaStream },
      isWaiting: { ...state.isWaiting, [chatId]: !erroredViaStream },
    })),

  clearActiveChatJob: (chatId) =>
    set((state) => {
      const newActiveChatJobs = { ...state.activeChatJobs };
      delete newActiveChatJobs[chatId];
      return {
        activeChatJobs: newActiveChatJobs,
        isGenerating: { ...state.isGenerating, [chatId]: false },
        isAITyping: { ...state.isAITyping, [chatId]: false },
        isWaiting: { ...state.isWaiting, [chatId]: false },
      };
    }),
});
