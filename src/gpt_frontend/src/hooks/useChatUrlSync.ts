import { useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { ChatId } from "@/types/brands";

export function useChatUrlSync() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatIdFromUrl = searchParams.get("chat");

  const authStatus = useAuthStore((state) => state.authStatus);
  const { currentChatId, setCurrentChatId, hasFetchedChats } = useChatStore();

  useEffect(() => {
    if (
      pathname !== "/" ||
      authStatus !== AuthStatus.REGISTERED ||
      !hasFetchedChats
    ) {
      return;
    }

    const logPrefix = `[ChatUrlSync]`;

    const handleUrlChatId = async () => {
      const { chats, activeChatJobs } = useChatStore.getState();

      if (chatIdFromUrl) {
        if (chatIdFromUrl === currentChatId) {
          return;
        }

        const chatExists = chats.some((chat) => chat.chatId === chatIdFromUrl);

        if (chatExists) {
          console.log(
            `${logPrefix} URL contains chat ID ${chatIdFromUrl}. Setting it as current chat.`,
          );
          setCurrentChatId(chatIdFromUrl as ChatId);
        } else {
          console.warn(
            `${logPrefix} Chat ID "${chatIdFromUrl}" from URL not found in store. Redirecting to home.`,
          );
          router.replace("/");
        }
      } else {
        if (currentChatId !== null) {
          const isActive = !!activeChatJobs[currentChatId];
          if (isActive) {
            console.log(
              `${logPrefix} Chat ID ${currentChatId} has active job. Ignoring empty URL to prevent race condition.`,
            );
            return;
          }

          console.log(
            `${logPrefix} No chat ID in URL. Clearing current chat in store.`,
          );
          setCurrentChatId(null);
        }
      }
    };

    void handleUrlChatId();
  }, [
    pathname,
    authStatus,
    hasFetchedChats,
    chatIdFromUrl,
    currentChatId,
    setCurrentChatId,
    router,
  ]);
}
