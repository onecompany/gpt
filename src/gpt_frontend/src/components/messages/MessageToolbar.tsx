import React, { memo, useState } from "react";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { Message } from "@/types";
import {
  PencilSimple,
  CaretDown,
  CaretUp,
  CopySimple,
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  Info,
} from "@phosphor-icons/react";
import { MessageInfoModal } from "./MessageInfoModal";

interface MessageToolbarProps {
  message: Message;
  nonReasoningContent: string;
  siblingsCount: number;
  siblingIndex: number;
  isTruncated: boolean;
  toggleTruncate: () => void;
  handlePrevSibling: () => void;
  handleNextSibling: () => void;
  onEdit: () => void;
  onRetry: () => void;
}

export const MessageToolbar: React.FC<MessageToolbarProps> = memo(
  ({
    message,
    nonReasoningContent,
    siblingsCount,
    siblingIndex,
    isTruncated,
    toggleTruncate,
    handlePrevSibling,
    handleNextSibling,
    onEdit,
    onRetry,
  }) => {
    const authStatus = useAuthStore((state) => state.authStatus);
    const renderMode = useChatStore((state) => state.renderMode);
    const [showInfoModal, setShowInfoModal] = useState(false);

    if (!message) {
      return null;
    }

    if (message.role === "assistant") {
      const isFinished = !!(message.isComplete || message.errorStatus);
      if (!isFinished) {
        return null;
      }

      const hasTextContent = nonReasoningContent.trim().length > 0;
      if (!message.errorStatus && !hasTextContent) {
        return null;
      }
    }

    const isUser = message.role === "user";
    const isUserRegistered = authStatus === AuthStatus.REGISTERED;
    const contentToCheck = isUser ? message.content : nonReasoningContent;
    const shouldShowTruncateButton = isUser && contentToCheck.length > 800;
    const showSiblingNav = siblingsCount > 1;
    const enableLeftNav = siblingIndex > 1;
    const enableRightNav = siblingIndex < siblingsCount;

    const buttons = [];

    if (isUser && shouldShowTruncateButton && !message.errorStatus) {
      buttons.push(
        <button
          key="truncate"
          className="flex items-center mr-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
          onClick={toggleTruncate}
          aria-label={isTruncated ? "Show full" : "Show less"}
        >
          {isTruncated ? (
            <CaretDown weight="regular" size={18} />
          ) : (
            <CaretUp weight="regular" size={18} />
          )}
        </button>,
      );
    }

    if (isUser && isUserRegistered) {
      buttons.push(
        <button
          key="edit"
          className="flex items-center mr-0.5 text-zinc-400 hover:text-zinc-200 cursor-pointer"
          onClick={onEdit}
          aria-label="Edit"
        >
          <PencilSimple weight="regular" size={18} />
        </button>,
      );
    }

    if (message.role === "assistant" && !message.errorStatus) {
      buttons.push(
        <button
          key="copy"
          className="flex mr-2 items-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
          onClick={() => navigator.clipboard.writeText(nonReasoningContent)}
          aria-label="Copy"
        >
          <CopySimple weight="regular" size={18} />
        </button>,
      );
    }

    if (message.role === "assistant" && isUserRegistered) {
      buttons.push(
        <button
          key="retry"
          className="flex mr-2 items-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
          onClick={onRetry}
          aria-label="Retry"
        >
          <ArrowsClockwise weight="regular" size={18} />
        </button>,
      );
    }

    if (message.role === "assistant" && message.usage) {
      buttons.push(
        <button
          key="info"
          className="flex mr-2 items-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
          onClick={() => setShowInfoModal(true)}
          aria-label="Message Details"
        >
          <Info weight="regular" size={18} />
        </button>,
      );
    }

    if (showSiblingNav) {
      buttons.push(
        <div
          key="branchNav"
          className="flex items-center text-zinc-400 text-[0.9375rem]"
        >
          <div className="flex items-center">
            <button
              onClick={handlePrevSibling}
              disabled={!enableLeftNav}
              className={`transition ${
                enableLeftNav
                  ? "hover:text-zinc-100 cursor-pointer"
                  : "text-zinc-600 cursor-default"
              }`}
              aria-label="Previous version"
            >
              <CaretLeft size={18} />
            </button>
            <span className="mx-0.5 text-xs select-none">
              {siblingIndex}/{siblingsCount}
            </span>
            <button
              onClick={handleNextSibling}
              disabled={!enableRightNav}
              className={`transition ${
                enableRightNav
                  ? "hover:text-zinc-100 cursor-pointer"
                  : "text-zinc-600 cursor-default"
              }`}
              aria-label="Next version"
            >
              <CaretRight size={18} />
            </button>
          </div>
        </div>,
      );
    }

    if (buttons.length === 0) return null;

    return (
      <>
        <div
          className={`flex items-center text-[0.9375rem] ${isUser || renderMode === "plain" ? " mt-2" : ""}`}
        >
          {buttons}
        </div>
        <MessageInfoModal
          isOpen={showInfoModal}
          onClose={() => setShowInfoModal(false)}
          message={message}
        />
      </>
    );
  },
);

MessageToolbar.displayName = "MessageToolbar";
MessageToolbar.displayName = "MessageToolbar";
