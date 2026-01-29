import {
  Chat,
  Message,
  Model,
  Attachment,
  CompressionLevel,
  Tool,
  PublicNodeInfo,
} from "../../types";
import { AllChatActions } from "./index";
import { availableTools } from "@/constants/constants";
import { ChatId, JobId, MessageId, NodeId } from "../../types/brands";

export interface ReconciledNode {
  nodeId: NodeId;
  address: string;
  modelId: string;
  principal: string;
  publicKey: string | undefined;
}

export interface ActiveJobInfo {
  jobId: JobId;
  erroredViaStream?: boolean;
}

export interface ChatState {
  chats: Chat[];
  messages: { [chatId: string]: Map<MessageId, Message> }; // Map Key is now strictly MessageId (string)
  currentChatId: ChatId | null; // Strictly ChatId
  input: string;
  isWaiting: { [chatId: string]: boolean };
  isAITyping: { [chatId: string]: boolean };
  isGenerating: { [chatId: string]: boolean };
  chatTitle: string;
  chatVersion: number;
  temperature: number;
  maxOutput: number;
  maxContext: number;
  compressionLevel: CompressionLevel;
  selectedModel: Model | null;
  selectedTools: Tool[];
  reasoningEffort: string;
  isLoading: boolean;
  webSockets: { [jobId: string]: WebSocket }; // Key is JobId (string)
  activeChatJobs: { [chatId: string]: ActiveJobInfo | undefined };
  hasFetchedChats: boolean;
  hasFetchedMyNodes: boolean;
  hasFetchedAllNodes: boolean;
  activeLeafMessageId: { [chatId: string]: MessageId | null };
  reconciledActiveNodes: ReconciledNode[];
  myNodesLoading: boolean;
  allNodesLoading: boolean;
  reconciledNodesLoading: boolean;
  myNodes: PublicNodeInfo[];
  allNodes: PublicNodeInfo[];
  isNextChatTemporary: boolean;
  attachments: Attachment[];
  attachmentCleanupTimer: number | null;
  isAttachmentsExiting: boolean;
  isProcessingTools: { [compositeKey: string]: boolean };
  hasUserSelectedModel: boolean;
  ocrPromises: Map<
    JobId,
    { resolve: (value: string) => void; reject: (reason?: unknown) => void }
  >;
  queuedToolCalls: Array<{ chatId: ChatId; assistantMessageId: MessageId }>;
  isInitialAnimationComplete: boolean;
  // NodeId (as string) -> Expiry Timestamp (ms)
  temporaryNodeBlacklist: Map<NodeId, number>;
}

export type ChatStoreState = ChatState & AllChatActions;

export const initialState: ChatState = {
  chats: [],
  messages: {},
  currentChatId: null,
  input: "",
  isWaiting: {},
  isAITyping: {},
  isGenerating: {},
  chatTitle: "",
  chatVersion: 0,
  temperature: 0.9,
  maxOutput: 2048,
  maxContext: 8192,
  compressionLevel: "extreme",
  selectedModel: null,
  selectedTools: availableTools,
  reasoningEffort: "medium",
  isLoading: false,
  webSockets: {},
  activeChatJobs: {},
  hasFetchedChats: false,
  hasFetchedMyNodes: false,
  hasFetchedAllNodes: false,
  activeLeafMessageId: {},
  reconciledActiveNodes: [],
  myNodesLoading: false,
  allNodesLoading: false,
  reconciledNodesLoading: false,
  myNodes: [],
  allNodes: [],
  isNextChatTemporary: false,
  attachments: [],
  attachmentCleanupTimer: null,
  isAttachmentsExiting: false,
  isProcessingTools: {},
  hasUserSelectedModel: false,
  ocrPromises: new Map(),
  queuedToolCalls: [],
  isInitialAnimationComplete: false,
  temporaryNodeBlacklist: new Map(),
};
