import React, { memo } from "react";
import { PencilSimpleLine, Trash, Archive } from "@phosphor-icons/react";
import clsx from "clsx";
import { Message } from "@/types";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/Dropdown";
import { ChatId } from "@/types/brands";

interface ChatTitleDropdownProps {
  messages: Message[];
  chatTitle: string;
  currentChatId: ChatId | null;
  onRenameChat: (chatId: string, newTitle: string) => Promise<void>;
  onDeleteChat: (chatId: string) => Promise<void>;
  archived: boolean;
  onArchiveChat: (chatId: string) => Promise<void>;
  onUnarchiveChat: (chatId: string) => Promise<void>;
}

export const ChatTitleDropdown: React.FC<ChatTitleDropdownProps> = memo(
  ({
    messages,
    chatTitle,
    currentChatId,
    onRenameChat,
    onDeleteChat,
    archived,
    onArchiveChat,
    onUnarchiveChat,
  }) => {
    const handleRenameChat = async () => {
      if (!currentChatId) return;
      const newTitle = prompt("Enter new chat name:", chatTitle);
      if (newTitle && newTitle.trim() !== "") {
        try {
          await onRenameChat(currentChatId, newTitle.trim());
        } catch (error) {
          console.error("Error renaming chat:", error);
          alert("Failed to rename chat. Please try again.");
        }
      }
    };

    const handleDeleteChat = async () => {
      if (!currentChatId) return;
      if (confirm("Are you sure you want to delete this chat?")) {
        try {
          await onDeleteChat(currentChatId);
        } catch (error) {
          console.error("Error deleting chat:", error);
          alert("Failed to delete chat. Please try again.");
        }
      }
    };

    const handleArchiveChat = async () => {
      if (!currentChatId) return;
      try {
        await onArchiveChat(currentChatId);
      } catch (error) {
        console.error("Error archiving chat:", error);
        alert("Failed to archive chat. Please try again.");
      }
    };

    const handleUnarchiveChat = async () => {
      if (!currentChatId) return;
      try {
        await onUnarchiveChat(currentChatId);
      } catch (error) {
        console.error("Error unarchiving chat:", error);
        alert("Failed to unarchive chat. Please try again.");
      }
    };

    const iconClass = "text-zinc-400 group-hover:text-zinc-200";

    return (
      <div className="absolute left-1/2 transform -translate-x-1/2">
        <Dropdown as="div" className="relative inline-block text-left z-20">
          {({ open }) => (
            <>
              {messages.length > 0 && (
                <DropdownTrigger
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-normal cursor-pointer",
                    open
                      ? "text-zinc-200"
                      : "text-zinc-350 hover:text-zinc-200",
                  )}
                >
                  <span className="truncate max-w-24 sm:max-w-52 md:max-w-72 overflow-hidden whitespace-nowrap align-middle text-sm font-normal">
                    {chatTitle}
                  </span>
                </DropdownTrigger>
              )}
              <DropdownContent
                width="min-w-[9rem]"
                className="left-1/2 -translate-x-1/2 origin-top"
              >
                <DropdownItem onClick={handleRenameChat}>
                  <PencilSimpleLine
                    weight="regular"
                    className={iconClass}
                    size={20}
                  />
                  <span className="ml-2.5">Rename</span>
                </DropdownItem>

                <DropdownItem
                  onClick={archived ? handleUnarchiveChat : handleArchiveChat}
                >
                  <Archive weight="regular" className={iconClass} size={20} />
                  <span className="ml-2.5">
                    {archived ? "Unarchive" : "Archive"}
                  </span>
                </DropdownItem>

                <DropdownItem onClick={handleDeleteChat}>
                  <Trash weight="regular" className={iconClass} size={20} />
                  <span className="ml-2.5">Delete</span>
                </DropdownItem>
              </DropdownContent>
            </>
          )}
        </Dropdown>
      </div>
    );
  },
);

ChatTitleDropdown.displayName = "ChatTitleDropdown";
ChatTitleDropdown.displayName = "ChatTitleDropdown";
