import React from "react";
import {
  WarningCircle,
  Barricade,
  SignOut,
  ArrowClockwise,
} from "@phosphor-icons/react";
import { CRITICAL_INIT_ERROR_MSG } from "@/store/authStore";
import clsx from "clsx";

interface FullScreenErrorProps {
  message: string;
  title?: string;
  isFatal?: boolean;
  onRetry?: () => void;
  onLogout?: () => void;
}

export const FullScreenError: React.FC<FullScreenErrorProps> = ({
  message,
  title,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isFatal = false,
  onRetry,
  onLogout,
}) => {
  const isCriticalInitError = message === CRITICAL_INIT_ERROR_MSG;

  // Heuristic for styling if title not explicit
  const isMaintenance =
    (title &&
      (title.includes("Unavailable") || title.includes("Maintenance"))) ||
    message.includes("maintenance") ||
    message.includes("backend");

  const displayMessage = isCriticalInitError
    ? "Application initialization failed. Please refresh the page. If the issue persists, please contact support."
    : message || "An unknown error occurred.";

  const displayTitle =
    title || (isMaintenance ? "Service Unavailable" : "Connection Error");

  // Show retry if it's NOT a critical init error
  const showRetryButton = onRetry && !isCriticalInitError;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-900 z-50 text-center p-4"
      role="alert"
      aria-live="assertive"
    >
      <div
        className={clsx(
          "p-4 rounded-full mb-6 ring-1",
          isMaintenance
            ? "bg-amber-900/10 ring-amber-500/20 text-amber-500"
            : "bg-red-500/10 ring-red-500/20 text-red-500",
        )}
      >
        {isMaintenance ? (
          <Barricade size={40} weight="duotone" />
        ) : (
          <WarningCircle size={40} weight="duotone" />
        )}
      </div>

      <h2 className="text-lg text-zinc-100 font-medium mb-2">{displayTitle}</h2>

      <p className="text-sm text-zinc-400 mb-3 max-w-lg mx-auto leading-relaxed text-balance">
        {displayMessage}
      </p>

      <div className="flex items-center justify-center gap-4 w-full max-w-xs">
        {showRetryButton && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors "
            aria-label="Retry operation"
          >
            <ArrowClockwise size={16} weight="bold" />
            <span>Try Again</span>
          </button>
        )}

        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors "
            aria-label="Sign out"
          >
            <SignOut size={16} weight="bold" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </div>
  );
};
