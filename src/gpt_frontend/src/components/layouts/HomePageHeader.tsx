import React, { useContext } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Instrument_Sans } from "next/font/google";
import { SignIn, List, NotePencil } from "@phosphor-icons/react";

import { AuthStatus } from "@/store/authStore";
import { ModelDropdown } from "@/components/dropdowns/ModelDropdown";
import { OptionsDropdown } from "@/components/dropdowns/OptionsDropdown";
import { ChatTitleDropdown } from "@/components/dropdowns/ChatTitleDropdown";
import { AvatarDropdown } from "@/components/dropdowns/AvatarDropdown";
import { SidebarContext } from "@/components/sidebar";
import useMediaQuery from "@/hooks/useMediaQuery";
import { Message } from "@/types";
import { ChatId } from "@/types/brands";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: "400",
});

interface HomePageHeaderProps {
  authStatus: AuthStatus;
  handleLogin: () => void;
  handleLogout: () => void;
  handleCreateNewChat: () => void;
  handleRenameChat: (chatId: string, newTitle: string) => Promise<void>;
  handleDeleteChat: (chatId: string) => Promise<void>;
  archiveChatInStore: (chatId: string) => Promise<void>;
  unarchiveChatInStore: (chatId: string) => Promise<void>;
  currentChatId: ChatId | null;
  chatTitle: string;
  messagesForTitle: Message[];
  isChatArchived: boolean;
}

export const HomePageHeader: React.FC<HomePageHeaderProps> = ({
  authStatus,
  handleLogin,
  handleLogout,
  handleCreateNewChat,
  handleRenameChat,
  handleDeleteChat,
  archiveChatInStore,
  unarchiveChatInStore,
  currentChatId,
  chatTitle,
  messagesForTitle,
  isChatArchived,
}) => {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarContext);
  const isMediumOrLarger = useMediaQuery("(min-width: 768px)");

  const showHeader =
    authStatus === AuthStatus.REGISTERED ||
    authStatus === AuthStatus.UNAUTHENTICATED;

  if (!showHeader) {
    return null;
  }

  return (
    <motion.header
      className="sticky top-0 z-10 px-2 lg:px-2.5 py-2 md:py-3 my-0 mx-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: 0.1 }}
    >
      {authStatus === AuthStatus.REGISTERED ? (
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-1">
            {(!isSidebarOpen || !isMediumOrLarger) && (
              <>
                <button
                  onClick={toggleSidebar}
                  className="flex items-center focus:outline-hidden p-1.5 rounded-lg transition text-zinc-400 hover:text-zinc-200"
                  aria-label="Toggle Sidebar"
                >
                  <List weight="regular" size={20} />
                </button>
                {currentChatId !== null && (
                  <button
                    onClick={handleCreateNewChat}
                    className="flex items-center focus:outline-hidden p-1.5 rounded-lg transition text-zinc-400 hover:text-zinc-200"
                    aria-label="New Chat"
                  >
                    <NotePencil weight="regular" size={20} />
                  </button>
                )}
              </>
            )}
            <div className="flex items-center">
              <ModelDropdown />
            </div>
          </div>

          {messagesForTitle.length > 0 &&
            currentChatId !== null &&
            currentChatId !== "new" && (
              <ChatTitleDropdown
                messages={messagesForTitle}
                chatTitle={chatTitle}
                currentChatId={currentChatId}
                onRenameChat={handleRenameChat}
                onDeleteChat={handleDeleteChat}
                archived={isChatArchived}
                onArchiveChat={archiveChatInStore}
                onUnarchiveChat={unarchiveChatInStore}
              />
            )}

          <div className="flex items-center gap-1">
            <OptionsDropdown />
            <div className="hidden md:block">
              <AvatarDropdown handleLogout={handleLogout} />
            </div>
            {(currentChatId === null ||
              authStatus === AuthStatus.REGISTERED) && (
              <div className="block md:hidden">
                <AvatarDropdown handleLogout={handleLogout} />
              </div>
            )}
          </div>
        </div>
      ) : authStatus === AuthStatus.UNAUTHENTICATED ? (
        <div className="relative flex px-2 items-center justify-between">
          <div className="rounded-md font-instrument text-zinc-300 hover:text-zinc-100 duration-100">
            <a
              href="#"
              rel="noopener noreferrer"
              className={clsx(
                instrument.className,
                "flex text-base items-center cursor-pointer",
              )}
            >
              <span>GPT Protocol</span>
            </a>
          </div>
          <button
            onClick={handleLogin}
            aria-label="Sign In with Internet Identity"
            className={clsx(
              instrument.className,
              "hidden sm:flex text-base items-center cursor-pointer gap-2 group hover:text-zinc-100 duration-100 rounded-xl py-1 px-2.5 text-zinc-300",
            )}
          >
            Sign In with Internet Identity
            <SignIn
              weight="bold"
              size={16}
              className="fill-zinc-300 duration-100 group-hover:fill-zinc-100"
            />
          </button>
          <button
            onClick={handleLogin}
            aria-label="Sign In with Internet Identity"
            className={clsx(
              instrument.className,
              "flex sm:hidden text-base items-center cursor-pointer gap-2 group hover:text-zinc-100 duration-100 rounded-xl py-1 px-2.5 text-zinc-300",
            )}
          >
            Sign In
            <SignIn
              weight="bold"
              size={16}
              className="fill-zinc-300 duration-100 group-hover:fill-zinc-100"
            />
          </button>
        </div>
      ) : null}
    </motion.header>
  );
};

HomePageHeader.displayName = "HomePageHeader";
