import React, { forwardRef } from "react";
import { motion, MotionProps, Variants } from "framer-motion";
import clsx from "clsx";

const OFFSET = 4;

// Exact replica of original NodeTab variants for drill-down (Wizard/Forms)
const slideVariants: Variants = {
  initial: (direction: number) => ({
    x: direction > 0 ? OFFSET : -OFFSET,
    opacity: 0.6,
  }),
  animate: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -OFFSET : OFFSET,
    opacity: 0,
  }),
};

// Pure opacity fade for tab switching (Sub-tabs)
// Matches original NodeTab list view transition exactly (no scale)
const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

interface TransitionPanelProps extends Omit<MotionProps, "children"> {
  children: React.ReactNode;
  /**
   * 'slide' for directional navigation (drill-down).
   * 'fade' for peer switching (tabs).
   */
  variant?: "slide" | "fade";
  /**
   * 1 for forward/right (drill-down), -1 for backward/left (back).
   * Used by slide variant.
   */
  direction?: number;
  className?: string;
}

export const TransitionPanel = forwardRef<HTMLDivElement, TransitionPanelProps>(
  (
    { children, variant = "slide", direction = 1, className, ...props },
    ref,
  ) => {
    // Original NodeTab used 0.15s for slides and 0.2s for fades
    const duration = variant === "slide" ? 0.15 : 0.2;

    return (
      <motion.div
        ref={ref}
        custom={direction}
        variants={variant === "slide" ? slideVariants : fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration, ease: "easeInOut" }}
        className={clsx("w-full h-full", className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);

TransitionPanel.displayName = "TransitionPanel";
