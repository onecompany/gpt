import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { CaretDown, Globe } from "@phosphor-icons/react";
import { TextRenderer } from "./TextRenderer";

interface WebSearchResultsAccordionProps {
  content: string;
}

export const WebSearchResultsAccordion: React.FC<WebSearchResultsAccordionProps> = ({
  content,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          "inline-flex items-center gap-1.5 py-0.5 mb-0.5",
          "text-sm",
          "transition-all duration-150 text-zinc-400 hover:text-zinc-100",
          "cursor-pointer ",
        )}
        aria-expanded={isExpanded}
      >
        <Globe size={14} weight="regular" />
        <span>Web Search Results</span>
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
            <div className="mt-1.5 mb-0 rounded-lg px-3 pt-3 pb-2 bg-zinc-850 border border-zinc-800 text-sm text-zinc-300">
              <TextRenderer content={content} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

WebSearchResultsAccordion.displayName = "WebSearchResultsAccordion";
