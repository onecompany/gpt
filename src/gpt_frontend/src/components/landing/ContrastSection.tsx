import React from "react";
import { motion } from "framer-motion";
import { Check, X } from "@phosphor-icons/react";
import { Section } from "./Section";

export const ContrastSection: React.FC = () => {
  return (
    <Section>
      <div className="text-center mb-16">
        <h2 className="text-3xl font-medium text-zinc-100 sm:text-4xl">
          A New Paradigm for AI Interaction
        </h2>
        <p className="mt-3 text-lg text-zinc-400 max-w-3xl mx-auto">
          Centralized AI services force a trade-off between power and privacy.
          We built a protocol that gives you both.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 flex flex-col"
        >
          <h3 className="text-2xl font-medium text-zinc-400 mb-4">
            The Old Way: Centralized AI
          </h3>
          <ul className="space-y-3 text-zinc-500 grow">
            <li className="flex items-start gap-3">
              <X size={20} className="text-zinc-600 mt-0.5 shrink-0" />
              <span>Your data is harvested and used for training.</span>
            </li>
            <li className="flex items-start gap-3">
              <X size={20} className="text-zinc-600 mt-0.5 shrink-0" />
              <span>Vulnerable to breaches and single points of failure.</span>
            </li>
            <li className="flex items-start gap-3">
              <X size={20} className="text-zinc-600 mt-0.5 shrink-0" />
              <span>Lack of transparency and verifiability.</span>
            </li>
            <li className="flex items-start gap-3">
              <X size={20} className="text-zinc-600 mt-0.5 shrink-0" />
              <span>Subject to censorship and control by one entity.</span>
            </li>
          </ul>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
          className="p-1 rounded-xl bg-linear-to-br from-zinc-600 to-zinc-850"
        >
          <div className="bg-zinc-900 rounded-lg p-8 h-full flex flex-col">
            <h3 className="text-2xl font-medium text-white mb-4">
              The New Way: GPT Protocol
            </h3>
            <ul className="space-y-3 text-zinc-300 grow">
              <li className="flex items-start gap-3">
                <Check
                  size={20}
                  className="text-zinc-300 mt-0.5 shrink-0"
                  weight="bold"
                />
                <span>
                  Confidential computing ensures your data is never exposed.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Check
                  size={20}
                  className="text-zinc-300 mt-0.5 shrink-0"
                  weight="bold"
                />
                <span>
                  Decentralized network provides resilience and uptime.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Check
                  size={20}
                  className="text-zinc-300 mt-0.5 shrink-0"
                  weight="bold"
                />
                <span>
                  On-chain logic provides full transparency and auditability.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Check
                  size={20}
                  className="text-zinc-300 mt-0.5 shrink-0"
                  weight="bold"
                />
                <span>User-owned and community-governed.</span>
              </li>
            </ul>
          </div>
        </motion.div>
      </div>
    </Section>
  );
};
