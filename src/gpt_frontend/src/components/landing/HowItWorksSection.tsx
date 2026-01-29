import React, { useRef } from "react";
import { motion, useScroll } from "framer-motion";
import { LockKey, Cube, Cpu, ShieldCheck } from "@phosphor-icons/react";
import { Section } from "./Section";

const howItWorksSteps = [
  {
    title: "1. Encrypted Request",
    description:
      "Your query is encrypted on your device before it ever leaves your browser.",
    icon: <LockKey size={24} />,
  },
  {
    title: "2. IC Orchestration",
    description:
      "A canister smart contract on the Internet Computer securely routes your request to an available node.",
    icon: <Cube size={24} />,
  },
  {
    title: "3. Confidential Inference",
    description:
      "The node, running in an AMD SEV-SNP secure enclave, processes your request while it remains encrypted in memory.",
    icon: <Cpu size={24} />,
  },
  {
    title: "4. Verifiable Response",
    description:
      "The AI's response is encrypted and streamed directly back only to you, with an attestation of secure computation.",
    icon: <ShieldCheck size={24} />,
  },
];

export const HowItWorksSection: React.FC = () => {
  const pipelineRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: pipelineRef,
    offset: ["start center", "end center"],
  });

  return (
    <Section>
      <div className="text-center mb-16">
        <h2 className="text-3xl font-medium text-zinc-100 sm:text-4xl">
          A Verifiable & Private Pipeline
        </h2>
        <p className="mt-3 text-lg text-zinc-400 max-w-3xl mx-auto">
          Every request follows a transparent, cryptographically secured path,
          ensuring your data remains confidential from start to finish.
        </p>
      </div>
      <div ref={pipelineRef} className="relative max-w-2xl mx-auto">
        <div className="absolute left-4 top-4 bottom-4 w-px bg-zinc-800">
          <motion.div
            className="w-full bg-zinc-400 origin-top"
            style={{
              scaleY: scrollYProgress,
            }}
          />
        </div>
        <div className="space-y-16">
          {howItWorksSteps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5 }}
              className="relative flex items-start gap-6"
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-zinc-400 font-semibold z-10">
                {i + 1}
              </div>
              <div>
                <h3 className="text-lg font-medium text-zinc-100 mb-1">
                  {step.title}
                </h3>
                <p className="text-zinc-400">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
};
