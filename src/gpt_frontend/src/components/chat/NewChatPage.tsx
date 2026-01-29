import React, { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { motion, Variants, Transition } from "framer-motion";
import type { IconProps } from "@phosphor-icons/react";
import { useChatStore } from "@/store/chatStore";
import { ChatInput } from "./ChatInput";
import useMediaQuery from "@/hooks/useMediaQuery";
import { GlowCard } from "@/components/landing/effects";
import { newChatSuggestions as allNewChatSuggestions } from "@/constants/constants";

interface SuggestionCardProps {
  icon: React.ReactElement<IconProps>;
  title: string;
  description: string;
  onClick: () => void;
  index: number;
  isDisabled: boolean;
}

const SuggestionCard = React.memo<SuggestionCardProps>(
  ({ icon, title, description, onClick, index, isDisabled }) => {
    const ClonedIcon = React.cloneElement(icon, {
      size: 16,
    });

    return (
      <motion.li
        variants={{
          hidden: { opacity: 0, y: 20, scale: 0.95 },
          visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration: 0.4,
              delay: index * 0.08,
              ease: [0.21, 0.47, 0.32, 0.98],
            },
          },
          exit: {
            opacity: 0,
            y: -20,
            scale: 0.9,
            transition: {
              duration: 0.3,
              delay: index * 0.03,
              ease: "easeInOut",
            },
          },
        }}
      >
        <GlowCard
          className={clsx(
            "h-full w-full rounded-lg border transition-all duration-200",
            isDisabled
              ? "border-zinc-800 bg-zinc-900/30  opacity-50"
              : "border-zinc-800 bg-zinc-875 hover:border-zinc-700 hover:bg-zinc-800/50",
          )}
        >
          <button
            onClick={onClick}
            disabled={isDisabled}
            className="h-full w-full p-3 text-left  focus-visible:outline-none focus-visible:ring-0 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1">
              {ClonedIcon}
              <h3 className="font-medium text-zinc-100 text-sm">{title}</h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400">{description}</p>
          </button>
        </GlowCard>
      </motion.li>
    );
  },
);
SuggestionCard.displayName = "SuggestionCard";

const TemporaryChatToggle = React.memo(() => {
  const { isNextChatTemporary, setIsNextChatTemporary } = useChatStore();
  const spring: Transition = { type: "spring", stiffness: 700, damping: 30 };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.3 }}
    >
      <div
        onClick={() => setIsNextChatTemporary(!isNextChatTemporary)}
        className="flex items-center gap-3 cursor-pointer group"
        role="switch"
        aria-checked={isNextChatTemporary}
      >
        <span className="text-sm text-zinc-400 font-medium group-hover:text-zinc-200">
          Incognito
        </span>
        <div
          className={clsx(
            "relative flex h-4 w-8 items-center rounded-full p-1 duration-300",
            isNextChatTemporary
              ? "justify-end bg-zinc-500"
              : "justify-start bg-zinc-700",
          )}
        >
          <motion.div
            className="h-3 w-3 rounded-full bg-white"
            layout
            transition={spring}
          />
        </div>
      </div>
    </motion.div>
  );
});
TemporaryChatToggle.displayName = "TemporaryChatToggle";

interface NewChatPageProps {
  randomMessage: string;
  input: string;
  setInput: (input: string) => void;
  sendMessageAndUpdateUrl: () => Promise<void>;
  currentIsGenerating: boolean;
  currentIsAITyping: boolean;
  onAnimationComplete: () => void;
}

export const NewChatPage: React.FC<NewChatPageProps> = ({
  randomMessage,
  input,
  setInput,
  sendMessageAndUpdateUrl,
  currentIsGenerating,
  currentIsAITyping,
  onAnimationComplete,
}) => {
  const { attachments } = useChatStore();
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );

  const [displayedSuggestions, setDisplayedSuggestions] = useState<
    typeof allNewChatSuggestions
  >([]);

  useEffect(() => {
    // Schedule update for next tick to avoid hydration mismatch
    const timer = setTimeout(() => {
      setDisplayedSuggestions(
        [...allNewChatSuggestions].sort(() => Math.random() - 0.5).slice(0, 4),
      );
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSuggestionClick = useCallback(
    (description: string) => {
      if (currentIsGenerating) return;
      const suggestion = allNewChatSuggestions.find(
        (s) => s.description === description,
      );
      if (!suggestion) return;
      const fullPrompt = `${suggestion.title} ${suggestion.description}`;
      setInput(fullPrompt);
      setTimeout(() => {
        document.querySelector("textarea")?.focus();
      }, 100);
    },
    [setInput, currentIsGenerating],
  );

  const handleSendMessage = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || currentIsGenerating) {
      return;
    }
    try {
      await sendMessageAndUpdateUrl();
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }, [input, attachments, sendMessageAndUpdateUrl, currentIsGenerating]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.08,
        delayChildren: 0.2,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.03,
        staggerDirection: -1,
        when: "afterChildren",
        duration: 0.3,
      },
    },
  };

  const titleVariants: Variants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      y: 20,
      transition: { duration: 0.3, ease: "easeIn" },
    },
  };

  if (displayedSuggestions.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
      className="h-full flex flex-col items-center justify-center p-4 overflow-y-auto overscroll-contain"
    >
      <motion.div
        key="new-chat-page-content"
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={containerVariants}
        onAnimationComplete={onAnimationComplete}
        className="w-full max-w-3xl flex flex-col items-center"
      >
        <motion.h1
          variants={titleVariants}
          className="text-xl sm:text-2xl font-medium text-zinc-100 text-center mb-8"
        >
          {randomMessage}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="w-full mb-3 sm:mb-8"
        >
          <ChatInput
            variant="new"
            input={input}
            setInput={setInput}
            sendMessage={handleSendMessage}
            isGenerating={currentIsGenerating}
          />
        </motion.div>

        {displayedSuggestions.length > 0 && (
          <motion.ul
            variants={containerVariants}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full"
          >
            {displayedSuggestions.map((s, index) => (
              <SuggestionCard
                key={s.title}
                icon={s.icon}
                title={s.title}
                description={s.description}
                onClick={() => handleSuggestionClick(s.description)}
                index={index}
                isDisabled={currentIsGenerating}
              />
            ))}
          </motion.ul>
        )}
      </motion.div>
      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 w-full px-4 flex flex-col items-center gap-1.5 sm:gap-2"
      >
        <TemporaryChatToggle />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-zinc-500 text-sm"
        >
          AI models can make mistakes. Verify all responses.
        </motion.p>
      </motion.footer>
    </motion.div>
  );
};

NewChatPage.displayName = "NewChatPage";
