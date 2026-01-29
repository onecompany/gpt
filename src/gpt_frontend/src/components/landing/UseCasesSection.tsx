import React from "react";
import { motion } from "framer-motion";
import {
  MagnifyingGlass,
  Lock,
  Eye,
  Globe,
  ArrowRight,
  Brain,
} from "@phosphor-icons/react";
import { Section } from "./Section";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AnimatedCounter } from "./AnimatedCounter";
import { GlowCard } from "./effects";

const useCases = [
  {
    title: "On-Chain Intelligence",
    description:
      "Bring intelligence on-chain. Execute verifiable AI within unstoppable smart contracts, creating truly autonomous agents, next-generation dynamic NFTs, and fully automated decentralized organizations.",
    icon: <Brain size={20} />,
  },
  {
    title: "Confidential Analysis",
    description:
      "Transform your personal documents into an expert assistant. Securely upload your documents or project files to get instant, context-aware answers, knowing your proprietary data is never exposed.",
    icon: <MagnifyingGlass size={20} />,
  },
  {
    title: "Secure Creation",
    description:
      "Create content without compromise. Brainstorm, write, and code knowing your intellectual property and confidential drafts are protected from data leaks and never used for model training or being sold.",
    icon: <Lock size={20} />,
  },
  {
    title: "Truly Personal AI",
    description:
      "Craft your own perfect co-pilot that learns from your private notes, documents, code, and other data to truly understand your world, all without your sensitive data ever being stored by third parties.",
    icon: <Eye size={20} />,
  },
];

export const UseCasesSection: React.FC = () => {
  return (
    <Section>
      <div className="text-center mb-16">
        <h2 className="text-3xl font-medium text-zinc-100 sm:text-4xl">
          For Any Industry, For Any Use Case
        </h2>
        <p className="mt-3 text-lg text-zinc-400 max-w-3xl mx-auto">
          The privacy and verifiability of GPT Protocol unlocks AI for the most
          sensitive applications.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {useCases.map((useCase) => (
          <motion.div
            key={useCase.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5 }}
          >
            <GlowCard className="p-5 bg-zinc-850 border border-zinc-800 rounded-xl h-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-zinc-800 rounded-md">{useCase.icon}</div>
                <h3 className="font-semibold text-zinc-200">{useCase.title}</h3>
              </div>
              <p className="text-sm text-zinc-400">{useCase.description}</p>
            </GlowCard>
          </motion.div>
        ))}
      </div>
      <div className="mt-6 mb-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlowCard className="lg:col-span-2 p-5 bg-zinc-875 border border-zinc-800 rounded-xl">
          <h3 className="text-xl font-medium text-zinc-100 mb-2">
            A Self-Sustaining Ecosystem
          </h3>
          <p className="text-zinc-400 mb-4">
            Our tokenomics are designed to align incentives for node operators
            and users, ensuring the protocol&apos;s long-term growth and
            decentralization.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-semibold text-zinc-100">
                {/* <AnimatedCounter value={321} /> */}?
              </div>
              <div className="text-sm text-zinc-400">Active Nodes</div>
            </div>
            <div>
              <div className="text-3xl font-semibold text-zinc-100">
                {/* <AnimatedCounter value={1.5} suffix="M+" decimals={1} /> */}
                ?
              </div>
              <div className="text-sm text-zinc-400">Total Inferences</div>
            </div>
            <div>
              <div className="text-3xl font-semibold text-zinc-100">
                {/* <AnimatedCounter value={1} prefix="$" /> */}?
              </div>
              <div className="text-sm text-zinc-400">Rewards Paid</div>
            </div>
            <div>
              <div className="text-3xl font-semibold text-zinc-100">
                {/* <AnimatedCounter value={123} /> */}?
              </div>
              <div className="text-sm text-zinc-400">AI Models</div>
            </div>
          </div>
        </GlowCard>
        <GlowCard className="lg:col-span-2 p-5 bg-zinc-875 border border-zinc-800 rounded-xl relative overflow-hidden">
          <Globe
            size={172}
            className="absolute -right-12 -bottom-12 text-zinc-800"
            weight="light"
          />
          <h3 className="text-xl font-medium text-zinc-100 mb-2">
            Global & Decentralized
          </h3>

          <p className="text-zinc-400 mb-2">
            Our globally distributed network of hardware-attested nodes ensures
            resilient and low-latency access. Your requests are intelligently
            routed to the nearest node, delivering the performance of local
            inference with the trustless security of a decentralized
            architecture.
          </p>

          <a
            href="#"
            className="inline-flex items-center gap-2 text-zinc-300 hover:text-white text-sm font-medium focus:ring-0 cursor-pointer"
          >
            Become a Node Operator
            <ArrowRight size={16} />
          </a>
        </GlowCard>
      </div>
    </Section>
  );
};
