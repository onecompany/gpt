"use client";

import React, { useContext, Suspense } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { FilesPageComponent } from "@/components/files/FilesPageComponent";
import { SidebarContext } from "@/components/sidebar";
import useMediaQuery from "@/hooks/useMediaQuery";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListIcon,
  NotePencilIcon,
  FolderIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { AvatarDropdown } from "@/components/dropdowns/AvatarDropdown";

const CenteredSpinner: React.FC = () => (
  <div className="flex grow items-center justify-center h-full">
    <CircleNotchIcon size={24} className="text-zinc-400 animate-spin" />
  </div>
);

export default function FilesPageClient() {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarContext);
  const router = useRouter();
  const { authStatus, logout } = useAuthStore();
  const isMediumOrLarger = useMediaQuery("(min-width: 768px)");

  const handleLogout = async () => {
    await logout();
  };

  const handleNewChat = () => {
    router.push("/");
  };

  const renderMainContent = () => {
    switch (authStatus) {
      case AuthStatus.REGISTERED:
        return <FilesPageComponent />;
      default:
        return <CenteredSpinner />;
    }
  };

  const showHeader = authStatus === AuthStatus.REGISTERED;

  return (
    <Suspense fallback={<CenteredSpinner />}>
      <div className="flex h-full min-h-0 flex-col bg-zinc-900 text-zinc-100 relative overflow-hidden">
        {showHeader && (
          <motion.header
            className="sticky top-0 z-20 w-full shrink-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            <div className="w-full px-2 lg:px-2.5 py-2 md:py-3 my-0 mx-0">
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(!isSidebarOpen || !isMediumOrLarger) && (
                    <>
                      <button
                        onClick={toggleSidebar}
                        className="flex items-center focus:outline-hidden p-1.5 rounded-lg transition text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        aria-label="Toggle Sidebar"
                      >
                        <ListIcon weight="regular" size={20} />
                      </button>
                      <button
                        onClick={handleNewChat}
                        className="flex items-center focus:outline-hidden p-1.5 rounded-lg transition text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        aria-label="New Chat"
                      >
                        <NotePencilIcon weight="regular" size={20} />
                      </button>
                    </>
                  )}
                  <div
                    className={clsx(
                      "flex items-center gap-2 rounded-lg py-1.5",
                      !isSidebarOpen || !isMediumOrLarger
                        ? "px-2"
                        : "pl-2 pr-2",
                    )}
                  >
                    <FolderIcon
                      weight="regular"
                      size={20}
                      className="text-zinc-400"
                    />
                    <span className="text-sm font-medium text-zinc-300">
                      Files
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AvatarDropdown handleLogout={handleLogout} />
                </div>
              </div>
            </div>
          </motion.header>
        )}

        <main className="flex-1 flex min-h-0 flex-col overflow-hidden relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={authStatus}
              className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
            >
              {renderMainContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </Suspense>
  );
}
