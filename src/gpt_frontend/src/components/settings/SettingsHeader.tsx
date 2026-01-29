import React from "react";
import { Dialog } from "@headlessui/react";
import { X } from "@phosphor-icons/react";
import clsx from "clsx";

interface SettingsHeaderProps {
  onClose: () => void;
}

const SettingsHeader: React.FC<SettingsHeaderProps> = ({ onClose }) => {
  return (
    <div
      className={clsx(
        "flex items-center justify-between border-b border-zinc-750 px-5 py-3",
        "bg-zinc-875", // Explicit background
        "rounded-t-xl", // Ensure rounded corners match modal if it sits at top
      )}
    >
      <Dialog.Title className="text-base font-semibold text-zinc-150">
        Settings
      </Dialog.Title>
      <button
        onClick={onClose}
        className="text-zinc-400 hover:text-zinc-200  cursor-pointer"
        aria-label="Close settings"
      >
        <X size={16} weight="bold" />
      </button>
    </div>
  );
};

export default SettingsHeader;
