import { StateCreator } from "zustand";
import { ChatStoreState } from "../../index";
import { JobId } from "@/types/brands";

export interface OcrPromiseActions {
  addOcrPromise: (
    jobId: JobId,
    resolve: (value: string) => void,
    reject: (reason?: unknown) => void,
  ) => void;
  removeOcrPromise: (jobId: JobId) => void;
}

export const createOcrPromiseActions: StateCreator<
  ChatStoreState,
  [],
  [],
  OcrPromiseActions
> = (set) => ({
  addOcrPromise: (jobId, resolve, reject) => {
    set((state) => {
      const newPromises = new Map(state.ocrPromises);
      newPromises.set(jobId, { resolve, reject });
      return { ocrPromises: newPromises };
    });
  },
  removeOcrPromise: (jobId) => {
    set((state) => {
      const newPromises = new Map(state.ocrPromises);
      if (newPromises.has(jobId)) {
        newPromises.delete(jobId);
        return { ocrPromises: newPromises };
      }
      return {};
    });
  },
});
