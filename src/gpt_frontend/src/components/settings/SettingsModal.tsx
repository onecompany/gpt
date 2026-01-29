import React, { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import useMediaQuery from "@/hooks/useMediaQuery";
import { tabItems, TabKey } from "./SettingsTypes";
import SettingsHeader from "./SettingsHeader";
import SettingsSidebar from "./SettingsSidebar";
import SettingsContent from "./SettingsContent";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const [internalOpen, setInternalOpen] = useState(open);
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const isMobile = useMediaQuery("(max-width: 640px)");

  const tabVariants = {
    initial: { x: -4, opacity: 0.6 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 4, opacity: 0 },
  };

  useEffect(() => {
    setInternalOpen(open);
  }, [open]);

  const handleClose = () => {
    setInternalOpen(false);
    setTimeout(() => onClose(), 200);
  };

  const handleTabChange = (newTab: TabKey) => {
    setActiveTab(newTab);
  };

  return (
    <AnimatePresence>
      {internalOpen && (
        <Dialog
          open={internalOpen}
          onClose={handleClose}
          static
          className="relative z-50"
        >
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "tween", ease: "linear", duration: 0.2 }}
            className="fixed inset-0 bg-black/25"
            onClick={handleClose}
          />
          <div
            className="fixed inset-0 flex items-center justify-center overflow-hidden"
            onClick={handleClose}
          >
            <motion.div
              key="panel"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: "tween", ease: "linear", duration: 0.2 }}
              className={clsx(
                isMobile
                  ? "w-full h-full rounded-none"
                  : "w-full max-w-6xl rounded-xl flex flex-col",
                "bg-zinc-875 shadow-sm ring-1 ring-zinc-800",
              )}
            >
              <SettingsHeader onClose={handleClose} />
              {isMobile ? (
                <div className="flex flex-col h-full min-h-0">
                  {/* Mobile Tab Bar - kept as zinc-875 (inherited from modal bg) */}
                  <div className="shrink-0 overflow-x-auto border-b border-zinc-750 py-3 px-5 bg-zinc-875">
                    <div className="flex space-x-4">
                      {tabItems.map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => handleTabChange(key)}
                          className={clsx(
                            "text-sm font-medium whitespace-nowrap",
                            activeTab === key
                              ? "text-zinc-50"
                              : "text-zinc-400 hover:text-zinc-50",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        variants={tabVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.15, ease: "easeInOut" }}
                        className="absolute inset-0"
                      >
                        <SettingsContent activeTab={activeTab} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 h-full min-h-0">
                  <SettingsSidebar
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                  />
                  <div className="relative w-4/5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-br-xl">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        variants={tabVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.15, ease: "easeInOut" }}
                        className="absolute inset-0"
                      >
                        <SettingsContent activeTab={activeTab} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

SettingsModal.displayName = "SettingsModal";
