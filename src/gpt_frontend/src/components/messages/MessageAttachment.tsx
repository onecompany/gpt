import React, { useRef, useState, useEffect } from "react";
import clsx from "clsx";
import { ImageAttachment } from "@/types";
import { formatFileSize } from "@/utils/fileUtils";
import { dataToSrc } from "@/utils/messageUtils";

const useImageLuminance = (src: string | null) => {
  const [backgroundClass, setBackgroundClass] = useState("bg-zinc-800");

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = src;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 10, 10);
      const data = ctx.getImageData(0, 0, 10, 10).data;
      let totalLuminance = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        totalLuminance +=
          0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
      const avgLuminance = totalLuminance / (data.length / 4);
      if (avgLuminance < 128) {
        setBackgroundClass("bg-zinc-200");
      } else {
        setBackgroundClass("bg-zinc-800");
      }
    };
    img.onerror = () => setBackgroundClass("bg-zinc-800");
  }, [src]);

  return { backgroundClass };
};

const MessageAttachmentCard: React.FC<{
  attachment: ImageAttachment;
  index: number;
}> = ({ attachment, index }) => {
  const src = dataToSrc(attachment.mime_type, attachment.data);
  const size = formatFileSize(attachment.data.length);
  const name = `Image ${index + 1}`;
  const { backgroundClass } = useImageLuminance(src);

  return (
    <div
      className={clsx(
        "relative h-24 w-32 shrink-0 rounded-lg border border-zinc-700 overflow-hidden group",
        backgroundClass,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        className="absolute inset-0 h-full w-full object-contain p-1"
      />
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-linear-to-t from-black/60 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-1.5">
        <p className="text-xs font-medium text-zinc-100 truncate" title={name}>
          {name}
        </p>
        <p className="text-xs text-zinc-400">{size}</p>
      </div>
    </div>
  );
};

export const MessageAttachment: React.FC<{
  attachments: ImageAttachment[] | undefined;
  className?: string;
}> = ({ attachments, className }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !attachments || attachments.length === 0) return;

    const updateFadeIndicators = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftFade(scrollLeft > 1);
      setShowRightFade(Math.round(scrollLeft + clientWidth) < scrollWidth - 1);
    };

    updateFadeIndicators();
    container.addEventListener("scroll", updateFadeIndicators, {
      passive: true,
    });
    const resizeObserver = new ResizeObserver(updateFadeIndicators);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", updateFadeIndicators);
      resizeObserver.disconnect();
    };
  }, [attachments]);

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className={clsx("relative max-w-160", className)}>
      <div
        className={clsx(
          "absolute left-0 top-0 h-full w-8 bg-linear-to-r from-zinc-800 to-transparent pointer-events-none z-10 transition-opacity duration-200",
          showLeftFade ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={clsx(
          "absolute right-0 top-0 h-full w-8 bg-linear-to-l from-zinc-800 to-transparent pointer-events-none z-10 transition-opacity duration-200",
          showRightFade ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-hidden "
      >
        <div className="flex gap-2 py-1">
          {attachments.map((att, index) => (
            <MessageAttachmentCard key={index} attachment={att} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
};

MessageAttachment.displayName = "MessageAttachment";
