import { Message } from "@/types";
import { MessageId } from "@/types/brands";

export function buildChildMap(
  messagesMap: Map<MessageId, Message>,
): Map<MessageId, Message[]> {
  const childMap = new Map<MessageId, Message[]>();
  for (const msg of messagesMap.values()) {
    if (msg.role === "tool") continue;

    // Use nullish coalescing to fallback but handle types properly
    const pid = msg.parentMessageId;

    if (pid) {
      const msgId = msg.backendId ?? msg.id;
      if (!childMap.has(pid)) childMap.set(pid, []);
      if (
        !childMap
          .get(pid)!
          .find((child) => (child.backendId ?? child.id) === msgId)
      ) {
        childMap.get(pid)!.push(msg);
      }
    }
  }
  for (const [key, arr] of childMap.entries()) {
    arr.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    childMap.set(key, arr);
  }
  return childMap;
}

export function findNewestLeaf(
  messagesMap: Map<MessageId, Message>,
  startId: MessageId,
): MessageId {
  if (!messagesMap.has(startId)) return startId;
  const childMap = buildChildMap(messagesMap);
  let newestLeafId = startId;
  let newestTime = messagesMap.get(startId)?.createdAt || "";
  const queue: MessageId[] = [startId];
  const visited = new Set<MessageId>();

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const childrenMessages = childMap.get(nodeId) || [];
    if (childrenMessages.length === 0) {
      const node = messagesMap.get(nodeId);
      if (node && node.role !== "tool") {
        const nodeCreated = node.createdAt;
        if (newestTime === "" || nodeCreated >= newestTime) {
          newestTime = nodeCreated;
          newestLeafId = nodeId;
        }
      }
    } else {
      for (const childMsg of childrenMessages) {
        const childId = childMsg.backendId ?? childMsg.id;
        if (!visited.has(childId)) queue.push(childId);
      }
    }
  }
  return newestLeafId;
}

export function getSiblings(
  allMsgsMap: Map<MessageId, Message>,
  parentId?: MessageId | null,
): Message[] {
  const siblings: Message[] = [];
  const targetParentId = parentId ?? null;
  for (const msg of allMsgsMap.values()) {
    if (msg.role === "tool") continue;

    const msgParentId = msg.parentMessageId ?? null;
    if (msgParentId === targetParentId) {
      siblings.push(msg);
    }
  }
  siblings.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return siblings;
}
