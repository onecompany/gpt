import type { ChatStoreState } from "../../index";
import type { Message } from "../../../../types";
import { ChatId, JobId, MessageId } from "@/types/brands";

export const findTargetMessageDetails = (
  get: () => ChatStoreState,
  chatId: ChatId,
  jobId: JobId,
): {
  targetId: MessageId | null;
  message: Message | undefined;
} => {
  const messagesMap = get().messages[chatId];
  if (messagesMap instanceof Map) {
    for (const [id, msg] of messagesMap.entries()) {
      if (
        msg.role === "assistant" &&
        msg.jobId === jobId &&
        !msg.isComplete &&
        !msg.errorStatus
      ) {
        return { targetId: (msg.backendId ?? id) as MessageId, message: msg };
      }
    }
    for (const [id, msg] of messagesMap.entries()) {
      if (msg.role === "assistant" && msg.jobId === jobId) {
        return { targetId: (msg.backendId ?? id) as MessageId, message: msg };
      }
    }
  }
  return { targetId: null, message: undefined };
};
