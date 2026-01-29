import React, { memo } from "react";
import { GraduationCap } from "@phosphor-icons/react";

interface MessageHeaderProps {
  modelName: string | undefined;
}

export const MessageHeader: React.FC<MessageHeaderProps> = memo(({ modelName }) => {
  return (
    <div className="flex items-center gap-2.5">
      <span className="bg-zinc-925 ring-[1px] ring-zinc-700 rounded-full p-1">
        <GraduationCap weight="regular" size={14} className="fill-zinc-300" />
      </span>
      <div className="flex items-center space-x-2 text-[0.9375rem]">
        <p className="font-normal text-zinc-300">Educator</p>
        {modelName && (
          <button className="gap-1 text-zinc-400 hover:text-zinc-300 flex items-center">
            {modelName}
          </button>
        )}
      </div>
    </div>
  );
});

MessageHeader.displayName = "MessageHeader";
MessageHeader.displayName = "MessageHeader";
