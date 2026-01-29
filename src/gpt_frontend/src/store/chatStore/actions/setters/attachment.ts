import { StateCreator } from "zustand";
import { Attachment } from "../../../../types";
import { ChatStoreState } from "../../index";

export interface AttachmentSetterActions {
  addAttachments: (files: Omit<Attachment, "id">[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  scheduleAttachmentCleanup: (delay?: number) => void;
  cancelAttachmentCleanup: () => void;
}

export const createAttachmentSetterActions: StateCreator<
  ChatStoreState,
  [],
  [],
  AttachmentSetterActions
> = (set, get) => ({
  addAttachments: (filesToAdd) => {
    const { attachments: currentAttachments, selectedModel } = get();
    const imageLimit = selectedModel?.max_image_attachments ?? 0;
    let availableSlots =
      imageLimit - currentAttachments.filter((a) => a.type === "image").length;
    const newAttachments: Attachment[] = [];

    for (const file of filesToAdd) {
      if (file.type === "image" && availableSlots-- > 0) {
        newAttachments.push({
          ...file,
          id: `${file.name}-${file.file.lastModified}-${Math.random()}`,
        });
      }
    }
    if (newAttachments.length > 0)
      set((state) => ({
        attachments: [...state.attachments, ...newAttachments],
        isAttachmentsExiting: false,
      }));
  },
  removeAttachment: (id) =>
    set((state) => {
      const att = state.attachments.find((a) => a.id === id);
      if (att?.previewUrl)
        setTimeout(() => URL.revokeObjectURL(att.previewUrl!), 300);
      return { attachments: state.attachments.filter((a) => a.id !== id) };
    }),
  clearAttachments: () => {
    setTimeout(
      () =>
        get().attachments.forEach(
          (att) => att.previewUrl && URL.revokeObjectURL(att.previewUrl),
        ),
      300,
    );
    set({ attachments: [], isAttachmentsExiting: false });
  },
  scheduleAttachmentCleanup: (delay = 250) => {
    const state = get();
    if (state.attachmentCleanupTimer)
      clearTimeout(state.attachmentCleanupTimer);
    if (state.attachments.length === 0) return;
    set({ isAttachmentsExiting: true });
    const timer = window.setTimeout(() => {
      get().clearAttachments();
      set({ attachmentCleanupTimer: null });
    }, delay);
    set({ attachmentCleanupTimer: timer });
  },
  cancelAttachmentCleanup: () => {
    const timer = get().attachmentCleanupTimer;
    if (timer) {
      clearTimeout(timer);
      set({ attachmentCleanupTimer: null, isAttachmentsExiting: false });
    }
  },
});
