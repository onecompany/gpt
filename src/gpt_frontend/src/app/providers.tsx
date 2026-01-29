import React, { useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  AgentError,
  CertifiedRejectErrorCode,
  ErrorKindEnum,
} from "@icp-sdk/core/agent";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useModelsStore } from "@/store/modelsStore";
import { useEmbeddingStore } from "@/store/embeddingStore";
import { FullScreenSpinner, FullScreenError } from "@/components/status";
import { VaultGate } from "@/components/auth";
import { useFileStore } from "@/store/fileStore";
import { useGovernanceStore } from "@/store/governanceStore";
import { ChatId } from "@/types/brands";

const NODE_POLLING_INTERVAL = 15000;

const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();

  const hasInitiatedSecondaryFetch = useRef(false);

  const {
    authStatus,
    initAuth,
    setupError,
    setupErrorTitle,
    isFatalError,
    retryUserSetup,
    userCanisterId,
    resolveUserSession,
    handleInvalidDelegationError,
    logout,
  } = useAuthStore();

  const {
    fetchChats,
    fetchMessages,
    hasMessagesLoaded,
    currentChatId,
    hasFetchedChats,
    fetchAndReconcileNodes,
    reconciledActiveNodes,
    queuedToolCalls,
    processQueuedToolCalls,
    fetchMyNodesAuth,
    fetchAllActiveNodesAuth,
    isInitialAnimationComplete,
  } = useChatStore();
  const fetchModels = useModelsStore((state) => state.fetchModels);
  const fetchUserUsage = useAuthStore((state) => state.fetchUserUsage);
  const initEmbeddingWorker = useEmbeddingStore((state) => state.initWorker);
  const {
    hydrationStatus,
    buildGlobalSearchIndex,
    fetchFolderContents,
    isIndexStale,
    indexingStatus,
  } = useFileStore();
  const models = useModelsStore((state) => state.models);
  const updateNodeCounts = useModelsStore((state) => state.updateNodeCounts);
  const { fetchInitialData: fetchGovernanceData } = useGovernanceStore();

  const memoizedHandleInvalidDelegationError = useCallback(
    () => handleInvalidDelegationError(),
    [handleInvalidDelegationError],
  );

  useEffect(() => {
    if (authStatus !== AuthStatus.REGISTERED) {
      hasInitiatedSecondaryFetch.current = false;
    }
  }, [authStatus]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (authStatus === AuthStatus.REGISTERED) {
      fetchModels();
    }
  }, [fetchModels, authStatus]);

  useEffect(() => {
    if (authStatus === AuthStatus.PENDING_SETUP) {
      void resolveUserSession();
    }
  }, [authStatus, resolveUserSession]);

  useEffect(() => {
    if (authStatus === AuthStatus.REGISTERED && userCanisterId) {
      const fetchCriticalData = async () => {
        try {
          await fetchChats();
        } catch (error: unknown) {
          console.error(
            "[Providers] Error fetching critical data (chats):",
            error,
          );
          if (
            error instanceof AgentError &&
            error.cause?.code instanceof CertifiedRejectErrorCode &&
            error.cause?.kind === ErrorKindEnum.Trust
          ) {
            memoizedHandleInvalidDelegationError();
          } else if (
            error instanceof Error &&
            (error.message?.includes("Invalid delegation") ||
              error.message?.includes("Invalid signature"))
          ) {
            memoizedHandleInvalidDelegationError();
          }
        }
      };
      void fetchCriticalData();
    }
  }, [
    authStatus,
    userCanisterId,
    fetchChats,
    memoizedHandleInvalidDelegationError,
  ]);

  useEffect(() => {
    const isHomePage = pathname === "/";
    const shouldWaitForAnimation = isHomePage;

    if (
      authStatus === AuthStatus.REGISTERED &&
      userCanisterId &&
      hasFetchedChats &&
      (!shouldWaitForAnimation || isInitialAnimationComplete) &&
      !hasInitiatedSecondaryFetch.current
    ) {
      hasInitiatedSecondaryFetch.current = true;
      initEmbeddingWorker();

      const fetchSecondaryData = async () => {
        try {
          await Promise.all([
            fetchAndReconcileNodes(),
            fetchUserUsage(),
            fetchFolderContents(null),
            fetchMyNodesAuth(),
            fetchAllActiveNodesAuth(),
            fetchGovernanceData(),
          ]);
        } catch (error: unknown) {
          console.error("[Providers] Error fetching secondary data:", error);
          if (
            error instanceof AgentError &&
            error.cause?.code instanceof CertifiedRejectErrorCode &&
            error.cause?.kind === ErrorKindEnum.Trust
          ) {
            memoizedHandleInvalidDelegationError();
          } else if (
            error instanceof Error &&
            (error.message?.includes("Invalid delegation") ||
              error.message?.includes("Invalid signature"))
          ) {
            memoizedHandleInvalidDelegationError();
          }
        }
      };
      void fetchSecondaryData();
    }
  }, [
    authStatus,
    userCanisterId,
    hasFetchedChats,
    isInitialAnimationComplete,
    pathname,
    fetchAndReconcileNodes,
    fetchUserUsage,
    initEmbeddingWorker,
    memoizedHandleInvalidDelegationError,
    fetchFolderContents,
    fetchMyNodesAuth,
    fetchAllActiveNodesAuth,
    fetchGovernanceData,
  ]);

  useEffect(() => {
    if (
      hasFetchedChats &&
      currentChatId &&
      !hasMessagesLoaded(currentChatId as ChatId)
    ) {
      void fetchMessages(currentChatId as ChatId);
    }
  }, [hasFetchedChats, currentChatId, fetchMessages, hasMessagesLoaded]);

  useEffect(() => {
    if (hydrationStatus === "hydrated") {
      setTimeout(() => buildGlobalSearchIndex(), 0);
    }
  }, [hydrationStatus, buildGlobalSearchIndex]);

  useEffect(() => {
    if (isIndexStale && hydrationStatus === "hydrated") {
      buildGlobalSearchIndex();
    }
  }, [isIndexStale, hydrationStatus, buildGlobalSearchIndex]);

  useEffect(() => {
    if (queuedToolCalls.length > 0) {
      processQueuedToolCalls();
    }
  }, [indexingStatus, queuedToolCalls, processQueuedToolCalls]);

  useEffect(() => {
    if (models.length === 0 || !reconciledActiveNodes) return;
    const nodeCountPerModel = models.reduce(
      (acc, model) => {
        acc[model.modelId] = 0;
        return acc;
      },
      {} as { [modelId: string]: number },
    );

    for (const node of reconciledActiveNodes) {
      if (node.modelId in nodeCountPerModel) {
        nodeCountPerModel[node.modelId]++;
      }
    }
    updateNodeCounts(nodeCountPerModel);
  }, [models, reconciledActiveNodes, updateNodeCounts]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const startPolling = () => {
      void fetchAndReconcileNodes();
      if (useAuthStore.getState().authStatus === AuthStatus.REGISTERED) {
        void fetchMyNodesAuth(true);
      }
      intervalId = setInterval(() => {
        void fetchAndReconcileNodes();
        if (useAuthStore.getState().authStatus === AuthStatus.REGISTERED) {
          void fetchMyNodesAuth(true);
        }
      }, NODE_POLLING_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else if (authStatus === AuthStatus.REGISTERED) {
        startPolling();
      }
    };

    if (authStatus === AuthStatus.REGISTERED) {
      startPolling();
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authStatus, fetchAndReconcileNodes, fetchMyNodesAuth]);

  if (authStatus === AuthStatus.INITIALIZING) {
    return <FullScreenSpinner message="Initializing..." />;
  }
  if (authStatus === AuthStatus.AUTHENTICATING_II) {
    return (
      <FullScreenSpinner message="Authenticating with Internet Identity..." />
    );
  }
  if (authStatus === AuthStatus.PENDING_SETUP) {
    return (
      <FullScreenSpinner message={setupError || "Setting up your account..."} />
    );
  }
  if (authStatus === AuthStatus.SETUP_ERROR) {
    return (
      <FullScreenError
        message={setupError || "An unknown setup error occurred."}
        title={setupErrorTitle}
        isFatal={isFatalError}
        onRetry={retryUserSetup}
        onLogout={logout}
      />
    );
  }

  if (authStatus === AuthStatus.SETUP_VAULT) {
    return <VaultGate mode="setup" />;
  }
  if (authStatus === AuthStatus.VAULT_LOCKED) {
    return <VaultGate mode="unlock" />;
  }

  if (authStatus === AuthStatus.REGISTERED && !hasFetchedChats) {
    return <FullScreenSpinner message="Loading workspace..." />;
  }

  return <>{children}</>;
};

export default Providers;
