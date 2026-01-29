import React, { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";

export const MarkdownImage = ({
  src,
  alt,
  ...props
}: {
  src?: string;
  alt?: string;
  [key: string]: unknown;
}) => {
  const [error, setError] = useState(false);

  if (!src) {
    return (
      <div className="my-4 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 text-center text-zinc-400 text-sm flex items-center justify-center gap-2">
        <WarningCircle size={16} />
        <span>Image source missing</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-4 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 text-center text-zinc-400 text-sm flex items-center justify-center gap-2">
        <WarningCircle size={16} className="text-red-400" />
        <span>Failed to load image</span>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt || "Content image"}
      loading="lazy"
      className="my-4 max-w-full rounded-lg border border-zinc-700/50 shadow-sm"
      onError={() => setError(true)}
      {...props}
    />
  );
};
