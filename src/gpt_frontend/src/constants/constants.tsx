import { Tool } from "@/types";
import {
  Archive,
  Brain,
  Calculator,
  Chats,
  ClockCounterClockwise,
  Code,
  Folder,
  GraduationCap,
  Lightbulb,
  Microscope,
  Pen,
  RocketLaunch,
  ChartLine,
  Atom,
  Cube,
  Books,
  Lock,
  Gear,
  HardDrive,
  PuzzlePiece,
  Network,
  Cloud,
  BezierCurve,
  FileSearchIcon,
  Terminal,
  Cpu,
  CodeSimple,
  LightbulbFilament,
} from "@phosphor-icons/react";

export const availableTools: Tool[] = [
  {
    name: "files_search",
    displayName: "Files Search",
    description:
      "Searches the content of all user's text-based files to find relevant information for a given query. Returns the top 5 most relevant chunks.",
    parameters: JSON.stringify(
      {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The specific search query to find relevant information in the user's files.",
          },
        },
        required: ["query"],
      },
      null,
      2,
    ),
  },
  {
    name: "web_search",
    displayName: "Web Search",
    description:
      "Performs a real-time web search with LLM agent to retrieve up-to-date information, news, facts, or specific data not present in your training data. Use this when the user asks about current events, specific products, or live data.",
    parameters: JSON.stringify(
      {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search query optimized for a search-enabled LLM (e.g., 'find and explain current price of BTC', 'latest SpaceX launches with dates').",
          },
        },
        required: ["query"],
      },
      null,
      2,
    ),
  },
];

export const assistantButtons = [
  {
    icon: (
      <GraduationCap
        weight="bold"
        size={14}
        className="fill-zinc-400 group-hover:fill-zinc-300"
      />
    ),
    label: "Educator",
  },
  {
    icon: (
      <Code
        weight="bold"
        size={14}
        className="fill-zinc-400 group-hover:fill-zinc-300"
      />
    ),
    label: "Developer",
  },
  {
    icon: (
      <Pen
        weight="bold"
        size={14}
        className="fill-zinc-400 group-hover:fill-zinc-300"
      />
    ),
    label: "Creative Writer",
  },
  {
    icon: (
      <Microscope
        weight="bold"
        size={14}
        className="fill-zinc-400 group-hover:fill-zinc-300"
      />
    ),
    label: "Researcher",
  },
  {
    icon: (
      <Lightbulb
        weight="bold"
        size={14}
        className="fill-zinc-400 group-hover:fill-zinc-300"
      />
    ),
    label: "Brainstormer",
  },
];

export const categories = [
  {
    value: "recent",
    name: "Recent",
    icon: <Chats weight="regular" size={20} className="fill-zinc-400" />,
  },
  {
    value: "temporary",
    name: "Temporary",
    icon: (
      <ClockCounterClockwise
        weight="regular"
        size={20}
        className="fill-zinc-400"
      />
    ),
  },
  {
    value: "archived",
    name: "Archived",
    icon: <Archive weight="regular" size={20} className="fill-zinc-400" />,
  },
];

export const menuButtons = [
  {
    href: "/files",
    icon: (
      <Folder
        weight="regular"
        size={20}
        className="group-hover:fill-zinc-200 fill-zinc-400"
      />
    ),
    label: "Files",
  },
];

export const greetingMessages = [
  "What would you like to explore today?",
  "Ready to delve into new concepts?",
  "What knowledge are you seeking?",
  "How can I assist your work?",
  "What new ideas are you developing?",
  "Let's discover something new together.",
  "Which topic piques your interest?",
  "What would you like to create?",
  "In what area can I provide insights?",
  "Where shall we begin our discussion?",
  "What challenges are you facing?",
  "Curious about anything in particular?",
  "What's on your mind?",
  "How can I support your project?",
  "Seeking to understand something complex?",
  "Ready for a deep dive?",
  "What can we achieve together?",
  "What's next on your learning journey?",
];

export const newChatSuggestions = [
  {
    icon: <Brain size={20} className="text-zinc-300" />,
    title: "Explain the architecture",
    description: "of transformer attention for LLMs",
  },
  {
    icon: <Code size={20} className="text-zinc-300" />,
    title: "Generate a Rust program",
    description: "to implement a simple Merkle tree",
  },
  {
    icon: <ChartLine size={20} className="text-zinc-300" />,
    title: "Summarize the principles",
    description: "of reinforcement learning applications",
  },
  {
    icon: <Lightbulb size={20} className="text-zinc-300" />,
    title: "Brainstorm use cases",
    description: "for a decentralized AI agent",
  },
  {
    icon: <Cube size={20} className="text-zinc-300" />,
    title: "Describe the canister model",
    description: "in decentralized architecture",
  },
  {
    icon: <Lock size={20} className="text-zinc-300" />,
    title: "Elaborate on zero-knowledge proofs",
    description: "in decentralized privacy",
  },
  {
    icon: <Books size={20} className="text-zinc-300" />,
    title: "Analyze ethical implications",
    description: "of generative AI",
  },
  {
    icon: <RocketLaunch size={20} className="text-zinc-300" />,
    title: "Outline the steps",
    description: "to deploy a web app on smart contracts",
  },
  {
    icon: <Atom size={20} className="text-zinc-300" />,
    title: "Explain quantum computing",
    description: "qubits, superposition, entanglement",
  },
  {
    icon: <Gear size={20} className="text-zinc-300" />,
    title: "Detail a CI/CD pipeline",
    description: "for microservices in cloud environments",
  },
  {
    icon: <HardDrive size={20} className="text-zinc-300" />,
    title: "Discuss decentralized storage",
    description: "vs traditional cloud storage",
  },
  {
    icon: <PuzzlePiece size={20} className="text-zinc-300" />,
    title: "Propose a solution",
    description: "for data privacy in federated learning",
  },
  {
    icon: <Microscope size={20} className="text-zinc-300" />,
    title: "Investigate consensus mechanisms",
    description: "in modern blockchain networks",
  },
  {
    icon: <Calculator size={20} className="text-zinc-300" />,
    title: "Demonstrate Big O notation",
    description: "for data structures and algorithms",
  },
  {
    icon: <Pen size={20} className="text-zinc-300" />,
    title: "Draft an abstract",
    description: "for a paper on novel neural architectures",
  },
  {
    icon: <Code size={20} className="text-zinc-300" />,
    title: "Write a TypeScript interface",
    description: "for complex REST API responses",
  },
  {
    icon: <Network size={20} className="text-zinc-300" />,
    title: "Explain Distributed Ledger Technology",
    description: "its types and applications",
  },
  {
    icon: <Cloud size={20} className="text-zinc-300" />,
    title: "Describe Serverless Computing",
    description: "advantages, disadvantages, and use cases",
  },
  {
    icon: <BezierCurve size={20} className="text-zinc-300" />,
    title: "Analyze Graph Algorithms",
    description: "like Dijkstra's and A* for pathfinding",
  },
  {
    icon: <FileSearchIcon size={20} className="text-zinc-300" />,
    title: "Research Federated Learning",
    description: "privacy-preserving aspects and challenges",
  },
  {
    icon: <Terminal size={20} className="text-zinc-300" />,
    title: "Generate a shell script",
    description: "for automating file backup",
  },
  {
    icon: <Cpu size={20} className="text-zinc-300" />,
    title: "Explain CPU Cache Coherence",
    description: "protocols and multicore performance impact",
  },
  {
    icon: <CodeSimple size={20} className="text-zinc-300" />,
    title: "Design a smart contract",
    description: "for a simple token swap on blockchain",
  },
  {
    icon: <LightbulbFilament size={20} className="text-zinc-300" />,
    title: "Discuss AI safety concerns",
    description: "and mitigation strategies in advanced AI",
  },
  {
    icon: <HardDrive size={20} className="text-zinc-300" />,
    title: "Explore Content Addressing",
    description: "in decentralized file systems",
  },
  {
    icon: <Lock size={20} className="text-zinc-300" />,
    title: "Define Homomorphic Encryption",
    description: "its potential in confidential computing",
  },
  {
    icon: <Brain size={20} className="text-zinc-300" />,
    title: "Explain Generative Adversarial Networks",
    description: "their architecture and training process",
  },
  {
    icon: <Code size={20} className="text-zinc-300" />,
    title: "Write Python for NLP",
    description: "basic text preprocessing and tokenization",
  },
  {
    icon: <Network size={20} className="text-zinc-300" />,
    title: "Describe Peer-to-Peer Networks",
    description: "their architecture and benefits",
  },
  {
    icon: <ChartLine size={20} className="text-zinc-300" />,
    title: "Summarize Data Compression",
    description: "lossy vs lossless methods",
  },
  {
    icon: <Books size={20} className="text-zinc-300" />,
    title: "Analyze Machine Learning Bias",
    description: "causes and detection methods",
  },
];

export const chatParameterOptions = {
  temperature: {
    min: 0.1,
    max: 1.0,
    step: 0.1,
  },
  context: {
    min: 1024,
    defaultMax: 131072,
    step: 1024,
  },
  output: {
    min: 1024,
    defaultMax: 8192,
    step: 1024,
  },
};
