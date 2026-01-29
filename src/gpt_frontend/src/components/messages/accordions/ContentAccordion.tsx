import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { Brain, Link, CaretDown } from "@phosphor-icons/react";
import type { ContentAccordionProps } from "./types";
import { ReasoningContent, SourcesContent } from "./ContentRenderer";

export const ContentAccordion: React.FC<ContentAccordionProps> = (props) => {
  const [isExpanded, setIsExpanded] = useState(props.defaultExpanded ?? false);

  const { label } = useMemo(() => {
    switch (props.type) {
      case "reasoning":
        return {
          icon: <Brain size={12} weight="bold" />,
          label:
            "finishedLabel" in props && props.finishedLabel
              ? props.finishedLabel
              : "Reasoning",
        };
      case "sources":
        return {
          icon: <Link size={12} weight="bold" />,
          label: "Sources",
        };
    }
  }, [props]);

  const isEmpty = useMemo(() => {
    switch (props.type) {
      case "reasoning":
        return !props.content?.trim();
      case "sources":
        return props.definitions.size === 0;
    }
  }, [props]);

  if (isEmpty) return null;

  return (
    <div className={clsx("inline-block", props.className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          "inline-flex items-center gap-1.5 py-1 mb-1 cursor-pointer",
          "text-base",
          "transition-all duration-150 text-zinc-400 hover:text-zinc-100",
        )}
        aria-expanded={isExpanded}
      >
        <span>{label}</span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-0.5"
        >
          <CaretDown size={14} weight="bold" />
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
            <div className="mt-2 mb-1">
              <div
                className={clsx(
                  "rounded-lg px-3 py-2.5",
                  "bg-zinc-850 border border-zinc-800",
                  "text-sm",
                )}
              >
                {props.type === "reasoning" && (
                  <ReasoningContent content={props.content} />
                )}
                {props.type === "sources" && (
                  <SourcesContent definitions={props.definitions} />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

ContentAccordion.displayName = "ContentAccordion";
