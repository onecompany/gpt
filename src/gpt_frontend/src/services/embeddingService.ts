/**
 * Embedding Service
 *
 * Handles generating embeddings via the backend embedding model.
 * Uses the same WebSocket infrastructure as chat/OCR but returns
 * embedding vectors instead of text.
 */

import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import {
  useModelsStore,
  DEFAULT_EMBEDDING_MODEL_ID,
} from "@/store/modelsStore";
import { UserApi } from "@/services/api/userApi";
import { ChatCrypto } from "@/utils/crypto/chat";
import { fromBigInt } from "@/utils/candidUtils";
import { toChatId, toJobId } from "@/types/brands";

// Maximum text length for a single embedding request (Qwen3 has 32k token context)
// Using ~30k chars to be safe with tokenization
const MAX_EMBEDDING_INPUT_LENGTH = 30000;

// Embedding dimension for Qwen3-Embedding-8B
export const EMBEDDING_DIMENSION = 1024;

export class EmbeddingServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MODEL_UNAVAILABLE"
      | "AUTH_REQUIRED"
      | "NODE_UNAVAILABLE"
      | "GENERATION_FAILED"
      | "TIMEOUT"
      | "INPUT_TOO_LONG",
  ) {
    super(message);
    this.name = "EmbeddingServiceError";
  }
}

export const EmbeddingService = {
  /**
   * Check if the embedding model is available.
   */
  isEmbeddingModelAvailable: (): boolean => {
    return useModelsStore.getState().isEmbeddingModelAvailable();
  },

  /**
   * Get the embedding model or throw if unavailable.
   */
  getEmbeddingModel: () => {
    const model = useModelsStore.getState().getEmbeddingModel();
    if (!model) {
      throw new EmbeddingServiceError(
        `Embedding model (${DEFAULT_EMBEDDING_MODEL_ID}) is not available. Please ensure an embedding node is online.`,
        "MODEL_UNAVAILABLE",
      );
    }
    return model;
  },

  /**
   * Generate an embedding for the given text.
   *
   * @param text - The text to embed (max ~30k characters)
   * @returns The embedding vector as number[]
   * @throws EmbeddingServiceError if generation fails
   */
  generateEmbedding: async (text: string): Promise<number[]> => {
    // Validate input length
    if (text.length > MAX_EMBEDDING_INPUT_LENGTH) {
      throw new EmbeddingServiceError(
        `Input text too long (${text.length} chars). Maximum is ${MAX_EMBEDDING_INPUT_LENGTH} chars.`,
        "INPUT_TOO_LONG",
      );
    }

    if (!text.trim()) {
      // Return zero vector for empty text
      return new Array(EMBEDDING_DIMENSION).fill(0);
    }

    // Check authentication
    const { authClient, userCanisterId, rootKey } = useAuthStore.getState();
    if (!authClient || !userCanisterId || !rootKey) {
      throw new EmbeddingServiceError(
        "User is not authenticated or Vault is locked.",
        "AUTH_REQUIRED",
      );
    }

    // Get embedding model
    const model = EmbeddingService.getEmbeddingModel();

    // Get chat store functions
    const { pickNodeForModel, connectToChainWebSocket, addOcrPromise } =
      useChatStore.getState();

    // Pick a node for the embedding model
    const chosenNode = await pickNodeForModel(model.modelId);
    if (!chosenNode) {
      throw new EmbeddingServiceError(
        `No available node for embedding model ${model.modelId}.`,
        "NODE_UNAVAILABLE",
      );
    }
    if (!chosenNode.publicKey) {
      throw new EmbeddingServiceError(
        "Embedding node missing public key for encryption.",
        "NODE_UNAVAILABLE",
      );
    }

    // Generate Salt and Key for Temp Chat
    const chatSalt = ChatCrypto.generateSalt();
    const chatKey = await ChatCrypto.deriveChatKey(rootKey, chatSalt);

    // Encrypt the text to embed (sent as user message)
    const encryptedText = await ChatCrypto.encryptMessage(text, chatKey);

    // Encrypt Key for Node
    const encryptedChatKey = await ChatCrypto.wrapKeyForNode(
      chatKey,
      chosenNode.publicKey,
    );

    // Create temporary chat with the embedding request
    const createParams = {
      title: "Temporary Embedding Chat",
      initialMessage: new Uint8Array(encryptedText),
      modelId: model.modelId,
      nodeId: Number(chosenNode.nodeId),
      temperature: 0, // Not used for embeddings
      maxCompletionTokens: 0, // Not used for embeddings
      maxContext: model.maxContext,
      encryptedChatKey: encryptedChatKey,
      encryptionSalt: new Uint8Array(chatSalt),
      attachments: [],
      tools: [],
      customPrompt: undefined,
      temporary: true,
    };

    const result = await UserApi.createChat(
      authClient.getIdentity(),
      userCanisterId,
      createParams,
    );

    const tempChatId = toChatId(fromBigInt(result.chat_id));
    const tempJobId = toJobId(fromBigInt(result.job_id));

    // Create a promise that will be resolved by the WebSocket message handler
    return new Promise<number[]>((resolve, reject) => {
      // Set up a timeout (embeddings should be fast, 60s timeout)
      const timeout = setTimeout(() => {
        useChatStore.getState().removeOcrPromise(tempJobId);
        reject(
          new EmbeddingServiceError(
            "Embedding request timed out after 60 seconds.",
            "TIMEOUT",
          ),
        );
      }, 60_000);

      // Wrap resolve/reject to parse JSON and clear timeout
      const wrappedResolve = (value: string) => {
        clearTimeout(timeout);
        try {
          // The backend returns embedding as JSON array in the text field
          const embedding = JSON.parse(value) as number[];
          if (!Array.isArray(embedding)) {
            throw new Error("Invalid embedding format: expected array");
          }
          resolve(embedding);
        } catch (e) {
          reject(
            new EmbeddingServiceError(
              `Failed to parse embedding response: ${e instanceof Error ? e.message : String(e)}`,
              "GENERATION_FAILED",
            ),
          );
        }
      };

      const wrappedReject = (reason?: unknown) => {
        clearTimeout(timeout);
        if (reason instanceof EmbeddingServiceError) {
          reject(reason);
        } else {
          reject(
            new EmbeddingServiceError(
              `Embedding generation failed: ${reason instanceof Error ? reason.message : String(reason)}`,
              "GENERATION_FAILED",
            ),
          );
        }
      };

      // Register the promise - this will be resolved by messageHandler
      // (reusing the OCR promise infrastructure since the flow is identical)
      addOcrPromise(tempJobId, wrappedResolve, wrappedReject);

      // Connect using the proper encrypted WebSocket infrastructure
      void connectToChainWebSocket(
        tempChatId,
        tempJobId,
        chosenNode.address,
        chosenNode.nodeId,
        chosenNode.publicKey,
        { encryptionSalt: chatSalt },
      );
    });
  },

  /**
   * Generate embeddings for multiple texts in batch.
   * Processes in parallel with concurrency limit.
   *
   * @param texts - Array of texts to embed
   * @param concurrency - Max concurrent requests (default 3)
   * @param onProgress - Optional progress callback
   * @returns Array of embeddings in the same order as input
   */
  generateEmbeddings: async (
    texts: string[],
    concurrency: number = 3,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<number[][]> => {
    const results: number[][] = new Array(texts.length);
    let completed = 0;

    // Process in batches with concurrency limit
    for (let i = 0; i < texts.length; i += concurrency) {
      const batch = texts.slice(i, i + concurrency);
      const batchPromises = batch.map(async (text, batchIdx) => {
        const globalIdx = i + batchIdx;
        try {
          const embedding = await EmbeddingService.generateEmbedding(text);
          results[globalIdx] = embedding;
        } catch (error) {
          console.error(
            `[EmbeddingService] Failed to embed text ${globalIdx}:`,
            error,
          );
          // Return zero vector on failure
          results[globalIdx] = new Array(EMBEDDING_DIMENSION).fill(0);
        }
        completed++;
        onProgress?.(completed, texts.length);
      });

      await Promise.all(batchPromises);
    }

    return results;
  },

  /**
   * Calculate cosine similarity between two embeddings.
   */
  cosineSimilarity: (a: number[], b: number[]): number => {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  },
};
