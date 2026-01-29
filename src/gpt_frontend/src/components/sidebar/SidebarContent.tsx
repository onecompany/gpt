import React, {
  useState,
  useCallback,
  useContext,
  useMemo,
  createContext,
} from "react";
import {
  CaretDown,
  CaretUp,
  GithubLogo,
  HardDrive,
  MagnifyingGlass,
  NotePencil,
  Wallet,
  X,
  XLogo,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { MenuButton } from "./MenuButton";
import { AssistantButton } from "./AssistantButton";
import { CategoriesDropdown } from "@/components/dropdowns/CategoriesDropdown";
import { useRouter, usePathname } from "next/navigation";
import { useChatStore } from "@/store/chatStore/index";
import { Chat } from "@/types";
import {
  assistantButtons,
  categories,
  menuButtons,
} from "@/constants/constants";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useAuthStore } from "@/store/authStore";
import { SidebarChatItem } from "./SidebarChatItem";

export const SidebarContext = createContext({
  isSidebarOpen: false,
  toggleSidebar: () => {},
});

function getTimeGroup(chat: Chat): string {
  const updatedAt = new Date(chat.updatedAt).getTime();
  const now = Date.now();
  const diffMs = now - updatedAt;
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  if (diffHours < 1) {
    return "Last hour";
  } else if (diffDays < 1) {
    return "Today";
  } else if (diffDays < 2) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return "This week";
  } else {
    return "Older";
  }
}

function groupChatsByTime(chats: Chat[]): Record<string, Chat[]> {
  return chats.reduce(
    (acc, chat) => {
      const label = getTimeGroup(chat);
      if (!acc[label]) {
        acc[label] = [];
      }
      acc[label].push(chat);
      return acc;
    },
    {} as Record<string, Chat[]>,
  );
}

export const SidebarContent: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [showAllAssistants, setShowAllAssistants] = useState(false);
  const isMediumOrLarger = useMediaQuery("(min-width: 768px)");

  const displayedAssistantButtons = showAllAssistants
    ? assistantButtons
    : assistantButtons.slice(0, 3);

  const [selectedCategory, setSelectedCategory] = useState(categories[0]);

  const { chats, currentChatId, createNewChat, hasFetchedChats } =
    useChatStore();

  const { toggleSidebar } = useContext(SidebarContext);

  const handleCreateNewChat = useCallback(async () => {
    await createNewChat();
    router.push("/");
    if (!isMediumOrLarger) toggleSidebar();
  }, [createNewChat, router, isMediumOrLarger, toggleSidebar]);

  const handleChatClick = useCallback(
    (chatId: string, e: React.MouseEvent) => {
      e.preventDefault();
      if (!chatId) {
        console.error("Invalid chat ID");
        return;
      }
      if (chatId !== currentChatId) {
        router.push(`/?chat=${chatId}`);
      }
      if (!isMediumOrLarger) toggleSidebar();
    },
    [currentChatId, router, isMediumOrLarger, toggleSidebar],
  );

  const handleAssistantClick = useCallback(
    (label: string) => {
      console.log(`[Sidebar] Assistant clicked: ${label}`);
      // Future logic: switch persona/model/prompt
      if (!isMediumOrLarger) toggleSidebar();
    },
    [isMediumOrLarger, toggleSidebar],
  );

  const userStorageUsage = useAuthStore((state) => state.userStorageUsage);
  const userStorageLimit = useAuthStore((state) => state.userStorageLimit);
  const usagePct = (userStorageUsage / userStorageLimit) * 100;

  const sortedChats = useMemo(() => {
    return [...chats].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [chats]);

  const filteredChats = useMemo(() => {
    if (selectedCategory.value === "recent") {
      return sortedChats.filter((chat) => !chat.archived && !chat.temporary);
    } else if (selectedCategory.value === "archived") {
      return sortedChats.filter((chat) => chat.archived);
    } else if (selectedCategory.value === "temporary") {
      return sortedChats.filter((chat) => chat.temporary && !chat.archived);
    }
    return sortedChats;
  }, [sortedChats, selectedCategory]);

  const groupedChats: Record<string, Chat[]> = useMemo(() => {
    if (hasFetchedChats && filteredChats.length > 0) {
      return groupChatsByTime(filteredChats);
    }
    return {};
  }, [filteredChats, hasFetchedChats]);

  return (
    <nav className="h-full min-h-0 overflow-hidden bg-black flex w-full flex-col">
      <div className="shrink-0 flex flex-col pl-3 pr-2.5 pb-1 pt-2.5">
        <div className="flex items-center justify-between pl-1.75 py-2 pr-1.5">
          <button
            onClick={handleCreateNewChat}
            type="button"
            className={clsx(
              "flex text-sm items-center space-x-3 hover:text-zinc-50 text-zinc-400 cursor-pointer group",
            )}
          >
            <NotePencil weight="regular" size={20} />
            <span>New chat</span>
          </button>

          <div className="flex items-center">
            <button
              className="flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 focus:outline-hidden cursor-pointer"
              onClick={toggleSidebar}
              aria-label={isMediumOrLarger ? "Toggle Sidebar" : "Close Sidebar"}
            >
              <X size={19} weight="regular" />
            </button>
          </div>
        </div>

        <div className="mt-0.5 flex flex-col gap-0.5">
          {menuButtons.map((button) => (
            <MenuButton
              key={button.label}
              href={button.href}
              icon={button.icon}
              label={button.label}
              isActive={pathname === button.href}
              onClick={() => {
                if (!isMediumOrLarger) {
                  toggleSidebar();
                }
              }}
            />
          ))}

          <AnimatePresence initial={false}>
            {displayedAssistantButtons.map((button) => (
              <AssistantButton
                key={button.label}
                icon={button.icon}
                label={button.label}
                onClick={() => handleAssistantClick(button.label)}
              />
            ))}
          </AnimatePresence>

          {assistantButtons.length > 3 && (
            <button
              onClick={() => setShowAllAssistants(!showAllAssistants)}
              className={clsx(
                "flex text-sm rounded-lg px-1.75 pt-1.5 pb-1.5",
                "items-center space-x-1.5 group",
                "hover:text-zinc-300 text-zinc-400 cursor-pointer",
              )}
            >
              {showAllAssistants ? (
                <CaretUp
                  weight="bold"
                  size={16}
                  className="group-hover:fill-zinc-200 fill-zinc-400"
                />
              ) : (
                <CaretDown
                  weight="bold"
                  size={16}
                  className="group-hover:fill-zinc-200 fill-zinc-400"
                />
              )}
              <span>{showAllAssistants ? "Show less" : "Show more"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="relative mb-1.5 mt-1 ml-5 mr-4 flex items-center justify-between gap-2">
          <CategoriesDropdown
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            categories={categories}
          />
          <div className="flex items-center gap-2">
            <button className="flex items-center rounded-full text-sm font-normal text-zinc-400 focus:outline-hidden cursor-pointer">
              <MagnifyingGlass
                size={16}
                weight="bold"
                className="hover:text-zinc-100"
              />
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 gap-0.5 overflow-y-auto overflow-x-hidden pl-3 pr-2.5">
          {!hasFetchedChats ? (
            <div className="text-zinc-400 text-xs px-2 mt-2 mb-1.5">
              Loading...
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-zinc-400 text-xs px-2 mt-2 mb-1.5">
              No chats in this category.
            </div>
          ) : (
            Object.entries(groupedChats).map(([label, group]) => (
              <React.Fragment key={label}>
                <span className="text-zinc-400 text-xs px-2 mt-2 mb-1.5">
                  {label}
                </span>
                {group.map((convo) => (
                  <SidebarChatItem
                    key={convo.chatId}
                    href={`/?chat=${convo.chatId}`}
                    className={clsx("group relative")}
                    current={currentChatId === convo.chatId}
                    onClick={(e: React.MouseEvent) =>
                      handleChatClick(convo.chatId, e)
                    }
                  >
                    <div className="relative w-full transform truncate">
                      <span className="text-zinc-100 block truncate text-clip text-sm">
                        {convo.title}
                      </span>
                      {currentChatId !== convo.chatId && (
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-black to-transparent opacity-100 group-hover:opacity-0 hidden md:block" />
                      )}
                    </div>
                  </SidebarChatItem>
                ))}
              </React.Fragment>
            ))
          )}
        </div>

        <div className="mt-auto shrink-0 pl-2.5 pr-4 pt-1 pb-1 sm:pt-2 sm:pb-3">
          <div className="flex w-full items-center gap-0 py-1">
            <button className="flex items-center gap-1.5 text-[0.8125rem] group text-zinc-300 hover:text-zinc-50 font-normal pl-2 cursor-pointer">
              <Wallet
                size={18}
                weight="regular"
                className="text-zinc-400 group-hover:text-zinc-100"
              />
              $0.02
            </button>
            <button className="flex items-center gap-1.5 text-[0.8125rem] group text-zinc-300 hover:text-zinc-50 font-normal pl-3 whitespace-nowrap cursor-pointer">
              <HardDrive
                size={18}
                weight="regular"
                className="text-zinc-400 group-hover:text-zinc-100"
              />
              {usagePct.toFixed(2)}%
            </button>
            <div className="ml-auto flex items-center gap-2">
              <a
                href="https://github.com/onecompany/gpt"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubLogo
                  size={18}
                  weight="regular"
                  className="text-zinc-400 hover:text-zinc-100"
                />
              </a>
              <a
                href="https://x.com/gpticp"
                target="_blank"
                rel="noopener noreferrer"
              >
                <XLogo
                  size={18}
                  weight="regular"
                  className="text-zinc-400 hover:text-zinc-100"
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
