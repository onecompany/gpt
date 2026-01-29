import React from "react";
import { motion } from "framer-motion";
import { Section } from "./Section";
import { CaretRight } from "@phosphor-icons/react";
import { GlowCard } from "./effects";

interface FinalCtaSectionProps {
  handleLogin: () => Promise<void>;
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({
  handleLogin,
}) => {
  return (
    <Section>
      <GlowCard className="relative isolate overflow-hidden rounded-2xl bg-zinc-875 px-6 py-20 text-center shadow-2xl sm:px-16 border border-zinc-800">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-3xl text-3xl tracking-tight font-medium text-white sm:text-4xl"
        >
          Return your digital rights with GPT Protocol.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400"
        >
          The intelligence you need, with the privacy you deserve. GPT Protocol
          uses confidential computing to shield your interactions, ensuring your
          data is exclusively yours. No harvesting, no snooping, no compromise.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="mt-8 flex items-center justify-center gap-x-6"
        >
          <button
            onClick={handleLogin}
            className="group cursor-pointer relative inline-flex items-center justify-center gap-1.5 rounded-lg bg-white pl-4 pr-3 py-2 text-base font-medium text-zinc-950 transition-all duration-200 ease-in-out hover:scale-[1.03] hover:shadow-xl hover:shadow-white/10  focus:ring-0"
          >
            Launch App
            <CaretRight
              weight="bold"
              size={16}
              className="transition-transform duration-200"
            />
          </button>
        </motion.div>
      </GlowCard>
    </Section>
  );
};
