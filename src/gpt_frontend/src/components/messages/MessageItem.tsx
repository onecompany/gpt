import React, { memo, useState, useCallback, useMemo } from "react";
import { useChatStore } from "@/store/chatStore";
import { getSiblings, findNewestLeaf } from "@/utils/messageTree";
import { MessageToolbar } from "./MessageToolbar";
import { MessageContent } from "./MessageContent";
import { MessageAttachment } from "./MessageAttachment";
import clsx from "clsx";
import { ChatId, MessageId } from "@/types/brands";

interface MessageItemProps {
  chatId: ChatId;
  messageId: MessageId;
  onActionRequiresScroll: (behavior?: ScrollBehavior) => void;
}

export const MessageItem: React.FC<MessageItemProps> = memo(
  ({ chatId, messageId, onActionRequiresScroll }) => {
    const message = useChatStore((state) =>
      state.messages[chatId]?.get(messageId),
    );
    const {
      messages: allMessagesMaps,
      editUserMessage,
      retryAiMessage,
      setActiveLeaf,
    } = useChatStore();

    const [isTruncated, setIsTruncated] = useState(false);
    const toggleTruncate = useCallback(
      () => setIsTruncated((prev) => !prev),
      [],
    );

    const [siblings, siblingIndex] = useMemo(() => {
      if (!message) return [[], 0];
      const chatMap = allMessagesMaps[chatId];
      if (!(chatMap instanceof Map)) return [[], 0];
      const s = getSiblings(chatMap, message.parentMessageId);
      const currentMsgId = message.backendId ?? message.id;
      const idx =
        s.findIndex((m) => (m.backendId ?? m.id) === currentMsgId) + 1;
      return [s, idx];
    }, [allMessagesMaps, chatId, message]);

    const handlePrevSibling = useCallback(() => {
      const currentMessagesMap = useChatStore.getState().messages[chatId];
      if (
        siblingIndex <= 1 ||
        !(currentMessagesMap instanceof Map) ||
        !siblings.length
      )
        return;
      const newSibling = siblings[siblingIndex - 2];
      if (!newSibling) return;
      const newLeafId = findNewestLeaf(
        currentMessagesMap,
        newSibling.backendId ?? newSibling.id,
      );
      // toMessageId cast ensures type safety at boundary
      setActiveLeaf(chatId, newLeafId as MessageId);
    }, [chatId, siblingIndex, siblings, setActiveLeaf]);

    const handleNextSibling = useCallback(() => {
      const currentMessagesMap = useChatStore.getState().messages[chatId];
      if (
        siblingIndex >= siblings.length ||
        !(currentMessagesMap instanceof Map) ||
        !siblings.length
      )
        return;
      const newSibling = siblings[siblingIndex];
      if (!newSibling) return;
      const newLeafId = findNewestLeaf(
        currentMessagesMap,
        newSibling.backendId ?? newSibling.id,
      );
      setActiveLeaf(chatId, newLeafId as MessageId);
    }, [chatId, siblingIndex, siblings, setActiveLeaf]);

    const isGenerationFinished = useMemo(() => {
      if (!message) return true;
      return !!(message.isComplete || message.errorStatus);
    }, [message]);

    const nonReasoningContent = useMemo(() => {
      if (
        !message ||
        message.role !== "assistant" ||
        message.errorStatus ||
        !message.content.trim().startsWith("<think>")
      ) {
        return message?.content ?? "";
      }
      const endTag = "</think>";
      const endIdx = message.content.indexOf(endTag);
      return endIdx !== -1
        ? message.content.substring(endIdx + endTag.length).trim()
        : "";
    }, [message]);

    const onEdit = async () => {
      const currentContent = message?.content;
      if (!currentContent || !message) return;
      const newContent = prompt("Edit:", currentContent);
      if (newContent && newContent.trim() !== currentContent.trim()) {
        onActionRequiresScroll("smooth");
        await editUserMessage(
          String(message.chatId), // Cast branded type to string for action if needed
          message.backendId ?? message.id,
          newContent.trim(),
        );
      }
    };

    const onRetry = async () => {
      if (!message?.parentMessageId) return;
      onActionRequiresScroll("smooth");
      await retryAiMessage(String(message.chatId), message.parentMessageId);
    };

    if (!message) {
      return null;
    }

    if (message.role === "tool") {
      return null;
    }

    const hasTextContent = message.content?.trim().length > 0;
    const hasAttachments =
      message.attachments && message.attachments.length > 0;
    const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;

    return (
      <div
        className={clsx(
          "message",
          message.role,
          { "mb-2": !hasToolCalls },
          "ml-4 mr-3 xs:ml-1 xs:mr-1 xl:ml-0 xl:mr-0 flex",
          {
            "justify-end": message.role === "user",
            "justify-start": message.role !== "user",
          },
        )}
      >
        {message.role === "user" ? (
          <div className="mb-3 group flex flex-col items-end w-full">
            {hasTextContent && (
              <div className="max-w-160 items-end">
                <div className="rounded-2xl text-zinc-200 whitespace-pre-wrap overflow-auto bg-zinc-800 px-3.5 py-2 text-[1rem] font-system leading-5.5">
                  <MessageContent
                    message={message}
                    isGenerationFinished={isGenerationFinished}
                    isTruncated={isTruncated}
                  />
                </div>
              </div>
            )}
            {hasAttachments && (
              <MessageAttachment
                attachments={message.attachments}
                className={hasTextContent ? "mt-1.5" : ""}
              />
            )}
            <MessageToolbar
              message={message}
              nonReasoningContent={nonReasoningContent}
              siblingsCount={siblings.length}
              siblingIndex={siblingIndex}
              isTruncated={isTruncated}
              toggleTruncate={toggleTruncate}
              handlePrevSibling={handlePrevSibling}
              handleNextSibling={handleNextSibling}
              onEdit={onEdit}
              onRetry={onRetry}
            />
          </div>
        ) : (
          <div className="group flex w-full max-w-208 bg-none flex-col items-start">
            <div className="max-w-full w-full overflow-x-auto bg-none mx-0.5 leading-6.5 text-[1rem] font-system text-zinc-200">
              <MessageContent
                message={message}
                isGenerationFinished={isGenerationFinished}
                isTruncated={isTruncated}
              />
            </div>
            <MessageToolbar
              message={message}
              nonReasoningContent={nonReasoningContent}
              siblingsCount={siblings.length}
              siblingIndex={siblingIndex}
              isTruncated={isTruncated}
              toggleTruncate={toggleTruncate}
              handlePrevSibling={handlePrevSibling}
              handleNextSibling={handleNextSibling}
              onEdit={onEdit}
              onRetry={onRetry}
            />
          </div>
        )}
      </div>
    );
  },
);

MessageItem.displayName = "MessageItem";
