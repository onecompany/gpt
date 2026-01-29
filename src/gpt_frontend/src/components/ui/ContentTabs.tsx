import React from "react";
import clsx from "clsx";

export interface TabOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface ContentTabsProps<T extends string> {
  tabs: TabOption<T>[];
  activeTab: T;
  onTabChange: (value: T) => void;
  children?: React.ReactNode;
  className?: string;
}

export const ContentTabs = <T extends string>({
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
}: ContentTabsProps<T>) => {
  return (
    <div
      className={clsx(
        // Changed to solid bg-zinc-875 to match sidebar/header theme
        // Removed backdrop-blur-sm since it's now opaque
        "h-12 px-5 flex items-center justify-between border-b border-zinc-750 shrink-0 bg-zinc-875 z-10",
        className,
      )}
    >
      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar mask-linear-fade">
        <div className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => !tab.disabled && onTabChange(tab.value)}
              disabled={tab.disabled}
              className={clsx(
                "text-sm font-medium whitespace-nowrap  focus-visible:outline-none focus-visible:ring-0 rounded-sm transition-colors",
                activeTab === tab.value
                  ? "text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-50",
                tab.disabled
                  ? "text-zinc-600  hover:text-zinc-600"
                  : "cursor-pointer",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {children && (
        <div className="shrink-0 ml-4 flex items-center gap-3">{children}</div>
      )}
    </div>
  );
};
