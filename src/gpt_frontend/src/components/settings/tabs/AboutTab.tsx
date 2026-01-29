import React from "react";
import { GithubLogo, XLogo } from "@phosphor-icons/react";

const AboutTab: React.FC = () => {
  const buildDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="px-5 py-4 space-y-6">
      <div>
        <h4 className="text-sm font-medium text-zinc-100 mb-2">
          About GPT Protocol
        </h4>
        <p className="text-sm text-zinc-400 leading-relaxed">
          GPT Protocol provides decentralized, verifiable, and private access to
          powerful AI models. By combining confidential computing with on-chain
          logic, we enable secure AI inference where user data remains encrypted
          and is never used for training. Our goal is to build a user-owned AI
          network that is resilient, transparent, and aligned with user
          incentives.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-400">Version</span>
          <span className="text-zinc-200">0.1.0-alpha</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-400">Build Date</span>
          <span className="text-zinc-200">{buildDate}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-400">Build Hash</span>
          <span className="text-zinc-200">a1b2c3d</span>
        </div>
      </div>

      <div className="border-t border-zinc-750 pt-4">
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/onecompany/gpt"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <GithubLogo size={18} />
            <span>GitHub</span>
          </a>
          <a
            href="https://x.com/gpticp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <XLogo size={18} />
            <span>Follow on X</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default AboutTab;
