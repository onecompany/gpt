import React from "react";
import { Section } from "./Section";
import { GlowCard } from "./effects";

const codeForBackground = `import { GptProtocol } from '@gpt-protocol/sdk';

const gpt = new GptProtocol({ identity: getIdentity() });

async function runPrivateQuery() {
  const stream = await gpt.chat.create({
    model: 'mistral-7b',
    messages: [{ role: 'user', content: 'Explain zero-knowledge proofs.' }],
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.content);
  }
}

runPrivateQuery();
`;

export const DeveloperExperienceSection: React.FC = () => {
  return (
    <Section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl font-medium text-zinc-100 sm:text-4xl">
            Developer First
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Our goal is to make private AI inference as simple as a single API
            call. Integrate with any language, any platform, and start building
            secure AI applications and smart contracts today.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <a
              href="#"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-base font-medium text-zinc-100 hover:bg-zinc-700 focus:ring-0 cursor-pointer"
            >
              Read the Docs
            </a>
          </div>
        </div>
        <GlowCard className="relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
          <div className="blur-sm opacity-80 pointer-events-none">
            <div className="flex items-center gap-2 p-3 bg-zinc-800/50">
              <div className="px-3 py-1 text-sm rounded-md text-zinc-300 bg-zinc-750">
                TypeScript
              </div>
              <div className="px-3 py-1 text-sm rounded-md text-zinc-300">
                Python
              </div>
              <div className="px-3 py-1 text-sm rounded-md text-zinc-300">
                Rust
              </div>
            </div>
            <div className="p-4 font-mono text-sm">
              <pre>
                <code className="whitespace-pre-wrap text-zinc-300">
                  {codeForBackground}
                </code>
              </pre>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="px-4 py-2 rounded-lg text-zinc-300 font-medium backdrop-blur-xl">
              Coming Soon
            </span>
          </div>
        </GlowCard>
      </div>
    </Section>
  );
};
