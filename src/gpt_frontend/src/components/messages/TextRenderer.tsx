import React from "react";

interface TextRendererProps {
  content: string;
}

/**
 * Renders text exactly as received without any Markdown/LaTeX parsing.
 */
export const TextRenderer: React.FC<TextRendererProps> = ({ content }) => {
  return (
    <div className="whitespace-pre-wrap wrap-break-word text-zinc-300 font-system text-base leading-7">
      {content}
    </div>
  );
};
