import React from "react";
import clsx from "clsx";
import { tabItems, TabKey } from "./SettingsTypes";

interface SettingsSidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="shrink-0 w-1/6 border-r border-zinc-750">
      <nav className="flex flex-col space-y-4 px-5 py-4">
        {tabItems.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={clsx(
              "flex items-center gap-2 rounded-md text-left text-sm font-medium transition cursor-pointer",
              activeTab === key
                ? "text-zinc-50"
                : "text-zinc-400 hover:text-zinc-50",
            )}
          >
            <Icon size={18} weight="regular" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default SettingsSidebar;
