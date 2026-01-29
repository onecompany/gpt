import React, { memo } from "react";
import clsx from "clsx";
import { Toolbox, Globe, Files, Check, CaretDown } from "@phosphor-icons/react";
import { useChatStore } from "@/store/chatStore/index";
import { availableTools } from "@/constants/constants";
import { Tool } from "@/types";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
} from "@/components/ui/Dropdown";

const toolIcons: Record<string, React.ElementType> = {
  web_search: Globe,
  files_search: Files,
};

export const ToolsDropdown: React.FC = memo(() => {
  const selectedTools = useChatStore((state) => state.selectedTools);
  const toggleTool = useChatStore((state) => state.toggleTool);
  const selectedModel = useChatStore((state) => state.selectedModel);

  const maxTools = selectedModel?.max_tools ?? 0;
  const isDisabled = maxTools === 0;
  const atLimit = selectedTools.length >= maxTools;
  const selectedCount = selectedTools.length;

  const isToolSelected = (tool: Tool) =>
    selectedTools.some((t) => t.name === tool.name);

  return (
    <Dropdown as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <DropdownTrigger
            disabled={isDisabled}
            className={clsx(
              "group flex items-center gap-1 rounded-md py-1.5 text-sm cursor-pointer",
              isDisabled && "opacity-40 cursor-not-allowed",
            )}
          >
            <Toolbox
              weight="regular"
              size={20}
              className={clsx(
                isDisabled
                  ? "text-zinc-500"
                  : open
                    ? "text-zinc-200"
                    : "text-zinc-400 group-hover:text-zinc-200",
              )}
            />
            {selectedCount > 0 && !isDisabled && (
              <span
                className={clsx(
                  "text-xs",
                  open
                    ? "text-zinc-200"
                    : "text-zinc-400 group-hover:text-zinc-200",
                )}
              >
                {selectedCount}
              </span>
            )}
            <CaretDown
              weight="bold"
              size={12}
              className={clsx(
                isDisabled
                  ? "fill-zinc-500"
                  : open
                    ? "fill-zinc-200"
                    : "fill-zinc-400 group-hover:fill-zinc-200",
              )}
            />
          </DropdownTrigger>

          <DropdownContent align="end" width="min-w-[11rem]">
            {availableTools.map((tool) => {
              const selected = isToolSelected(tool);
              const itemDisabled = isDisabled || (atLimit && !selected);
              const Icon = toolIcons[tool.name] || Toolbox;

              return (
                <button
                  key={tool.name}
                  disabled={itemDisabled}
                  onClick={() => toggleTool(tool)}
                  className={clsx(
                    "group flex w-full items-center px-2 py-1.5 rounded-lg text-sm focus:ring-0 focus:outline-none",
                    itemDisabled
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer hover:bg-zinc-750 text-zinc-200",
                  )}
                >
                  <Icon
                    size={20}
                    weight="regular"
                    className="text-zinc-400 group-hover:text-zinc-200"
                  />
                  <span className="ml-2.5">
                    {tool.displayName || tool.name}
                  </span>
                  {selected && (
                    <Check
                      weight="bold"
                      className="text-zinc-400 ml-auto mr-0.5"
                    />
                  )}
                </button>
              );
            })}
          </DropdownContent>
        </>
      )}
    </Dropdown>
  );
});

ToolsDropdown.displayName = "ToolsDropdown";
