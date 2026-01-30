import React, { memo, useMemo } from "react";
import { Message } from "@/types";
import { TextRenderer } from "./TextRenderer";
import { ContentAccordion } from "./accordions";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { ToolResultsDisplay } from "./ToolResultsDisplay";
import { WarningCircle } from "@phosphor-icons/react";
import { formatErrorStatus } from "@/utils/messageUtils";
import { useChatStore } from "@/store/chatStore";

interface MessageContentProps {
  message: Message;
  isGenerationFinished: boolean;
  isTruncated: boolean;
}

const AssistantPlaceholder: React.FC = () => (
  <div className="text-zinc-400">Thinking…</div>
);

export const MessageContent: React.FC<MessageContentProps> = memo(
  ({ message, isGenerationFinished, isTruncated }) => {
    const { runAndContinueFromTools, isProcessingTools } = useChatStore();
    const compositeKey = `${message.chatId}:${message.backendId ?? message.id}`;
    const isToolsLoading = isProcessingTools[compositeKey] ?? false;

    // Derived state for reasoning content and timing
    const reasoningData = useMemo(() => {
      if (message.role !== "assistant") {
        return {
          reasoningContent: null,
          nonReasoningContent: message.content,
          isComplete: false,
          duration: null,
        };
      }

      const trimmed = message.content.trim();
      const startTag = "<think>";
      const endTag = "</think>";

      if (!trimmed.startsWith(startTag)) {
        return {
          reasoningContent: null,
          nonReasoningContent: message.content,
          isComplete: false,
          duration: null,
        };
      }

      const endIdx = trimmed.indexOf(endTag);
      const hasEndTag = endIdx !== -1;

      // Extract reasoning
      const reasoning = hasEndTag
        ? trimmed.substring(startTag.length, endIdx).trim()
        : trimmed.substring(startTag.length).trim();

      // Extract final content
      const finalContent = hasEndTag
        ? trimmed.substring(endIdx + endTag.length).trim()
        : "";

      return {
        reasoningContent: reasoning,
        nonReasoningContent: finalContent,
        isComplete: hasEndTag,
        duration: null,
      };
    }, [message]);

    const {
      reasoningContent,
      nonReasoningContent,
      isComplete: reasoningComplete,
    } = reasoningData;

    const displayedText = useMemo(() => {
      const contentToUse =
        message.role === "user" ? message.content : nonReasoningContent;
      const truncateLimit = 600;
      if (isTruncated && contentToUse.length > 800) {
        return contentToUse.slice(0, truncateLimit) + "...";
      }
      return contentToUse;
    }, [message, nonReasoningContent, isTruncated]);

    const errorMessage = message.errorStatus
      ? formatErrorStatus(message.errorStatus)
      : null;

    // Error banner component - shown above content when both exist
    const errorBanner = errorMessage ? (
      <div className="flex items-start text-sm pl-3 pr-3.5 py-2 sm:py-2.5 rounded-2xl bg-red-900/20 text-red-300 mb-2">
        <WarningCircle
          size={18}
          weight="regular"
          className="mr-2 shrink-0 mt-0.5"
        />
        <span>{errorMessage}</span>
      </div>
    ) : null;

    // If there's an error but no content, only show the error
    const hasContent = message.content && message.content.trim().length > 0;
    if (errorMessage && !hasContent) {
      return errorBanner;
    }

    // Determine if we should show "Thinking..." placeholder
    const showThinking =
      message.role === "assistant" &&
      !isGenerationFinished &&
      message.content.trim().length === 0 &&
      !reasoningContent &&
      !message.tool_calls;

    const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
    const needsClientAction = !!message.requires_client_action;

    if (hasToolCalls) {
      return (
        <div>
          {errorBanner}
          <ToolCallDisplay
            toolCalls={message.tool_calls!}
            onRunTools={
              needsClientAction
                ? () =>
                    runAndContinueFromTools(
                      String(message.chatId),
                      message.backendId ?? message.id,
                    )
                : undefined
            }
            isLoading={isToolsLoading}
          />
          {message.tool_results && (
            <ToolResultsDisplay
              results={message.tool_results}
              toolCalls={message.tool_calls!}
            />
          )}
        </div>
      );
    }

    if (reasoningContent) {
      return (
        <div>
          {errorBanner}
          <div className="mb-2">
            <ContentAccordion
              type="reasoning"
              content={reasoningContent}
              defaultExpanded={false}
              finishedLabel={
                reasoningComplete ? "Reasoning Finished" : "Reasoning..."
              }
            />
          </div>

          {reasoningComplete &&
          nonReasoningContent.trim().length === 0 &&
          !isGenerationFinished ? (
            <AssistantPlaceholder />
          ) : nonReasoningContent.trim().length > 0 ? (
            <TextRenderer content={displayedText} isAnimating={!isGenerationFinished} />
          ) : null}
        </div>
      );
    }

    if (showThinking) {
      return (
        <div>
          {errorBanner}
          <AssistantPlaceholder />
        </div>
      );
    }

    if (message.role === "assistant") {
      return (
        <div>
          {errorBanner}
          <TextRenderer content={displayedText} isAnimating={!isGenerationFinished} />
        </div>
      );
    }

    return (
      <div>
        {errorBanner}
        <div className="whitespace-pre-wrap wrap-break-word">{displayedText}</div>
      </div>
    );
  },
);

MessageContent.displayName = "MessageContent";
