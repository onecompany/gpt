import React from "react";
import clsx from "clsx";
import { ArrowLeft } from "@phosphor-icons/react";

interface SubHeaderProps {
  title: string;
  onBack: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const SubHeader: React.FC<SubHeaderProps> = ({
  title,
  onBack,
  children,
  className,
}) => {
  return (
    <div
      className={clsx(
        "h-12 px-5 flex items-center justify-between border-b border-zinc-750 shrink-0 bg-zinc-875 z-10",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-zinc-400 hover:text-zinc-200  focus:ring-0 transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={16} weight="bold" />
        </button>
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
      </div>

      {children && (
        <div className="shrink-0 ml-4 flex items-center gap-3">{children}</div>
      )}
    </div>
  );
};
