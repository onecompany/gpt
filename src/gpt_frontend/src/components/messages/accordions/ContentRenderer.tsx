import React, { useMemo } from "react";

interface ReasoningContentProps {
  content: string;
}

export const ReasoningContent: React.FC<ReasoningContentProps> = ({
  content,
}) => (
  <div className="text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap wrap-break-word ">
    {content}
  </div>
);

interface SourcesContentProps {
  definitions: Map<string, string>;
}

export const SourcesContent: React.FC<SourcesContentProps> = ({
  definitions,
}) => {
  const sortedDefinitions = useMemo(() => {
    return Array.from(definitions.entries()).sort(([keyA], [keyB]) => {
      const numA = parseInt(keyA, 10);
      const numB = parseInt(keyB, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return keyA.localeCompare(keyB);
    });
  }, [definitions]);

  return (
    <ol className="list-none space-y-1.5">
      {sortedDefinitions.map(([identifier, definitionText]) => (
        <li key={identifier} className="text-xs leading-relaxed">
          <span className="font-medium text-zinc-400 mr-1">
            [{identifier}]:
          </span>
          <div className="inline text-zinc-300 whitespace-pre-wrap wrap-break-word">
            {definitionText.trim()}
          </div>
        </li>
      ))}
    </ol>
  );
};
