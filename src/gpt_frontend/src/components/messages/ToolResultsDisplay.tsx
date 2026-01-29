import React, { useMemo } from "react";
import { ToolResult, ToolCall } from "@/types";
import { WarningCircle, Check } from "@phosphor-icons/react";
import {
  FileSearchResultsAccordion,
  FileSearchResultItem,
} from "./FileSearchResultsAccordion";
import { WebSearchResultsAccordion } from "./WebSearchResultsAccordion";

interface ToolResultsDisplayProps {
  results: ToolResult[];
  toolCalls: ToolCall[];
}

const parseFileSearchResults = (content: string): FileSearchResultItem[] => {
  const regex_global =
    /Result \d+:\nSource File: "([^"]+)"\n---\n([\s\S]+?)\n---/g;
  const results = [];
  let match;
  while ((match = regex_global.exec(content)) !== null) {
    results.push({
      fileName: match[1],
      text: match[2].trim(),
    });
  }
  return results;
};

export const ToolResultsDisplay: React.FC<ToolResultsDisplayProps> = ({
  results,
  toolCalls,
}) => {
  const toolCallMap = useMemo(
    () => new Map(toolCalls.map((call) => [call.id, call])),
    [toolCalls],
  );

  const renderResult = (result: ToolResult) => {
    const toolCall = toolCallMap.get(result.tool_call_id);

    if (toolCall?.function.name === "files_search") {
      let query = "";
      try {
        query = JSON.parse(toolCall.function.arguments).query;
      } catch (e) {
        console.error(
          "Failed to parse tool call arguments for files_search:",
          e,
        );
      }

      const parsedResults = parseFileSearchResults(result.content);

      if (parsedResults.length > 0) {
        return (
          <FileSearchResultsAccordion results={parsedResults} query={query} />
        );
      }
    }

    if (toolCall?.function.name === "web_search") {
      return <WebSearchResultsAccordion content={result.content} />;
    }

    return (
      <div className="text-xs rounded-lg">
        <div className="flex items-center gap-2">
          {result.error ? (
            <WarningCircle size={12} className="text-red-400" />
          ) : (
            <Check size={12} className="text-green-400" />
          )}
          <pre className="text-zinc-400 whitespace-pre-wrap text-xs">
            {result.content}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-2 mb-1 space-y-2">
      {results.map((result) => (
        <div key={result.tool_call_id}>{renderResult(result)}</div>
      ))}
    </div>
  );
};

ToolResultsDisplay.displayName = "ToolResultsDisplay";
