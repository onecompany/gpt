import { useEffect, useRef } from "react";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { useChatStore, ActiveJobInfo } from "@/store/chatStore";

const RECONNECTION_COOLDOWN = 10000;

export function useWebSocketReconnection() {
  const authStatus = useAuthStore((state) => state.authStatus);
  const userCanisterId = useAuthStore((state) => state.userCanisterId);

  const {
    currentChatId,
    hasFetchedChats,
    activeChatJobs,
    webSockets,
    reconnectToActiveJob,
    messages,
  } = useChatStore();

  const reconnectionAttemptRef = useRef<Map<string, number>>(new Map());
  const lastProcessedActiveJobRef = useRef<ActiveJobInfo | null>(null);

  useEffect(() => {
    reconnectionAttemptRef.current.clear();
    lastProcessedActiveJobRef.current = null;
  }, [currentChatId]);

  useEffect(() => {
    if (
      authStatus !== AuthStatus.REGISTERED ||
      !userCanisterId ||
      !currentChatId ||
      !hasFetchedChats
    ) {
      return;
    }

    const activeJobInfoForCurrentChat = activeChatJobs[currentChatId];

    if (
      activeJobInfoForCurrentChat?.jobId ===
        lastProcessedActiveJobRef.current?.jobId &&
      activeJobInfoForCurrentChat?.erroredViaStream ===
        lastProcessedActiveJobRef.current?.erroredViaStream
    ) {
      return;
    }
    lastProcessedActiveJobRef.current = activeJobInfoForCurrentChat
      ? { ...activeJobInfoForCurrentChat }
      : null;

    if (
      activeJobInfoForCurrentChat &&
      !activeJobInfoForCurrentChat.erroredViaStream
    ) {
      // Logic Check: If the message in store already has an errorStatus or content, we should NOT reconnect
      // This prevents loops where the stream errored, closed, but activeChatJobs wasn't fully cleared yet
      // or we are in a race between error handling and this effect.
      // Also prevents reconnection to already-completed jobs that have streamed content.
      const msgs = messages[currentChatId];
      if (msgs instanceof Map) {
        for (const msg of msgs.values()) {
          if (msg.jobId === activeJobInfoForCurrentChat.jobId) {
            if (msg.errorStatus) {
              console.log(
                "[WS Reconnect]: Skipping reconnect for job",
                activeJobInfoForCurrentChat.jobId,
                "because message already has error status.",
              );
              return;
            }
            // Skip reconnection if message already has content (stream likely completed)
            if (msg.content && msg.content.trim().length > 0) {
              console.log(
                "[WS Reconnect]: Skipping reconnect for job",
                activeJobInfoForCurrentChat.jobId,
                "because message already has content.",
              );
              return;
            }
          }
        }
      }

      const jobId = activeJobInfoForCurrentChat.jobId;
      const streamKey = `${currentChatId}:${jobId}`;
      const attemptTimestamp = reconnectionAttemptRef.current.get(streamKey);
      const now = Date.now();

      if (attemptTimestamp && now - attemptTimestamp < RECONNECTION_COOLDOWN) {
        return;
      }

      if (
        webSockets[jobId] &&
        webSockets[jobId].readyState === WebSocket.OPEN
      ) {
        return;
      }

      reconnectionAttemptRef.current.set(streamKey, now);

      console.log(
        "[WS Reconnect]: Attempting to reconnect to active job",
        jobId,
        "for chat",
        currentChatId,
      );
      reconnectToActiveJob(currentChatId, jobId).catch((err) => {
        console.error(
          "[WS Reconnect]: Error during reconnection for job",
          jobId,
          "in chat",
          currentChatId,
          ":",
          err,
        );
      });
    }
  }, [
    authStatus,
    userCanisterId,
    currentChatId,
    hasFetchedChats,
    activeChatJobs,
    webSockets,
    reconnectToActiveJob,
    messages,
  ]);
}
