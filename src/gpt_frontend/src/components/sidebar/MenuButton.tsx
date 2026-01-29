import Link from "next/link";
import clsx from "clsx";
import React, { ReactElement } from "react";

interface MenuButtonProps {
  href: string;
  icon: React.ReactElement;
  label: string;
  isActive?: boolean;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function MenuButton({
  href,
  icon,
  label,
  isActive,
  onClick,
}: MenuButtonProps) {
  // Safe cloning to inject className for state-based styling
  const clonedIcon = React.cloneElement(
    icon as ReactElement<{ className?: string }>,
    {
      className: clsx(
        "transition-colors duration-200",
        isActive ? "fill-zinc-200" : "fill-zinc-400 group-hover:fill-zinc-200",
      ),
    },
  );

  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        "flex text-sm rounded-lg px-1.75 py-2 transition-all duration-200",
        "items-center group space-x-3 outline-none focus-visible:outline-none focus-visible:ring-0",
        isActive
          ? "bg-zinc-875 text-zinc-50 font-medium"
          : "text-zinc-200 hover:bg-zinc-875 hover:text-zinc-50",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {clonedIcon}
      <span>{label}</span>
    </Link>
  );
}
