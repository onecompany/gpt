import React, { memo } from "react";
import { Message } from "@/types";
import { MessageItem } from "./MessageItem";
import { ChatId } from "@/types/brands";

interface MessagesListProps {
  messages: Message[];
  sentinelRef: React.Ref<HTMLDivElement>;
  onActionRequiresScroll: (behavior?: ScrollBehavior) => void;
}

const MessagesListComponent: React.FC<MessagesListProps> = ({
  messages,
  sentinelRef,
  onActionRequiresScroll,
}) => {
  const chatId =
    messages.length > 0 ? (String(messages[0].chatId) as ChatId) : undefined;

  return (
    <div className="my-6 sm:mt-8 sm:mb-18 space-y-0">
      {chatId &&
        messages.map((msg) => (
          <MessageItem
            key={`${msg.chatId}-${msg.backendId ?? msg.id}-${msg.role}`}
            chatId={chatId}
            messageId={msg.backendId ?? msg.id}
            onActionRequiresScroll={onActionRequiresScroll}
          />
        ))}
      <div ref={sentinelRef} className="h-1 w-full" />
    </div>
  );
};

export const MessagesList = memo(MessagesListComponent, (prevProps, nextProps) => {
  return prevProps.messages === nextProps.messages;
});
MessagesList.displayName = "MessagesList";
