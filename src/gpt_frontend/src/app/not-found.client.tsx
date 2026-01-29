"use client";

import React from "react";
import Link from "next/link";
import { House } from "@phosphor-icons/react";

export default function NotFoundClient() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <h1 className="text-4xl font-medium text-zinc-100 mb-2">
        404 - Page Not Found
      </h1>
      <p className="text-zinc-400 mb-8 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors font-medium  focus:ring-0"
      >
        <House weight="bold" size={20} />
        <span>Return Home</span>
      </Link>
    </div>
  );
}
