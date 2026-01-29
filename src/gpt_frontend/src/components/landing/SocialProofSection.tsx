import React from "react";
import { motion } from "framer-motion";
import { Section } from "./Section";

const partnerLogos = [
  "OpenAI",
  "Meta",
  "Google",
  "DeepSeek",
  "DeepInfra",
  "NovitaAI",
  "OpenRouter",
];

export const SocialProofSection: React.FC = () => {
  return (
    <Section className="py-12! border-y bg-zinc-875 border-zinc-800">
      <div className="text-center">
        <p className="text-sm text-zinc-500 uppercase tracking-wider mb-6">
          Powered by the leading models and trusted providers
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-10 sm:gap-x-12 gap-y-6">
          {partnerLogos.map((partner) => (
            <motion.div
              key={partner}
              className="text-xl font-medium text-zinc-600 hover:text-zinc-400 duration-300"
              whileHover={{ scale: 1.1 }}
            >
              {partner}
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
};
