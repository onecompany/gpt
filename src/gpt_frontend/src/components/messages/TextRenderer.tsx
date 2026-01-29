"use client";

import React from "react";
import { useChatStore } from "@/store/chatStore";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface TextRendererProps {
  content: string;
  isAnimating?: boolean;
}

/**
 * Renders text based on user's render mode preference.
 * Supports plain text or markdown with streaming.
 */
export const TextRenderer: React.FC<TextRendererProps> = ({
  content,
  isAnimating = false,
}) => {
  const renderMode = useChatStore((state) => state.renderMode);

  if (renderMode === "markdown") {
    return <MarkdownRenderer content={content} isAnimating={isAnimating} />;
  }

  // Plain text mode - original behavior
  return (
    <div className="whitespace-pre-wrap wrap-break-word text-zinc-300 font-system text-base leading-6.5">
      {content}
    </div>
  );
};
