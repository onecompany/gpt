import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { CaretDown } from "@phosphor-icons/react";
import { SearchHighlight } from "@/components/ui";

export interface FileSearchResultItem {
  fileName: string;
  text: string;
}

interface FileSearchResultsAccordionProps {
  results: FileSearchResultItem[];
  query: string;
}

export const FileSearchResultsAccordion: React.FC<FileSearchResultsAccordionProps> = ({
  results,
  query,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          "inline-flex items-center gap-1.5 py-0.5 mb-0.5",
          "text-sm",
          "transition-all duration-150 text-zinc-400 hover:text-zinc-100",
        )}
        aria-expanded={isExpanded}
      >
        <span>
          Found {results.length} relevant result
          {results.length > 1 ? "s" : ""}
        </span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-0.5"
        >
          <CaretDown size={12} weight="bold" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              opacity: { duration: 0.15 },
              height: { duration: 0.2 },
            }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 mb-0 space-y-1.5">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="rounded-lg p-2 bg-zinc-850 border border-zinc-800 max-h-72 overflow-y-auto"
                >
                  <p
                    className="text-xs font-medium text-zinc-400 mb-1 truncate"
                    title={result.fileName}
                  >
                    Source: {result.fileName}
                  </p>
                  <div className="text-xs leading-relaxed text-zinc-300">
                    <SearchHighlight text={result.text} query={query} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

FileSearchResultsAccordion.displayName = "FileSearchResultsAccordion";
