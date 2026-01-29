import type { ImageAttachment as BackendImageAttachment } from "@candid/gpt_user";
import type { Attachment } from "../../../../types";

export const transformAttachmentsForBackend = async (
  attachments: Omit<Attachment, "id">[],
): Promise<BackendImageAttachment[]> => {
  if (!attachments || attachments.length === 0) return [];
  return await Promise.all(
    attachments
      .filter((att) => att.type === "image")
      .map(async (att) => ({
        mime_type: att.file.type,
        data: new Uint8Array(await att.file.arrayBuffer()),
      })),
  );
};
