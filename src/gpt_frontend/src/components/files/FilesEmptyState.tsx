import React from "react";
import { motion } from "framer-motion";
import { Sparkle } from "@phosphor-icons/react";

interface FilesEmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actions?: React.ReactNode;
}

export const FilesEmptyState: React.FC<FilesEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actions,
}) => {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-[60vh] text-center relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Background Ambience */}
      <div className="hidden sm:block absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
          <motion.div
            className="absolute inset-0 bg-linear-to-br from-zinc-800/20 via-zinc-700/20 to-zinc-800/20 blur-3xl rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>
      </div>

      {/* Floating Icon Container */}
      <motion.div
        className="relative z-10"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <motion.div
          className="p-5 rounded-2xl bg-linear-to-br from-zinc-800/50 to-zinc-800/30 backdrop-blur-sm mb-4 border border-zinc-700/30 shadow-lg"
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Icon size={48} weight="duotone" className="text-zinc-500" />
        </motion.div>

        {/* Decorative Sparkle */}
        <motion.div
          className="absolute -top-6 -right-6"
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Sparkle size={20} weight="fill" className="text-zinc-600/50" />
        </motion.div>
      </motion.div>

      {/* Text Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 flex flex-col items-center"
      >
        <h3 className="text-lg font-medium text-zinc-200 mb-2">{title}</h3>
        <p className="text-sm text-zinc-400 mb-6 max-w-sm leading-relaxed">
          {description}
        </p>

        {/* Actions */}
        {actions && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="flex items-center gap-3 [&>button]: [&>button]:focus:ring-0"
          >
            {actions}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};
