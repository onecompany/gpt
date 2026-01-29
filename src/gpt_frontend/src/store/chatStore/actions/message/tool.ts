import { StateCreator } from "zustand";
import { useAuthStore } from "../../../authStore";
import { UserApi } from "@/services/api/userApi";
import type { ChatStoreState } from "../../index";
import { useFileStore } from "../../../fileStore";
import { useEmbeddingStore } from "../../../embeddingStore";
import { useModelsStore } from "../../../modelsStore";
import { isTextMimeType } from "@/utils/fileUtils";
import type {
  GlobalSearchResult,
  SearchableChunk,
  FileItem,
  Message,
  ToolResult,
  StreamedResponse,
} from "@/types";
import {
  compileSystemPrompt,
  compileWebSearchPrompt,
} from "@/utils/promptUtils";
import { buildWebSocketUrl } from "../webSocket/url";
import { fromBigInt } from "@/utils/candidUtils";
import { ChatCrypto } from "@/utils/crypto/chat";
import * as age from "age-encryption";
import { toMessageId, toJobId, MessageId, JobId, ChatId } from "@/types/brands";

export interface ToolContinuationActions {
  runAndContinueFromTools: (
    chatId: string,
    assistantMessageId: string,
  ) => Promise<void>;
}

const SEARCH_MODEL_ID = "openrouter-sonar-pro-search";

export const createToolContinuationActions: StateCreator<
  ChatStoreState,
  [],
  [],
  ToolContinuationActions
> = (set, get) => ({
  runAndContinueFromTools: async (chatId, assistantMessageId) => {
    const compositeKey = `${chatId}:${assistantMessageId}`;
    set((state) => ({
      isProcessingTools: { ...state.isProcessingTools, [compositeKey]: true },
    }));

    try {
      const { authClient, userCanisterId, rootKey } = useAuthStore.getState();
      const {
        messages,
        selectedModel,
        temperature,
        maxOutput,
        maxContext,
        selectedTools,
        pickNodeForModel,
        connectToChainWebSocket,
        setActiveLeaf,
        setActiveChatJob,
        reasoningEffort,
        chats,
      } = get();

      if (!authClient || !userCanisterId || !selectedModel || !rootKey) {
        throw new Error("Cannot run tools: user or model not configured.");
      }

      const currentChat = chats.find((c) => c.chatId === chatId);
      if (!currentChat || !currentChat.encryptionSalt) {
        throw new Error("Encryption metadata missing.");
      }

      const assistantMessage = messages[chatId]?.get(
        assistantMessageId as MessageId,
      );
      if (!assistantMessage || !assistantMessage.tool_calls) {
        throw new Error("Parent assistant message with tool calls not found.");
      }

      const toolResults: ToolResult[] = [];
      for (const call of assistantMessage.tool_calls) {
        if (
          assistantMessage.tool_results?.some(
            (res) => res.tool_call_id === call.id,
          )
        ) {
          const existingResult = assistantMessage.tool_results.find(
            (res) => res.tool_call_id === call.id,
          )!;
          toolResults.push(existingResult);
          continue;
        }

        let result: ToolResult;
        switch (call.function.name) {
          case "files_search": {
            try {
              const { query } = JSON.parse(call.function.arguments);
              if (typeof query !== "string" || !query.trim()) {
                throw new Error(
                  "Invalid or empty query provided to files_search tool.",
                );
              }

              const { indexingStatus, isIndexStale, searchableChunks, files } =
                useFileStore.getState();
              const { runHybridSearch } = useEmbeddingStore.getState();

              const textFiles = Array.from(files.values()).filter(
                (f: FileItem) => isTextMimeType(f.mimeType, f.name),
              );

              if (textFiles.length === 0) {
                result = {
                  tool_call_id: call.id,
                  content:
                    "No searchable file content found. The user has not uploaded any text-based files.",
                  error: undefined,
                };
                break;
              }

              const isIndexIncomplete =
                textFiles.length > searchableChunks.size;
              const needsIndexing =
                isIndexStale || isIndexIncomplete || indexingStatus === "idle";

              if (needsIndexing || indexingStatus === "in-progress") {
                set((state) => ({
                  queuedToolCalls: [
                    ...state.queuedToolCalls,
                    {
                      chatId: chatId as any,
                      assistantMessageId: assistantMessageId as any,
                    },
                  ],
                }));
                result = {
                  tool_call_id: call.id,
                  content:
                    "The file index is being updated. I will provide an answer as soon as it's ready.",
                  error: undefined,
                };
                break;
              }

              const allSearchableChunks: SearchableChunk[] = Array.from(
                searchableChunks.values(),
              ).flat();

              if (allSearchableChunks.length === 0) {
                result = {
                  tool_call_id: call.id,
                  content:
                    "No searchable file content found. The user has not uploaded any text-based files or the files are empty.",
                  error: undefined,
                };
              } else {
                const searchResultsRaw = await runHybridSearch(
                  query,
                  allSearchableChunks,
                );

                const chunkToFileMap = new Map<
                  string,
                  { name: string; id: string }
                >();
                searchableChunks.forEach((chunksInFile, fileId) => {
                  const file = files.get(fileId);
                  if (file) {
                    chunksInFile.forEach((chunk) => {
                      chunkToFileMap.set(`${fileId}-${chunk.chunk_index}`, {
                        name: file.name,
                        id: file.id,
                      });
                    });
                  }
                });

                const searchResultsWithInfo: GlobalSearchResult[] =
                  searchResultsRaw
                    .map((searchResult) => ({
                      ...searchResult,
                      fileInfo: chunkToFileMap.get(searchResult.id)!,
                    }))
                    .filter((r): r is GlobalSearchResult => !!r.fileInfo);

                const top5Results = searchResultsWithInfo.slice(0, 5);

                if (top5Results.length === 0) {
                  result = {
                    tool_call_id: call.id,
                    content:
                      "No relevant information found for the query in the user's files.",
                    error: undefined,
                  };
                } else {
                  const formattedContent = top5Results
                    .map((res, i) => {
                      return `Result ${i + 1}:\nSource File: "${
                        res.fileInfo.name
                      }"\n---\n${res.text}\n---`;
                    })
                    .join("\n\n");
                  result = {
                    tool_call_id: call.id,
                    content: formattedContent,
                    error: undefined,
                  };
                }
              }
            } catch (e: unknown) {
              const errMsg = e instanceof Error ? e.message : String(e);
              result = {
                tool_call_id: call.id,
                content: JSON.stringify({
                  error:
                    "An internal error occurred while executing the files_search tool.",
                  details: errMsg || "Unknown error",
                }),
                error: `Error executing files_search tool: ${errMsg}`,
              };
            }
            break;
          }
          case "web_search": {
            try {
              const args = JSON.parse(call.function.arguments);
              const compiledPrompt = compileWebSearchPrompt(args.query);

              if (
                typeof args.query !== "string" ||
                !args.query.trim() ||
                !compiledPrompt
              ) {
                throw new Error("Invalid or empty query for web search.");
              }

              const { models } = useModelsStore.getState();
              const searchModel = models.find(
                (m) => m.modelId === SEARCH_MODEL_ID,
              );

              if (!searchModel || searchModel.nodeCount === 0) {
                result = {
                  tool_call_id: call.id,
                  content: JSON.stringify({
                    error:
                      "Search service unavailable (model not found or offline).",
                  }),
                  error: "Search service unavailable.",
                };
                break;
              }

              const chosenNode = await pickNodeForModel(SEARCH_MODEL_ID);
              if (!chosenNode) {
                throw new Error("No active nodes available for search model.");
              }
              if (!chosenNode.publicKey) {
                throw new Error("Node missing encryption key for search.");
              }

              const tempSalt = ChatCrypto.generateSalt();
              const tempKey = await ChatCrypto.deriveChatKey(rootKey, tempSalt);
              const encryptedPrompt = await ChatCrypto.encryptMessage(
                compiledPrompt,
                tempKey,
              );
              const encryptedKeyForNode = await ChatCrypto.wrapKeyForNode(
                tempKey,
                chosenNode.publicKey,
              );

              const createParams = {
                title: "Temp Search",
                initialMessage: new Uint8Array(encryptedPrompt),
                modelId: SEARCH_MODEL_ID,
                nodeId: Number(chosenNode.nodeId), // Convert branded NodeId to number
                temperature: 0.7,
                maxCompletionTokens: 16384,
                maxContext: 100000,
                encryptedChatKey: encryptedKeyForNode,
                encryptionSalt: new Uint8Array(tempSalt),
                attachments: [],
                tools: [],
                customPrompt: undefined,
                temporary: true,
              };

              const createRes = await UserApi.createChat(
                authClient.getIdentity(),
                userCanisterId,
                createParams,
              );

              const tempJobId = toJobId(fromBigInt(createRes.job_id));
              const wsUrl = `${buildWebSocketUrl(chosenNode.address)}/conversation/ws`;

              const accumulatedText = await new Promise<string>(
                async (resolve, reject) => {
                  const ws = new WebSocket(wsUrl);
                  let text = "";
                  let isSettled = false;

                  const cleanup = () => {
                    isSettled = true;
                    ws.close();
                  };

                  const timeout = setTimeout(() => {
                    if (!isSettled) {
                      cleanup();
                      reject(new Error("Search request timed out."));
                    }
                  }, 60000);

                  ws.onopen = async () => {
                    try {
                      const payload = JSON.stringify({
                        jobId: tempJobId,
                        userCanisterId,
                      });
                      const encrypter = new age.Encrypter();
                      encrypter.addRecipient(chosenNode.publicKey!);
                      const encryptedBytes = await encrypter.encrypt(payload);

                      let binary = "";
                      const len = encryptedBytes.byteLength;
                      for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(encryptedBytes[i]);
                      }
                      const base64Payload = window.btoa(binary);
                      ws.send(base64Payload);
                    } catch (e) {
                      cleanup();
                      reject(e);
                    }
                  };

                  ws.onmessage = async (evt) => {
                    try {
                      const binaryString = window.atob(evt.data);
                      const encryptedBytes = new Uint8Array(
                        binaryString.length,
                      );
                      for (let i = 0; i < binaryString.length; i++) {
                        encryptedBytes[i] = binaryString.charCodeAt(i);
                      }
                      const decryptedJson = await ChatCrypto.decryptMessage(
                        encryptedBytes,
                        tempKey,
                      );
                      const data: StreamedResponse = JSON.parse(decryptedJson);

                      if (data.text) {
                        text = data.text;
                      }
                      if (data.isComplete || data.errorStatus) {
                        clearTimeout(timeout);
                        cleanup();
                        if (data.errorStatus) {
                          reject(
                            new Error(
                              data.errorStatus.message ||
                                "Unknown search error",
                            ),
                          );
                        } else {
                          resolve(text);
                        }
                      }
                    } catch {
                      // Ignore errors
                    }
                  };

                  ws.onerror = () => {
                    clearTimeout(timeout);
                    if (!isSettled) {
                      cleanup();
                      reject(new Error("WebSocket connection error."));
                    }
                  };

                  ws.onclose = () => {
                    clearTimeout(timeout);
                    if (!isSettled) {
                      cleanup();
                      reject(new Error("WebSocket closed unexpectedly."));
                    }
                  };
                },
              );

              const safeText = accumulatedText.slice(0, 100000);
              const content = `Search Results for "${args.query}":\n\n${safeText}`;

              result = {
                tool_call_id: call.id,
                content,
                error: undefined,
              };
            } catch (e: unknown) {
              const errMsg = e instanceof Error ? e.message : String(e);
              console.error("Web search tool execution failed:", e);
              result = {
                tool_call_id: call.id,
                content: JSON.stringify({
                  error: `Web search failed: ${errMsg}`,
                }),
                error: errMsg,
              };
            }
            break;
          }
          default: {
            result = {
              tool_call_id: call.id,
              content: JSON.stringify({
                error: `The tool '${call.function.name}' is not recognized.`,
              }),
              error: `Tool '${call.function.name}' not found.`,
            };
            break;
          }
        }
        toolResults.push(result);
      }

      if (!assistantMessage.tool_results) {
        const storeParams = {
          chatId,
          assistantMessageId,
          results: toolResults.map((res) => ({
            tool_call_id: res.tool_call_id,
            content: res.content,
            error: res.error,
          })),
        };
        await UserApi.storeToolResults(
          authClient.getIdentity(),
          userCanisterId,
          storeParams,
        );
      }

      set((state) => {
        const messagesMap = new Map(state.messages[chatId]);
        const msgToUpdate = messagesMap.get(assistantMessageId as MessageId);
        if (msgToUpdate) {
          const updatedMessage: Message = {
            ...msgToUpdate,
            requires_client_action: false,
            tool_results: toolResults,
            updatedAt: new Date().toISOString(),
          };
          messagesMap.set(assistantMessageId as MessageId, updatedMessage);
          return { messages: { ...state.messages, [chatId]: messagesMap } };
        }
        return {};
      });

      if (
        get().queuedToolCalls.some(
          (c) =>
            c.assistantMessageId ===
            (assistantMessageId as unknown as MessageId),
        )
      ) {
        return;
      }

      const chosenNode = await pickNodeForModel(selectedModel.modelId);
      if (!chosenNode)
        throw new Error("No suitable node found for tool continuation.");
      if (!chosenNode.publicKey)
        throw new Error("Node public key required for continuation.");

      const toolResponsesForContinuation = toolResults.map((result) => ({
        tool_call_id: result.tool_call_id,
        content: result.content,
      }));

      const compiledPrompt = compileSystemPrompt(selectedModel);

      const chatKey = await ChatCrypto.deriveChatKey(
        rootKey,
        currentChat.encryptionSalt,
      );
      const encryptedChatKey = await ChatCrypto.wrapKeyForNode(
        chatKey,
        chosenNode.publicKey,
      );

      const continueParams = {
        chatId,
        assistantMessageId,
        responses: toolResponsesForContinuation,
        modelId: selectedModel.modelId,
        nodeId: Number(chosenNode.nodeId), // Convert branded NodeId to number for API
        temperature,
        maxCompletionTokens: maxOutput,
        maxContext: maxContext,
        encryptedChatKey,
        tools: selectedTools,
        customPrompt: compiledPrompt,
        reasoningEffort: reasoningEffort,
      };

      const result = await UserApi.continueFromToolResponse(
        authClient.getIdentity(),
        userCanisterId,
        continueParams,
      );

      const new_ai_message_id = toMessageId(
        fromBigInt(result.new_ai_message_id),
      );
      const job_id = toJobId(fromBigInt(result.job_id));

      const nowStr = new Date().toISOString();
      const newAssistantMessage: Message = {
        id: new_ai_message_id,
        backendId: new_ai_message_id,
        role: "assistant",
        content: "",
        parentMessageId: assistantMessageId as MessageId,
        chatId: chatId as ChatId,
        jobId: job_id,
        modelId: selectedModel.modelId,
        createdAt: nowStr,
        updatedAt: nowStr,
        isComplete: false,
      };

      set((state) => {
        const messagesMap = new Map(state.messages[chatId]);
        messagesMap.set(newAssistantMessage.id, newAssistantMessage);
        return { messages: { ...state.messages, [chatId]: messagesMap } };
      });

      setActiveLeaf(chatId as ChatId, newAssistantMessage.id);
      setActiveChatJob(chatId as ChatId, job_id);

      await connectToChainWebSocket(
        chatId as ChatId,
        job_id,
        chosenNode.address,
        chosenNode.nodeId,
        chosenNode.publicKey,
        undefined,
      );
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to run tools and continue conversation:", errorMsg);
      set((state) => {
        const messagesMap = state.messages[chatId];
        if (!messagesMap) return {};
        const msgToUpdate = messagesMap.get(assistantMessageId as MessageId);
        if (!msgToUpdate) return {};

        const updatedMessage: Message = {
          ...msgToUpdate,
          requires_client_action: false,
          errorStatus: {
            type: "Unknown" as const,
            message: errorMsg || "Tool execution failed.",
          },
        };
        const updatedMessagesMap = new Map(messagesMap);
        updatedMessagesMap.set(assistantMessageId as MessageId, updatedMessage);
        return {
          messages: { ...state.messages, [chatId]: updatedMessagesMap },
        };
      });
    } finally {
      set((state) => ({
        isProcessingTools: {
          ...state.isProcessingTools,
          [compositeKey]: false,
        },
      }));
    }
  },
});
