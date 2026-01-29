"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import Providers from "./providers";
import { Application } from "./application";

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Application>{children}</Application>

      <Toaster
        position="bottom-right"
        visibleToasts={3}
        duration={7000}
        expand={false}
        gap={10}
        closeButton
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "group flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 shadow-lg w-full max-w-sm",
            content: "flex-1 min-w-0",
            title: "text-sm font-medium text-zinc-300 truncate",
            description: "text-xs text-zinc-400 leading-4 mt-0.5 line-clamp-1",
            icon: "hidden",
            // subtle variants (still zinc-forward)
            success: "!border-zinc-700",
            info: "!border-zinc-700",
            warning: "!border-zinc-700",
            error: "!border-zinc-700",
            loading: "!border-zinc-700",
            closeButton:
              "text-zinc-400 hover:text-zinc-200 transition-colors pl-0.5 py-1 ",
            actionButton:
              "bg-zinc-100 text-zinc-900 hover:bg-white transition-colors rounded-md px-2 py-1 text-xs",
            cancelButton:
              "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-colors rounded-md px-2 py-1 text-xs",
            loader: "",
            default: "",
          },
        }}
      />
    </Providers>
  );
}
