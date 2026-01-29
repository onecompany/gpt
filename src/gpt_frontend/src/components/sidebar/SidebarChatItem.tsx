import * as Headless from "@headlessui/react";
import clsx from "clsx";
import React, { Fragment, forwardRef } from "react";
import { Link } from "@/components/ui";

// Increases effective touch target size for mobile ease of use
export function TouchTarget({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span
        className="absolute left-1/2 top-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 pointer-fine:hidden"
        aria-hidden="true"
      />
      {children}
    </>
  );
}

export const SidebarChatItem = forwardRef(function SidebarChatItem(
  {
    current,
    className,
    children,
    ...props
  }: {
    current?: boolean;
    className?: string;
    children: React.ReactNode;
  } & (
    | Omit<Headless.ButtonProps, "className">
    | Omit<React.ComponentPropsWithoutRef<typeof Link>, "type" | "className">
  ),
  ref: React.ForwardedRef<HTMLAnchorElement | HTMLButtonElement>,
) {
  const classes = clsx(
    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left font-normal text-sm ",
    "outline-none focus-visible:outline-none focus-visible:ring-0",
    // Current state (Active)
    current
      ? "bg-zinc-800 text-zinc-100 shadow-sm"
      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",

    className,
  );

  const inner = <TouchTarget>{children}</TouchTarget>;

  if ("href" in props) {
    return (
      <Headless.CloseButton as={Fragment} ref={ref}>
        <Link
          className={classes}
          {...props}
          aria-current={current ? "page" : undefined}
        >
          {inner}
        </Link>
      </Headless.CloseButton>
    );
  }

  return (
    <Headless.Button
      {...props}
      className={clsx("cursor-default", classes)}
      ref={ref}
      aria-current={current ? "true" : undefined}
    >
      {inner}
    </Headless.Button>
  );
});
