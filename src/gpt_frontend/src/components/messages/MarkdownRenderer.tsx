"use client";

import React, { useMemo } from "react";
import { Streamdown } from "streamdown";
import { createCodePlugin } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { cjk } from "@streamdown/cjk";

// Configure plugins OUTSIDE component for stable references (per Streamdown docs)
const codePlugin = createCodePlugin({
  themes: ["one-dark-pro", "one-dark-pro"],
});

const mathPlugin = createMathPlugin({
  singleDollarTextMath: false, // Avoid $100 being parsed as math
  errorColor: "var(--color-red-400)",
});

const mermaidPlugin = createMermaidPlugin({
  config: {
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
  },
});

interface MarkdownRendererProps {
  content: string;
  isAnimating: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  isAnimating,
}) => {
  const plugins = useMemo(
    () => ({
      code: codePlugin,
      mermaid: mermaidPlugin,
      math: mathPlugin,
      cjk: cjk,
    }),
    [],
  );

  const components = useMemo(
    () => ({
      a: ({
        href,
        children,
        ...props
      }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-300 underline decoration-zinc-500 underline-offset-2 hover:text-zinc-100"
          {...props}
        >
          {children}
        </a>
      ),
    }),
    [],
  );

  return (
    <div className="markdown-content">
      <Streamdown
        isAnimating={isAnimating}
        mode="streaming"
        parseIncompleteMarkdown={true}
        plugins={plugins}
        className="text-zinc-300 text-base leading-6.5"
        shikiTheme={["one-dark-pro", "one-dark-pro"]}
        caret="block"
        remend={{
          linkMode: "text-only",
        }}
        controls={{
          code: false,
          table: false,
          mermaid: {
            panZoom: true,
            fullscreen: true,
            copy: true,
            download: true,
          },
        }}
        components={components}
      >
        {content}
      </Streamdown>
    </div>
  );
};
