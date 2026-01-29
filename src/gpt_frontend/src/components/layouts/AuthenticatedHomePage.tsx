import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";

import { useChatStore } from "@/store/chatStore";
import { useAuthStore } from "@/store/authStore";
import { HomePageHeader } from "./HomePageHeader";
import { NewChatPage, ChatPage } from "@/components/chat";
import { greetingMessages } from "@/constants/constants";

export const AuthenticatedHomePage: React.FC = () => {
  const router = useRouter();
  const {
    input,
    setInput,
    chatTitle,
    setChatTitle,
    sendMessage,
    currentChatId,
    isAITyping,
    isGenerating,
    archiveChat,
    unarchiveChat,
    chats,
    renameChat,
    deleteChat,
    createNewChat,
    messages,
    setInitialAnimationComplete,
  } = useChatStore();

  const { logout, login, authStatus } = useAuthStore();

  // Lazy initialization for random message to avoid useEffect setState
  const [randomMessage] = useState<string>(() => {
    return greetingMessages[
      Math.floor(Math.random() * greetingMessages.length)
    ];
  });

  // Effect to handle setting animation complete state for existing chats
  useEffect(() => {
    if (currentChatId !== null && currentChatId !== "new") {
      setInitialAnimationComplete(true);
    }
  }, [currentChatId, setInitialAnimationComplete]);

  const currentChatKey = currentChatId ?? "new";
  const currentIsAITyping = isAITyping[currentChatKey] || false;
  const currentIsGenerating = isGenerating[currentChatKey] || false;

  const messagesForTitle = useMemo(() => {
    const chatMessagesMap = messages[currentChatKey];
    if (chatMessagesMap instanceof Map) {
      return Array.from(chatMessagesMap.values()).sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return [];
  }, [messages, currentChatKey]);

  const theChat = useMemo(
    () =>
      currentChatId
        ? chats.find((chat) => chat.chatId === currentChatId)
        : null,
    [chats, currentChatId],
  );
  const isChatArchived = theChat?.archived ?? false;

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const handleLogin = useCallback(async () => {
    await login();
  }, [login]);

  const handleRenameChat = useCallback(
    async (chatId: string, newTitle: string) => {
      try {
        await renameChat(chatId, newTitle);
        setChatTitle(newTitle);
      } catch (error) {
        console.error("Error renaming:", error);
      }
    },
    [renameChat, setChatTitle],
  );

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      try {
        const sortedChats = [...chats]
          .filter((chat) => !chat.archived && !chat.temporary)
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );

        const currentIndex = sortedChats.findIndex((c) => c.chatId === chatId);
        let nextChatId: string | null = null;

        if (currentIndex !== -1 && sortedChats.length > 1) {
          if (currentIndex + 1 < sortedChats.length) {
            nextChatId = sortedChats[currentIndex + 1].chatId;
          } else if (currentIndex > 0) {
            nextChatId = sortedChats[currentIndex - 1].chatId;
          }
        }

        if (nextChatId) {
          router.push(`/?chat=${nextChatId}`);
        } else {
          await createNewChat();
          router.push("/");
        }

        await deleteChat(chatId);
      } catch (error) {
        console.error("Error deleting chat:", error);
      }
    },
    [chats, deleteChat, createNewChat, router],
  );

  const sendMessageAndUpdateUrl = useCallback(async () => {
    try {
      const newChatId = await sendMessage();
      if (newChatId && newChatId !== currentChatId) {
        router.replace(`/?chat=${newChatId}`);
      }
    } catch (error: unknown) {
      console.error("Failed to send message:", error);
      const msg =
        error instanceof Error
          ? error.message
          : "Unknown error occurred while sending message.";
      alert(msg);
    }
  }, [sendMessage, currentChatId, router]);

  const archiveChatInStore = useCallback(
    async (chatId: string) => {
      try {
        await archiveChat(chatId);
      } catch (error) {
        console.error("Error archiving:", error);
        alert("Failed to archive chat.");
      }
    },
    [archiveChat],
  );

  const unarchiveChatInStore = useCallback(
    async (chatId: string) => {
      try {
        await unarchiveChat(chatId);
      } catch (error) {
        console.error("Error unarchiving:", error);
        alert("Failed to unarchive chat.");
      }
    },
    [unarchiveChat],
  );

  const handleCreateNewChat = useCallback(async () => {
    await createNewChat();
    router.push("/");
  }, [createNewChat, router]);

  const renderMainContent = () => {
    if (currentChatId === null || currentChatId === "new") {
      return (
        <NewChatPage
          key="new-chat"
          randomMessage={randomMessage}
          input={input}
          setInput={setInput}
          sendMessageAndUpdateUrl={sendMessageAndUpdateUrl}
          currentIsGenerating={currentIsGenerating}
          currentIsAITyping={currentIsAITyping}
          onAnimationComplete={() => setInitialAnimationComplete(true)}
        />
      );
    }
    return (
      <ChatPage
        key={currentChatId}
        currentChatId={currentChatId}
        currentIsAITyping={currentIsAITyping}
        input={input}
        setInput={setInput}
        sendMessageAndUpdateUrl={sendMessageAndUpdateUrl}
      />
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-900 text-zinc-100">
      <HomePageHeader
        authStatus={authStatus}
        handleLogin={handleLogin}
        handleLogout={handleLogout}
        handleCreateNewChat={handleCreateNewChat}
        handleRenameChat={handleRenameChat}
        handleDeleteChat={handleDeleteChat}
        archiveChatInStore={archiveChatInStore}
        unarchiveChatInStore={unarchiveChatInStore}
        currentChatId={currentChatId}
        chatTitle={chatTitle}
        messagesForTitle={messagesForTitle}
        isChatArchived={isChatArchived}
      />

      <main className="relative z-0 flex flex-1 min-h-0 flex-col overflow-hidden bg-zinc-900">
        <AnimatePresence mode="wait">{renderMainContent()}</AnimatePresence>
      </main>
    </div>
  );
};

AuthenticatedHomePage.displayName = "AuthenticatedHomePage";
