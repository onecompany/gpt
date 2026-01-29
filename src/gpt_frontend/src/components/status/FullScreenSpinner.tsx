import React from "react";
import { CircleNotch } from "@phosphor-icons/react";

interface FullScreenSpinnerProps {
  message: string;
}

export const FullScreenSpinner: React.FC<FullScreenSpinnerProps> = ({
  message,
}) => (
  <div
    className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-900 z-50 text-center p-4"
    role="status"
    aria-live="polite"
  >
    <CircleNotch size={24} className="text-zinc-400 animate-spin mb-3" />
    <p className="text-base text-zinc-300 font-medium">{message}</p>
  </div>
);
