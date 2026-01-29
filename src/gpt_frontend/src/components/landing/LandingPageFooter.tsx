import React from "react";
import { GithubLogo, XLogo } from "@phosphor-icons/react";

export const LandingPageFooter: React.FC = () => {
  return (
    <footer className="w-full py-12 border-t border-zinc-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex justify-center gap-x-6 mb-4">
            <a
              href="https://github.com/onecompany/gpt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 focus:ring-0 cursor-pointer"
            >
              <GithubLogo size={24} />
            </a>
            <a
              href="https://x.com/gpticp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 focus:ring-0 cursor-pointer"
            >
              <XLogo size={24} />
            </a>
          </div>
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} GPT Protocol. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
