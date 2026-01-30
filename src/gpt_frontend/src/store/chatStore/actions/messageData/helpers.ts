import { Message, Job } from "@/types";
import { MessageId } from "@/types/brands";

export class ChatNotFoundError extends Error {
  constructor(message?: string) {
    super(message || "Chat not found");
    this.name = "ChatNotFoundError";
  }
}

export const mergeFetchedWithLocalMap = (
  fetchedMessages: Message[],
  localMap: Map<MessageId, Message> | undefined,
): Map<MessageId, Message> => {
  const mergedMap = new Map<MessageId, Message>();
  const currentLocalMessages = localMap || new Map<MessageId, Message>();

  // Use String IDs for Map keys
  fetchedMessages.forEach((fMsg) =>
    mergedMap.set((fMsg.backendId ?? fMsg.id) as MessageId, fMsg),
  );

  currentLocalMessages.forEach((lMsg, lMsgId) => {
    const fetchedVersion = mergedMap.get(lMsgId);

    if (fetchedVersion) {
      // Prioritize local text for streaming content if message is not complete
      // Preserve local content when:
      // 1. Local has content AND fetched doesn't, OR
      // 2. Local is complete (stream finished) AND has content but fetched doesn't
      // This handles the race condition where fetchMessages runs before complete_job updates canister
      const finalContent =
        lMsg.content && (!fetchedVersion.content || (lMsg.isComplete && !fetchedVersion.isComplete))
          ? lMsg.content
          : fetchedVersion.content || lMsg.content;

      const finalErrorStatus = lMsg.errorStatus ?? fetchedVersion.errorStatus;

      // Preserve usage from local if present (stream provides usage with final message)
      // Canister may not have usage yet if complete_job hasn't finished
      const finalUsage = lMsg.usage ?? fetchedVersion.usage;

      // Preserve modelId from local if present (stream may have it before canister)
      const finalModelId = lMsg.modelId || fetchedVersion.modelId;

      const mergedMessage: Message = {
        ...fetchedVersion,
        ...lMsg,
        ...fetchedVersion, // Re-apply fetched props to ensure source of truth for IDs
        content: finalContent,
        errorStatus: finalErrorStatus,
        usage: finalUsage,
        modelId: finalModelId,
        // Preserve local isComplete if set (stream finished before canister updated)
        isComplete: fetchedVersion.isComplete || lMsg.isComplete || !!finalErrorStatus,
      };

      mergedMap.set(lMsgId, mergedMessage);
    } else {
      // Only keep local messages if they are not stale or were optimistic updates
      // Here we assume local-only messages are valid optimistic updates
      mergedMap.set(lMsgId, lMsg);
    }
  });

  return mergedMap;
};

export const mergeJobDetailsIntoMap = (
  messageMap: Map<MessageId, Message>,
  jobs: Job[],
): Map<MessageId, Message> => {
  const updatedMap = new Map(messageMap);

  updatedMap.forEach((msg, msgId) => {
    if (msg.role === "assistant") {
      const relatedJob = jobs.find(
        (job) =>
          job.placeholder_message_id === (msg.backendId ?? msg.id) ||
          job.job_id === msg.jobId,
      );

      if (relatedJob) {
        // Handle backend generation status variant (opaque object)
        const status = relatedJob.generation_status as Record<string, unknown>;
        const isJobComplete =
          status && typeof status === "object" && "Completed" in status;
        const isJobFailed =
          status && typeof status === "object" && "Failed" in status;

        let inferredErrorStatus = msg.errorStatus;
        if (isJobFailed && !msg.errorStatus) {
          inferredErrorStatus = {
            type: "Unknown",
            message: "Generation failed as per job status.",
          };
        }

        updatedMap.set(msgId, {
          ...msg,
          modelId: msg.modelId || relatedJob.model_id,
          jobId: msg.jobId || relatedJob.job_id,
          isComplete:
            msg.isComplete ||
            isJobComplete ||
            isJobFailed ||
            !!inferredErrorStatus,
          errorStatus: inferredErrorStatus,
          tool_calls: msg.tool_calls,
          tool_results: msg.tool_results,
          tool_call_id: msg.tool_call_id,
          requires_client_action: msg.requires_client_action,
        });
      }
    }
  });
  return updatedMap;
};
