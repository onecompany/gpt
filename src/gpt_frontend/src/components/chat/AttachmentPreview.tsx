import React, { useRef, useState, useEffect } from "react";
import {
  AnimatePresence,
  motion,
  usePresence,
  TargetAndTransition,
} from "framer-motion";
import { useChatStore } from "@/store/chatStore";
import { FilePill } from "./FilePill";
import clsx from "clsx";

export const AttachmentPreview: React.FC = () => {
  const attachments = useChatStore((state) => state.attachments);
  const removeAttachment = useChatStore((state) => state.removeAttachment);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [isPresent] = usePresence();

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateFadeIndicators = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftFade(scrollLeft > 0);
      setShowRightFade(scrollLeft + clientWidth < scrollWidth - 1);
    };

    updateFadeIndicators();
    container.addEventListener("scroll", updateFadeIndicators, {
      passive: true,
    });

    const resizeObserver = new ResizeObserver(updateFadeIndicators);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", updateFadeIndicators);
      resizeObserver.disconnect();
    };
  }, [attachments.length]);

  if (attachments.length === 0 && isPresent) {
    return null;
  }

  const exitAnimation: TargetAndTransition = {
    opacity: 0,
    y: 15,
    height: 0,
    transition: {
      duration: 0.25,
      ease: "easeInOut",
    },
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0, y: -15 }}
      animate={{
        opacity: 1,
        height: "auto",
        y: 0,
        transition: {
          duration: 0.25,
          ease: "easeOut",
        },
      }}
      exit={exitAnimation}
      className="w-full mb-2 relative"
    >
      <div className="relative">
        <div
          className={clsx(
            "absolute left-0 top-0 h-full w-8 bg-linear-to-r from-zinc-875 to-transparent pointer-events-none z-10 transition-opacity duration-200",
            showLeftFade ? "opacity-100" : "opacity-0",
          )}
        />

        <div
          className={clsx(
            "absolute right-0 top-0 h-full w-8 bg-linear-to-l from-zinc-875 to-transparent pointer-events-none z-10 transition-opacity duration-200",
            showRightFade ? "opacity-100" : "opacity-0",
          )}
        />

        <div
          ref={scrollContainerRef}
          className="overflow-x-auto overflow-y-hidden scrollbar-hide border border-zinc-700 rounded-lg bg-zinc-875 p-2"
          style={{
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <div
            className="flex gap-2"
            role="region"
            aria-label="File attachments"
          >
            <AnimatePresence mode="popLayout">
              {attachments.map((attachment) => (
                <FilePill
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={removeAttachment}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </motion.div>
  );
};

AttachmentPreview.displayName = "AttachmentPreview";
