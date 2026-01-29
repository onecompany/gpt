import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react";

interface ScrollToBottomButtonProps {
  onClick: () => void;
  hasUnread: boolean;
}

export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  onClick,
  hasUnread,
}) => {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="relative flex items-center justify-center w-7.5 h-7.5 rounded-full bg-zinc-750 hover:bg-zinc-650 text-zinc-200 shadow-lg border border-zinc-600  focus:ring-0"
      aria-label="Scroll to bottom"
      title="Scroll to latest message"
    >
      <CaretDown size={16} weight="regular" />
      <AnimatePresence>
        {hasUnread && (
          <motion.div
            layoutId="unread-dot"
            className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-zinc-450 ring-2 ring-zinc-900"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
};

ScrollToBottomButton.displayName = "ScrollToBottomButton";
