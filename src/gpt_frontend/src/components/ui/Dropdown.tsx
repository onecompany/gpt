import React, { Fragment, ReactNode } from "react";
import { Menu, Transition } from "@headlessui/react";
import clsx from "clsx";

/**
 * Shared transition definition for all dropdowns to ensure consistent animation.
 */
export const DropdownTransition = ({ children }: { children: ReactNode }) => (
  <Transition
    as={Fragment}
    enter="transition ease-out duration-100"
    enterFrom="transform opacity-0 scale-95"
    enterTo="transform opacity-100 scale-100"
    leave="transition ease-in duration-75"
    leaveFrom="transform opacity-100 scale-100"
    leaveTo="transform opacity-0 scale-95"
  >
    {children}
  </Transition>
);

export const Dropdown = Menu;

export const DropdownTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Menu.Button> & { className?: string }
>(({ className, children, ...props }, ref) => (
  <Menu.Button
    ref={ref}
    className={({ open }: { open: boolean }) =>
      clsx(
        " focus-visible:outline-none focus-visible:ring-0",
        open && "text-zinc-200",
        !open && "hover:text-zinc-200",
        className,
      )
    }
    {...props}
  >
    {children}
  </Menu.Button>
));
DropdownTrigger.displayName = "DropdownTrigger";

export const DropdownContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Menu.Items> & {
    align?: "start" | "end" | "left" | "right";
    width?: string;
    className?: string;
  }
>(
  (
    { className, align = "start", width = "min-w-[10rem]", children, ...props },
    ref,
  ) => {
    // Logic to handle alignment classes
    const alignmentClass =
      align === "end" || align === "right"
        ? "origin-top-right right-0"
        : "origin-top-left left-0";

    return (
      <DropdownTransition>
        <Menu.Items
          ref={ref}
          className={clsx(
            "absolute mt-2 z-50",
            width,
            alignmentClass,
            "bg-zinc-825 ring-0 rounded-xl p-1 shadow-sm overflow-y-auto",
            className,
          )}
          {...props}
        >
          {children}
        </Menu.Items>
      </DropdownTransition>
    );
  },
);
DropdownContent.displayName = "DropdownContent";

export const DropdownItem = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    activeClassName?: string;
    inactiveClassName?: string;
    disabled?: boolean;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    children:
      | ReactNode
      | ((bag: { active: boolean; disabled: boolean }) => ReactNode);
  }
>(
  (
    {
      className,
      activeClassName,
      inactiveClassName,
      disabled,
      children,
      onClick,
      ...props
    },
    ref,
  ) => {
    return (
      <Menu.Item disabled={disabled}>
        {({ active, disabled: itemDisabled }) => {
          const resolvedChildren =
            typeof children === "function"
              ? children({ active, disabled: itemDisabled })
              : children;

          return (
            <button
              ref={ref}
              onClick={onClick}
              disabled={itemDisabled}
              className={clsx(
                "group flex w-full items-center px-2 py-1.5 rounded-lg text-sm  focus:ring-0",
                itemDisabled ? "opacity-50 " : "cursor-pointer",
                active && !itemDisabled
                  ? activeClassName || "bg-zinc-750 text-zinc-50"
                  : inactiveClassName || "text-zinc-200",
                className,
              )}
              {...props}
            >
              {resolvedChildren}
            </button>
          );
        }}
      </Menu.Item>
    );
  },
);
DropdownItem.displayName = "DropdownItem";

export const DropdownCustomItem = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => <div className={clsx("px-2 py-1.5", className)}>{children}</div>;

export const DropdownLabel = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={clsx(
      "px-2 py-1.5 text-xs font-medium text-zinc-400 select-none uppercase tracking-wider",
      className,
    )}
  >
    {children}
  </div>
);

export const DropdownSeparator = ({ className }: { className?: string }) => (
  <div className={clsx("my-1 h-px bg-zinc-700/50", className)} />
);
