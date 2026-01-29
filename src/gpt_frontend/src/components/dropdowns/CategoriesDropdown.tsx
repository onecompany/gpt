import React, { JSX, memo } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import clsx from "clsx";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/Dropdown";

interface Category {
  value: string;
  name: string;
  icon: JSX.Element;
}

interface CategoriesDropdownProps {
  selectedCategory: Category;
  setSelectedCategory: (category: Category) => void;
  categories: Category[];
}

export const CategoriesDropdown: React.FC<CategoriesDropdownProps> = memo(
  ({ selectedCategory, setSelectedCategory, categories }) => {
    return (
      <Dropdown as="div" className="relative inline-block text-left z-20">
        {({ open }) => (
          <>
            <DropdownTrigger
              className={clsx(
                "group flex w-full items-center gap-1.5 rounded-lg text-left text-sm font-normal cursor-pointer",
              )}
            >
              <span
                className={clsx(
                  "text-sm flex items-center",
                  open
                    ? "text-zinc-100"
                    : "text-zinc-400 group-hover:text-zinc-100",
                )}
              >
                {selectedCategory.name}
              </span>
              <CaretDown
                weight="bold"
                className={clsx(
                  open
                    ? "fill-zinc-100"
                    : "fill-zinc-400 group-hover:fill-zinc-100",
                )}
                size={16}
              />
            </DropdownTrigger>

            <DropdownContent align="start" width="min-w-[11rem] ml-[1px]">
              {categories.map((category) => (
                <DropdownItem
                  key={category.value}
                  onClick={() => setSelectedCategory(category)}
                >
                  {React.cloneElement(category.icon, {
                    className: "text-zinc-400 group-hover:text-zinc-200",
                  })}
                  <span className="ml-2.5">{category.name}</span>
                  {selectedCategory.value === category.value && (
                    <Check
                      weight="bold"
                      className="text-zinc-400 ml-auto mr-0.5"
                    />
                  )}
                </DropdownItem>
              ))}
            </DropdownContent>
          </>
        )}
      </Dropdown>
    );
  },
);

CategoriesDropdown.displayName = "CategoriesDropdown";
CategoriesDropdown.displayName = "CategoriesDropdown";
