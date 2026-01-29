import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useAuthStore, AuthStatus } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { SidebarContent, SidebarContext } from "@/components/sidebar";
import { useChatUrlSync } from "@/hooks/useChatUrlSync";
import { useWebSocketReconnection } from "@/hooks/useWebSocketReconnection";

export function Application({ children }: { children: React.ReactNode }) {
  const isMediumOrLarger = useMediaQuery("(min-width: 768px)");
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  const authStatus = useAuthStore((state) => state.authStatus);
  const resetChat = useChatStore((state) => state.resetChat);
  const setCurrentChatId = useChatStore((state) => state.setCurrentChatId);

  useChatUrlSync();
  useWebSocketReconnection();

  const showAuthenticatedUI =
    authStatus === AuthStatus.PENDING_SETUP ||
    authStatus === AuthStatus.REGISTERED;

  useEffect(() => {
    if (
      authStatus === AuthStatus.UNAUTHENTICATED ||
      authStatus === AuthStatus.SETUP_ERROR
    ) {
      resetChat();
      if (pathname !== "/") {
        router.push("/");
      }
    }
  }, [authStatus, resetChat, router, pathname]);

  useEffect(() => {
    if (pathname !== "/") {
      setCurrentChatId(null);
    }
  }, [pathname, setCurrentChatId]);

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar }}>
      <div className="relative flex h-full w-full min-h-0">
        {showAuthenticatedUI && (
          <>
            {isMediumOrLarger ? (
              <motion.div
                initial={{ width: "0rem", opacity: 0 }}
                animate={{
                  width: isSidebarOpen ? "16rem" : "0rem",
                  opacity: isSidebarOpen ? 1 : 0,
                }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="relative h-full overflow-hidden shrink-0"
              >
                <div className="absolute top-0 left-0 w-64 h-full">
                  <SidebarContent />
                </div>
              </motion.div>
            ) : (
              <>
                {isSidebarOpen && (
                  <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={() => setIsSidebarOpen(false)}
                  />
                )}
                <div
                  className={clsx(
                    "fixed top-0 left-0 z-50 h-full w-64 bg-black transform transition-transform duration-300 ease-in-out",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full",
                  )}
                >
                  <SidebarContent />
                </div>
              </>
            )}
          </>
        )}

        <main className="flex-1 flex min-h-0 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
