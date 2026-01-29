"use client";

import React, { Suspense, useEffect } from "react";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { useModelsStore } from "@/store/modelsStore";
import { useChatStore } from "@/store/chatStore";

import { UnauthenticatedPage } from "@/components/auth";
import { AuthenticatedHomePage } from "@/components/layouts";

const CenteredSpinner: React.FC = () => (
  <div className="flex grow items-center justify-center h-full mb-16">
    <CircleNotchIcon size={24} className="text-zinc-400 animate-spin" />
  </div>
);

export default function HomeClient() {
  const { authStatus, login } = useAuthStore();
  const { models } = useModelsStore();
  const { selectedModel, hasUserSelectedModel, setDefaultModel } =
    useChatStore();

  useEffect(() => {
    if (authStatus !== AuthStatus.REGISTERED) return;

    if (!selectedModel && !hasUserSelectedModel && models.length > 0) {
      const candidates = models.filter(
        (m) =>
          m.nodeCount > 0 && m.max_image_attachments >= 1 && m.max_tools >= 1,
      );

      if (candidates.length > 0) {
        candidates.sort(
          (a, b) =>
            a.inputTokenPrice +
            a.outputTokenPrice -
            (b.inputTokenPrice + b.outputTokenPrice),
        );
        setDefaultModel(candidates[0]);
      } else {
        const compatible = models.filter((m) => m.nodeCount > 0);
        if (compatible.length > 0) {
          setDefaultModel(compatible[0]);
        }
      }
    }
  }, [
    models,
    selectedModel,
    hasUserSelectedModel,
    setDefaultModel,
    authStatus,
  ]);

  const handleLogin = async () => {
    await login();
  };

  const renderPageContent = () => {
    switch (authStatus) {
      case AuthStatus.UNAUTHENTICATED:
      case AuthStatus.SETUP_ERROR:
        return (
          <UnauthenticatedPage
            handleLogin={handleLogin}
            authStatus={authStatus}
          />
        );
      case AuthStatus.REGISTERED:
        return <AuthenticatedHomePage />;
      default:
        return <CenteredSpinner />;
    }
  };

  return (
    <Suspense fallback={<CenteredSpinner />}>{renderPageContent()}</Suspense>
  );
}
