import React, { useMemo, Fragment } from "react";
import { tokenizeQuery } from "@/utils/textUtils";

interface SearchHighlightProps {
  text: string;
  query: string;
}

export const SearchHighlight: React.FC<SearchHighlightProps> = ({ text, query }) => {
  const parts = useMemo(() => {
    if (!query.trim() || !text) {
      return [text];
    }

    // Security: Limit query complexity to prevent ReDoS on massive inputs
    if (query.length > 500) {
      return [text];
    }

    const queryWords = tokenizeQuery(query);
    if (queryWords.length === 0) {
      return [text];
    }

    // Limit number of distinct words to highlight to prevent excessive regex complexity
    const distinctWords = Array.from(new Set(queryWords)).slice(0, 50);

    // Escape regex characters to prevent ReDoS
    const escapedWords = distinctWords.map((word) =>
      word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );

    // Non-literal regex is required here for dynamic highlighting.
    // Inputs are length-limited and fully escaped.
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    const regex = new RegExp(`\\b(${escapedWords.join("|")})\\b`, "gi");

    const _parts = [];
    let lastIndex = 0;
    let match;

    // Safety: limit matches to prevent UI freezing on extremely repetitive text
    let matchCount = 0;
    while ((match = regex.exec(text)) !== null && matchCount < 1000) {
      matchCount++;
      if (match.index > lastIndex) {
        _parts.push(text.substring(lastIndex, match.index));
      }
      _parts.push(match[0]);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      _parts.push(text.substring(lastIndex));
    }

    return _parts;
  }, [text, query]);

  return (
    <span className="text-sm text-zinc-300 whitespace-pre-wrap">
      {parts.map((part, index) => {
        // Simple heuristic: if the part matches one of our query words (case-insensitive), highlight it.
        // We re-tokenize briefly here or just check against the regex.
        // To be accurate with "parts" logic above: odd indices are matches if we captured groups,
        // but here we pushed strings. We need to know if 'part' is a match.
        // Re-running regex test on the part is safe and fast for small strings.

        const isMatch =
          query.trim() &&
          part.length > 0 &&
          // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
          new RegExp(
            `^(${tokenizeQuery(query)
              .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              .join("|")})$`,
            "i",
          ).test(part);

        return isMatch ? (
          <mark key={index} className="bg-zinc-600 text-zinc-100 rounded-sm">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        );
      })}
    </span>
  );
};

SearchHighlight.displayName = "SearchHighlight";
