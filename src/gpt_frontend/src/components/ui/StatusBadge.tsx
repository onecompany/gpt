import React from "react";
import clsx from "clsx";

export type StatusType =
  | "Online"
  | "Offline"
  | "Active"
  | "Paused"
  | "Deprecated"
  | "Revoked";

interface StatusBadgeProps {
  status: string | StatusType;
  showLabel?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showLabel = false,
  className,
}) => {
  // Normalize input status case for matching
  const normalizedStatus = status;

  if (showLabel) {
    // Pill Style (Governance / Admin Views)
    // Design: Monochromatic.
    // Active = Bright White/Zinc-100 (High vis)
    // Paused/Deprecated = Mid Grey (Medium vis)
    // Offline/Revoked = Dark/Dim (Low vis, receded)

    let badgeClass = "bg-zinc-800 text-zinc-400 border border-zinc-700"; // Default

    if (normalizedStatus === "Active" || normalizedStatus === "Online") {
      // High contrast "On" state
      badgeClass =
        "bg-zinc-300 text-zinc-900 border border-zinc-200 font-medium";
    } else if (normalizedStatus === "Deprecated") {
      badgeClass = "bg-zinc-800 text-zinc-300 border border-zinc-600";
    } else if (
      normalizedStatus === "Revoked" ||
      normalizedStatus === "Offline"
    ) {
      badgeClass = "bg-zinc-900 text-zinc-500 border border-zinc-800";
    } else if (normalizedStatus === "Paused") {
      badgeClass = "bg-zinc-800 text-zinc-400 border border-zinc-700/50";
    }

    return (
      <span
        className={clsx(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs",
          badgeClass,
          className,
        )}
      >
        {status}
      </span>
    );
  } else {
    // Dot Style (Node List View)
    let dotClass = "bg-zinc-600 ring-zinc-700"; // Default (Offline/Unknown)

    if (normalizedStatus === "Online" || normalizedStatus === "Active") {
      // Bright white dot for active
      dotClass =
        "bg-zinc-300 ring-zinc-400 shadow-[0_0_4px_rgba(255,255,255,0.4)]";
    } else if (normalizedStatus === "Paused") {
      // Hollow or dimmer dot
      dotClass = "bg-zinc-500 ring-zinc-600";
    }

    return (
      <div className={clsx("flex items-center justify-center w-5", className)}>
        <span
          className={clsx(
            "inline-block w-1.5 h-1.5 rounded-full ring-1",
            dotClass,
          )}
          title={String(status)}
        />
      </div>
    );
  }
};
