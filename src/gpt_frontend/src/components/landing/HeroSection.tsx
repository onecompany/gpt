import React from "react";
import { motion, Variants } from "framer-motion";
import {
  CaretRight,
  GithubLogo,
  XLogo,
  ShieldCheck,
  Globe,
  Wallet,
  Prohibit,
  CheckCircle,
  Lock,
} from "@phosphor-icons/react";
import { GlowCard, Iridescence } from "./effects";

interface HeroSectionProps {
  handleLogin: () => Promise<void>;
}

type PillTone = "ink" | "glass";

const Pill: React.FC<{
  icon?: React.ReactNode;
  label: string;
  tone?: PillTone;
}> = ({ icon, label, tone = "glass" }) => {
  const base =
    "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs leading-none";
  const ink =
    "bg-zinc-900/80 text-zinc-100 border border-zinc-800 backdrop-blur-sm hover:border-zinc-700";
  const glass =
    "bg-zinc-900/40 text-zinc-200 border border-zinc-800 backdrop-blur-md hover:border-zinc-700";
  return (
    <span className={`${base} ${tone === "ink" ? ink : glass}`}>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{label}</span>
    </span>
  );
};

const AppPreview: React.FC = () => (
  <GlowCard className="relative rounded-2xl border border-zinc-800 bg-zinc-900 backdrop-blur-sm px-5 py-4 overflow-hidden">
    {/* subtle glow */}
    <div
      className="absolute inset-0 -z-10 opacity-[.10]"
      style={{
        background:
          "radial-gradient(700px circle at 75% -10%, rgba(255,255,255,.14), transparent 55%)",
      }}
    />

    {/* window dots + trust chips */}
    <div className="flex items-center gap-2 mb-3">
      <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
      <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
      <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
      <div className="ml-auto flex items-center gap-3 text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <CheckCircle size={12} className="text-zinc-300" />
          Attestation verified
        </span>
        <span className="text-zinc-600">•</span>
        <span className="inline-flex items-center gap-1">
          <Lock size={12} className="text-zinc-300" />
          E2E encrypted
        </span>
        <span className="text-zinc-600">•</span>
        <span className="inline-flex items-center gap-1">
          <Prohibit size={12} className="text-zinc-300" />
          No training
        </span>
      </div>
    </div>

    {/* proof strip */}
    <div className="rounded-lg border border-zinc-750 bg-zinc-900 px-3 py-2 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-zinc-300">
        <ShieldCheck size={14} />
        <span>Private session</span>
        <span className="text-zinc-600">•</span>
        <span className="text-zinc-400">Measurement: 8e93…47c1</span>
      </div>
      <div className="text-xs text-zinc-400">Verified on-chain</div>
    </div>

    {/* conversation preview — 3 clear, newcomer-friendly pairs */}
    <div className="space-y-3 text-sm">
      {/* Pair 1 */}
      <div className="max-w-fit rounded-xl bg-zinc-825 border border-zinc-750 px-3 py-2 text-zinc-300">
        Is my data private here?
      </div>
      <div className="max-w-[92%] ml-auto rounded-xl bg-white text-zinc-900 px-3 py-2 shadow-sm">
        Yes. Your request is encrypted on your device, processed inside a
        verified secure enclave, and only your browser can decrypt the reply.
      </div>

      {/* Pair 2 */}
      <div className="max-w-fit rounded-xl bg-zinc-825 border border-zinc-750 px-3 py-2 text-zinc-300">
        Can I verify that claim?
      </div>
      <div className="max-w-[90%] ml-auto rounded-xl bg-white text-zinc-900 px-3 py-2 shadow-sm">
        You can. Each session includes a signed hardware attestation. The app
        verifies it automatically and shows Attestation verified above.
      </div>

      {/* Pair 3 */}
      <div className="max-w-fit rounded-xl bg-zinc-825 border border-zinc-750 px-3 py-2 text-zinc-300">
        Who operates the network?
      </div>
      <div className="max-w-[88%] ml-auto rounded-xl bg-white text-zinc-900 px-3 py-2 shadow-sm">
        Independent nodes provide the compute, while smart contracts route
        requests and handle payments. No data retention or training on your
        data. Your chats live encrypted on blockchain, not a central server.
      </div>
    </div>
  </GlowCard>
);

export const HeroSection: React.FC<HeroSectionProps> = ({ handleLogin }) => {
  const container: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.08 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <section className="relative overflow-hidden py-24 sm:py-32 md:py-36">
      <Iridescence />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2"
        >
          {/* Left — Copy & CTAs */}
          <div className="text-center lg:text-left">
            <motion.h1
              variants={item}
              className="mt-0 text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tighter bg-clip-text text-transparent bg-linear-to-b from-zinc-50 to-zinc-400"
            >
              Private AI for a Public World
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-5 text-lg lg:text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto lg:mx-0"
            >
              GPT Protocol provides access to powerful AI models without
              compromise. It combines real-time inference, confidential
              computing, and on-chain governance. Verifiable by design.
            </motion.p>

            <motion.div
              variants={item}
              className="mt-8 flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start"
            >
              <button
                onClick={handleLogin}
                aria-label="Launch App"
                className="group inline-flex items-center justify-center gap-1.5 rounded-lg bg-white pl-4 pr-3 py-2 text-base font-medium text-zinc-950 transition-all duration-200 hover:scale-[1.03] hover:shadow-xl hover:shadow-white/10 focus:ring-0 cursor-pointer"
              >
                Launch App
                <CaretRight weight="bold" size={16} />
              </button>

              <a
                href="https://github.com/onecompany/gpt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-base font-medium text-zinc-200 hover:border-zinc-700 hover:text-white focus:ring-0 cursor-pointer"
              >
                <GithubLogo size={16} />
                GitHub
              </a>

              <a
                href="https://x.com/gpticp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-base font-medium text-zinc-200 hover:border-zinc-700 hover:text-white focus:ring-0 cursor-pointer"
              >
                <XLogo size={14} />
                Follow
              </a>
            </motion.div>

            {/* Unified brand pill row */}
            <motion.div
              variants={item}
              className="mt-7 flex flex-wrap items-center gap-2 justify-center lg:justify-start cursor-pointer"
            >
              <Pill
                icon={<ShieldCheck size={16} />}
                label="Verifiable privacy"
                tone="ink"
              />
              <Pill
                icon={<Globe size={16} />}
                label="Decentralized network"
                tone="ink"
              />
              <Pill
                icon={<Wallet size={16} />}
                label="User-aligned incentives"
                tone="ink"
              />
              <Pill
                icon={<Prohibit size={14} />}
                label="No training on your data"
              />
              <Pill
                icon={<CheckCircle size={14} />}
                label="On-chain attestation"
              />
            </motion.div>
          </div>

          {/* Right — Visual (hidden on mobile) */}
          <motion.div
            variants={item}
            className="relative hidden lg:block isolate"
          >
            <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/8 blur-3xl" />
            <AppPreview />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
