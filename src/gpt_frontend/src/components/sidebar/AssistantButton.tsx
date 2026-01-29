import clsx from "clsx";
import React from "react";

interface AssistantButtonProps {
  icon: React.ReactElement;
  label: string;
  onClick: () => void;
}

export function AssistantButton({
  icon,
  label,
  onClick,
}: AssistantButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full text-sm hover:bg-zinc-875 rounded-lg px-[0.40625rem] py-2",
        "items-center space-x-2.75 group transition-colors duration-200",
        "hover:text-zinc-50 text-zinc-200 outline-none focus-visible:outline-none focus-visible:ring-0",
        "cursor-pointer",
      )}
      aria-label={`Select ${label} assistant`}
    >
      <span className="bg-zinc-925 ring-[1px] ring-zinc-700 group-hover:ring-zinc-650 rounded-full p-1 transition-all duration-200 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="font-medium text-left truncate">{label}</span>
    </button>
  );
}
