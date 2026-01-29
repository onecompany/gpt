import React, { useEffect, useMemo, useRef } from "react";
import { MessagesList } from "@/components/messages";
import { ChatInput } from "./ChatInput";
import { useChatStore } from "@/store/chatStore";
import { Message } from "@/types";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { ChatId, MessageId } from "@/types/brands";

function buildMapsFromMap(messagesMap: Map<MessageId, Message>) {
  const childMap = new Map<MessageId, MessageId[]>();
  for (const m of messagesMap.values()) {
    const id = m.backendId ?? m.id;
    // Handle root messages which have no parent
    if (m.parentMessageId) {
      const pid = m.parentMessageId;
      if (!childMap.has(pid)) childMap.set(pid, []);
      childMap.get(pid)!.push(id);
    }
  }
  // Sort children by creation time to ensure deterministic ordering
  for (const children of childMap.values()) {
    children.sort((aId, bId) => {
      const msgA = messagesMap.get(aId);
      const msgB = messagesMap.get(bId);
      if (!msgA || !msgB) return 0;
      return (
        new Date(msgA.createdAt).getTime() - new Date(msgB.createdAt).getTime()
      );
    });
  }
  return { msgMap: messagesMap, childMap };
}

function findRoot(
  leafId: MessageId,
  msgMap: Map<MessageId, Message>,
): MessageId {
  let currMsg = msgMap.get(leafId);
  while (currMsg?.parentMessageId) {
    const parent = msgMap.get(currMsg.parentMessageId);
    if (!parent) break;
    currMsg = parent;
  }
  return currMsg ? (currMsg.backendId ?? currMsg.id) : leafId;
}

function getSubtree(
  rootId: MessageId,
  msgMap: Map<MessageId, Message>,
  childMap: Map<MessageId, MessageId[]>,
): Message[] {
  const visited = new Set<MessageId>();
  const results: Message[] = [];
  const queue = [rootId];
  while (queue.length) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const msg = msgMap.get(nodeId);
    if (msg) {
      results.push(msg);
      const childrenIds = childMap.get(nodeId) ?? [];
      for (const childId of childrenIds) {
        if (!visited.has(childId)) queue.push(childId);
      }
    }
  }
  results.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return results;
}

function buildChain(
  leafId: MessageId,
  msgMap: Map<MessageId, Message>,
): Message[] {
  const chain: Message[] = [];
  let curr = msgMap.get(leafId);
  while (curr) {
    chain.push(curr);
    if (!curr.parentMessageId) break;
    curr = msgMap.get(curr.parentMessageId);
  }
  return chain.reverse();
}

function getBranchMessages(
  allMsgsMap: Map<MessageId, Message>,
  leafId: MessageId,
): Message[] {
  if (!allMsgsMap.has(leafId)) return [];
  const { msgMap, childMap } = buildMapsFromMap(allMsgsMap);
  const leafMsg = msgMap.get(leafId)!;
  const rootId = findRoot(leafId, msgMap);
  const fullSubTree = getSubtree(rootId, msgMap, childMap);
  const chainToLeaf = buildChain(leafId, msgMap);

  const leafKey = leafMsg.backendId ?? leafMsg.id;
  const leafChildrenIds = childMap.get(leafKey) || [];

  if (leafChildrenIds.length > 0) {
    const subtreeOfLeaf = getSubtree(leafKey, msgMap, childMap);
    const branchIds = new Set<MessageId>();
    chainToLeaf.forEach((m) => branchIds.add(m.backendId ?? m.id));
    subtreeOfLeaf.forEach((m) => branchIds.add(m.backendId ?? m.id));
    return fullSubTree
      .filter((m) => branchIds.has(m.backendId ?? m.id))
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  } else {
    return chainToLeaf;
  }
}

interface ChatPageProps {
  currentIsAITyping: boolean;
  input: string;
  setInput: (input: string) => void;
  sendMessageAndUpdateUrl: () => Promise<void>;
  currentChatId: ChatId | null;
}

export const ChatPage: React.FC<ChatPageProps> = ({
  currentIsAITyping,
  input,
  setInput,
  sendMessageAndUpdateUrl,
  currentChatId,
}) => {
  const {
    activeLeafMessageId,
    setActiveLeaf,
    messages,
    isLoading,
    hasMessagesLoaded,
  } = useChatStore();

  const currentMessagesMap = useMemo(() => {
    return (
      (currentChatId ? messages[currentChatId] : undefined) ??
      new Map<MessageId, Message>()
    );
  }, [currentChatId, messages]);

  const messagesAlreadyLoaded = currentChatId
    ? hasMessagesLoaded(currentChatId)
    : false;

  useEffect(() => {
    if (
      !currentChatId ||
      !(currentMessagesMap instanceof Map) ||
      currentMessagesMap.size === 0
    )
      return;

    const storedLeafId = activeLeafMessageId[currentChatId];
    if (storedLeafId != null && currentMessagesMap.has(storedLeafId)) return;

    const parentIds = new Set<MessageId>();
    currentMessagesMap.forEach((m) => {
      if (m.parentMessageId) parentIds.add(m.parentMessageId);
    });

    const potentialLeaves: Message[] = [];
    currentMessagesMap.forEach((msg) => {
      const msgId = msg.backendId ?? msg.id;
      if (!parentIds.has(msgId)) potentialLeaves.push(msg);
    });

    if (potentialLeaves.length > 0) {
      potentialLeaves.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setActiveLeaf(
        currentChatId,
        potentialLeaves[0].backendId ?? potentialLeaves[0].id,
      );
    } else if (currentMessagesMap.size > 0) {
      const allMessages = Array.from(currentMessagesMap.values());
      allMessages.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setActiveLeaf(
        currentChatId,
        allMessages[0].backendId ?? allMessages[0].id,
      );
    }
  }, [currentChatId, currentMessagesMap, activeLeafMessageId, setActiveLeaf]);

  const chatLeafId = currentChatId ? activeLeafMessageId[currentChatId] : null;

  const activeBranchMessages = useMemo(() => {
    if (
      !currentChatId ||
      !chatLeafId ||
      !(currentMessagesMap instanceof Map) ||
      currentMessagesMap.size === 0
    ) {
      return [];
    }
    return getBranchMessages(currentMessagesMap, chatLeafId);
  }, [currentChatId, chatLeafId, currentMessagesMap]);

  const lastMessage = activeBranchMessages[activeBranchMessages.length - 1];
  const scrollDependency = `${activeBranchMessages.length}:${
    lastMessage?.content?.length ?? 0
  }`;
  const {
    scrollContainerRef,
    sentinelRef,
    isUserScrolledUp,
    hasUnread,
    scrollToBottom,
  } = useAutoScroll(scrollDependency);

  const prevMessagesLength = useRef(activeBranchMessages.length);

  useEffect(() => {
    const aNewMessageWasAdded =
      activeBranchMessages.length > prevMessagesLength.current;
    if (aNewMessageWasAdded && lastMessage?.role === "user") {
      scrollToBottom("auto");
    }
    prevMessagesLength.current = activeBranchMessages.length;
  }, [activeBranchMessages.length, lastMessage, scrollToBottom]);

  const showSpinner =
    isLoading && !messagesAlreadyLoaded && activeBranchMessages.length === 0;
  const showMessages = activeBranchMessages.length > 0;
  const showEmptyState = !showSpinner && !showMessages;

  return (
    <motion.div
      key={`chat-page-${currentChatId}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
      className="flex flex-1 min-h-0 flex-col h-full"
    >
      <div
        ref={scrollContainerRef}
        className="relative flex-1 min-h-0 flex flex-col overflow-y-auto"
      >
        <AnimatePresence mode="wait">
          {showSpinner && (
            <motion.div
              key="spinner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <CircleNotchIcon
                className="animate-spin text-zinc-400"
                size={24}
                weight="regular"
              />
            </motion.div>
          )}

          {showEmptyState && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <p className="text-zinc-400 text-sm">No messages to display.</p>
            </motion.div>
          )}

          {showMessages && (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="w-full"
            >
              <div className="mx-auto max-w-208">
                <MessagesList
                  messages={activeBranchMessages}
                  sentinelRef={sentinelRef}
                  onActionRequiresScroll={scrollToBottom}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        sendMessage={sendMessageAndUpdateUrl}
        isGenerating={useChatStore(
          (state) => state.isGenerating[currentChatId ?? "new"] ?? false,
        )}
        isUserScrolledUp={isUserScrolledUp}
        hasUnread={hasUnread}
        onScrollToBottomClick={() => scrollToBottom("smooth")}
      />
    </motion.div>
  );
};

ChatPage.displayName = "ChatPage";
