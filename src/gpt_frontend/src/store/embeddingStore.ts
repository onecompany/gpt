import { create } from "zustand";
import { TextChunk, SearchResult } from "@/types";
import {
  EmbeddingService,
  EmbeddingServiceError,
  EMBEDDING_DIMENSION,
} from "@/services/embeddingService";

type EmbeddingStatus = "IDLE" | "LOADING" | "READY" | "ERROR";

type EmbedResultData = (TextChunk & { text: string })[];
type SearchResultData = SearchResult[];

// BM25 parameters (tuned for document search)
const BM25_K1 = 1.2;
const BM25_B = 0.75;

// Hybrid search weights
const SEMANTIC_WEIGHT = 0.6; // Weight for embedding similarity
const KEYWORD_WEIGHT = 0.4; // Weight for BM25 keyword match

// RRF (Reciprocal Rank Fusion) constant
const RRF_K = 60;

const MAX_RESULTS = 20;

// Search modes available in the UI
export type SearchMode = "text" | "embedding" | "hybrid";

// ============================================================================
// Text Processing Utilities
// ============================================================================

/**
 * Normalize text for keyword matching.
 * Preserves Unicode word characters for multilingual support.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Remove punctuation but preserve Unicode letters and numbers
    // \p{L} = any letter, \p{N} = any number, \s = whitespace
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenize text into words for keyword search.
 * Supports multilingual text using Unicode-aware splitting.
 */
function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  // Split on whitespace and filter short tokens
  // For CJK languages, single characters can be meaningful, so we keep tokens of length >= 1
  return normalized.split(" ").filter((token) => token.length >= 1);
}

/**
 * Check if text contains CJK (Chinese/Japanese/Korean) characters.
 * CJK text doesn't use spaces between words, so tokenization works differently.
 */
function containsCJK(text: string): boolean {
  // CJK Unicode ranges
  return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text);
}

/**
 * Tokenize CJK text using n-gram approach.
 * Since CJK languages don't use spaces, we create overlapping character n-grams.
 */
function tokenizeCJK(text: string, ngramSize: number = 2): string[] {
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  if (normalized.length < ngramSize) return [normalized];

  const tokens: string[] = [];
  for (let i = 0; i <= normalized.length - ngramSize; i++) {
    tokens.push(normalized.substring(i, i + ngramSize));
  }
  // Also add single characters for better recall
  for (const char of normalized) {
    if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(char)) {
      tokens.push(char);
    }
  }
  return tokens;
}

/**
 * Smart tokenization that handles both Western and CJK text.
 */
function smartTokenize(text: string): string[] {
  if (containsCJK(text)) {
    // For CJK text, use n-gram tokenization
    return tokenizeCJK(text);
  }
  return tokenize(text);
}

function buildTermFrequencyMap(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

// ============================================================================
// BM25 Keyword Search
// ============================================================================

function calculateBM25Score(
  queryTokens: string[],
  chunkTokens: string[],
  chunkLength: number,
  avgDocLength: number,
  docFrequencies: Map<string, number>,
  totalDocs: number,
): number {
  const chunkTermFreq = buildTermFrequencyMap(chunkTokens);
  let score = 0;

  for (const queryTerm of queryTokens) {
    const tf = chunkTermFreq.get(queryTerm) || 0;
    if (tf === 0) continue;

    const df = docFrequencies.get(queryTerm) || 0;
    // IDF with smoothing
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);

    // BM25 term frequency normalization
    const tfNormalized =
      (tf * (BM25_K1 + 1)) /
      (tf + BM25_K1 * (1 - BM25_B + BM25_B * (chunkLength / avgDocLength)));

    score += idf * tfNormalized;
  }

  return score;
}

function keywordSearch(
  queryTokens: string[],
  tokenizedChunks: Array<{ tokens: string[]; index: number }>,
  avgDocLength: number,
  docFrequencies: Map<string, number>,
): Map<number, number> {
  const scores = new Map<number, number>();

  if (queryTokens.length === 0) {
    return scores; // Return empty map if no tokens
  }

  for (const { tokens, index } of tokenizedChunks) {
    const score = calculateBM25Score(
      queryTokens,
      tokens,
      tokens.length,
      avgDocLength,
      docFrequencies,
      tokenizedChunks.length,
    );
    if (score > 0) {
      scores.set(index, score);
    }
  }

  return scores;
}

// ============================================================================
// Semantic (Embedding) Search
// ============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
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
}

function hasValidEmbedding(embedding: number[] | undefined): boolean {
  if (!embedding || embedding.length === 0) return false;
  // Check if it's not all zeros
  return embedding.some((v) => v !== 0);
}

// Minimum similarity threshold for semantic search
// Lower threshold allows cross-language matches (e.g., English query on Chinese text)
// Raw cosine similarity of 0 maps to 0.5 after normalization
// Using 0.4 as threshold (raw similarity of -0.2) to catch semantic matches
const SEMANTIC_SIMILARITY_THRESHOLD = 0.4;

function semanticSearch(
  queryEmbedding: number[],
  chunks: EmbedResultData,
): Map<number, number> {
  const scores = new Map<number, number>();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!hasValidEmbedding(chunk.embedding)) continue;

    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
    // Normalize similarity from [-1, 1] to [0, 1]
    const normalizedScore = (similarity + 1) / 2;
    if (normalizedScore > SEMANTIC_SIMILARITY_THRESHOLD) {
      scores.set(i, normalizedScore);
    }
  }

  return scores;
}

// ============================================================================
// Hybrid Search with RRF Fusion
// ============================================================================

function reciprocalRankFusion(
  keywordScores: Map<number, number>,
  semanticScores: Map<number, number>,
  keywordWeight: number,
  semanticWeight: number,
): Map<number, number> {
  // Sort by score to get ranks
  const keywordRanks = new Map<number, number>();
  const sortedKeyword = [...keywordScores.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  sortedKeyword.forEach(([idx], rank) => keywordRanks.set(idx, rank + 1));

  const semanticRanks = new Map<number, number>();
  const sortedSemantic = [...semanticScores.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  sortedSemantic.forEach(([idx], rank) => semanticRanks.set(idx, rank + 1));

  // Combine all unique indices
  const allIndices = new Set([
    ...keywordScores.keys(),
    ...semanticScores.keys(),
  ]);

  const fusedScores = new Map<number, number>();

  for (const idx of allIndices) {
    let rrfScore = 0;

    // RRF contribution from keyword search
    if (keywordRanks.has(idx)) {
      const rank = keywordRanks.get(idx)!;
      rrfScore += keywordWeight / (RRF_K + rank);
    }

    // RRF contribution from semantic search
    if (semanticRanks.has(idx)) {
      const rank = semanticRanks.get(idx)!;
      rrfScore += semanticWeight / (RRF_K + rank);
    }

    fusedScores.set(idx, rrfScore);
  }

  return fusedScores;
}

async function hybridSearch(
  query: string,
  chunks: EmbedResultData,
): Promise<SearchResultData> {
  if (!query.trim() || chunks.length === 0) {
    return [];
  }

  // Use smart tokenization for multilingual support
  const queryTokens = smartTokenize(query);
  const isCJKQuery = containsCJK(query);

  // Pre-tokenize all chunks for keyword search using appropriate method
  const tokenizedChunks = chunks.map((chunk, index) => ({
    chunk,
    tokens: isCJKQuery ? smartTokenize(chunk.text) : tokenize(chunk.text),
    index,
  }));

  // Calculate document statistics
  const totalTokens = tokenizedChunks.reduce(
    (sum, tc) => sum + tc.tokens.length,
    0,
  );
  const avgDocLength = totalTokens / chunks.length || 1;

  // Build document frequency map
  const docFrequencies = new Map<string, number>();
  for (const { tokens } of tokenizedChunks) {
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      docFrequencies.set(term, (docFrequencies.get(term) || 0) + 1);
    }
  }

  // Keyword search scores (may be empty for some languages)
  const keywordScores = keywordSearch(
    queryTokens,
    tokenizedChunks,
    avgDocLength,
    docFrequencies,
  );

  // Check if any chunks have embeddings
  const hasEmbeddings = chunks.some((c) => hasValidEmbedding(c.embedding));
  const embeddingModelAvailable = EmbeddingService.isEmbeddingModelAvailable();

  let fusedScores: Map<number, number>;
  let semanticScores: Map<number, number> = new Map();

  // Always try semantic search if embeddings are available
  // This is crucial for multilingual search where keyword matching may fail
  if (hasEmbeddings && embeddingModelAvailable) {
    try {
      // Generate query embedding
      const queryEmbedding = await EmbeddingService.generateEmbedding(query);

      // Semantic search scores
      semanticScores = semanticSearch(queryEmbedding, chunks);

      console.log(
        `[EmbeddingStore] Hybrid search: ${keywordScores.size} keyword matches, ${semanticScores.size} semantic matches`,
      );

      // Determine search strategy based on results
      if (keywordScores.size === 0 && semanticScores.size > 0) {
        // No keyword matches but have semantic matches - use semantic only
        // This handles cross-language search (e.g., English query on Chinese content)
        console.log(
          `[EmbeddingStore] Using semantic-only search (no keyword matches)`,
        );
        fusedScores = semanticScores;
      } else if (keywordScores.size > 0 && semanticScores.size === 0) {
        // Keyword matches only - use those
        console.log(
          `[EmbeddingStore] Using keyword-only search (no semantic matches)`,
        );
        fusedScores = keywordScores;
      } else if (keywordScores.size > 0 && semanticScores.size > 0) {
        // Both have results - fuse them using RRF
        fusedScores = reciprocalRankFusion(
          keywordScores,
          semanticScores,
          KEYWORD_WEIGHT,
          SEMANTIC_WEIGHT,
        );
      } else {
        // No results from either - return empty
        fusedScores = new Map();
      }
    } catch (error) {
      console.warn(
        "[EmbeddingStore] Failed to generate query embedding, falling back to keyword-only search:",
        error,
      );
      // Fall back to keyword-only search
      fusedScores = keywordScores;
    }
  } else {
    // No embeddings available, use keyword-only search
    fusedScores = keywordScores;
    console.log(
      `[EmbeddingStore] Keyword-only search: ${keywordScores.size} matches (embeddings: ${hasEmbeddings}, model: ${embeddingModelAvailable})`,
    );
  }

  // Add exact phrase match bonus (works for any language)
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery) {
    for (const [idx, score] of fusedScores.entries()) {
      const normalizedChunkText = normalizeText(chunks[idx].text);
      if (normalizedChunkText.includes(normalizedQuery)) {
        fusedScores.set(idx, score * 1.5); // 50% bonus for exact match
      }
    }
  }

  // Sort by fused score
  const sortedResults = [...fusedScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_RESULTS);

  // Normalize scores to 0-1 range
  const maxScore = sortedResults[0]?.[1] || 1;

  return sortedResults.map(([idx, score]) => {
    const chunk = chunks[idx];
    return {
      id:
        "id" in chunk
          ? (chunk as unknown as { id: string }).id
          : `chunk-${chunk.chunk_index}`,
      text: chunk.text,
      rrf_score: score / maxScore,
    };
  });
}

// ============================================================================
// Store Definition
// ============================================================================

interface EmbeddingState {
  status: EmbeddingStatus;
  statusMessage: string;
  lastError: string | null;

  initWorker: () => void;
  embedFileContent: (
    fileContent: string,
    onProgress?: (progress: number, chunks: number) => void,
  ) => Promise<EmbedResultData>;
  runHybridSearch: (
    query: string,
    chunks: EmbedResultData,
  ) => Promise<SearchResultData>;
  runKeywordSearch: (
    query: string,
    chunks: EmbedResultData,
  ) => Promise<SearchResultData>;
  runSemanticSearch: (
    query: string,
    chunks: EmbedResultData,
  ) => Promise<SearchResultData>;
  runSearch: (
    query: string,
    chunks: EmbedResultData,
    mode: SearchMode,
  ) => Promise<SearchResultData>;
  generateQueryEmbedding: (query: string) => Promise<number[]>;
  resetWorker: () => void;
  getWorkerHealth: () => { isHealthy: boolean; details: string };
  getModelInfo: () => Promise<{ dimension: number; modelId: string } | null>;
  isEmbeddingAvailable: (chunks: EmbedResultData) => boolean;
}

export const useEmbeddingStore = create<EmbeddingState>((set, get) => ({
  status: "READY",
  statusMessage: "Search ready (hybrid keyword + semantic when available).",
  lastError: null,

  initWorker: () => {
    const isAvailable = EmbeddingService.isEmbeddingModelAvailable();
    set({
      status: "READY",
      statusMessage: isAvailable
        ? "Hybrid search ready (keyword + semantic)."
        : "Keyword search ready (embedding model not available).",
      lastError: null,
    });
  },

  embedFileContent: async (
    fileContent: string,
    onProgress?: (progress: number, chunks: number) => void,
  ): Promise<EmbedResultData> => {
    if (!fileContent) {
      throw new Error("File content is empty");
    }

    if (fileContent.length > 10 * 1024 * 1024) {
      throw new Error("File content exceeds 10MB limit");
    }

    // Chunk parameters matching fileProcessingService
    const CHUNK_SIZE = 8000;
    const CHUNK_OVERLAP = 500;

    const chunks: EmbedResultData = [];
    let startChar = 0;
    let chunkIndex = 0;

    // Create chunks
    while (startChar < fileContent.length) {
      const endChar = Math.min(startChar + CHUNK_SIZE, fileContent.length);
      const text = fileContent.substring(startChar, endChar);

      chunks.push({
        chunk_index: chunkIndex,
        start_char: startChar,
        end_char: endChar,
        embedding: [], // Will be filled if embedding model available
        text,
      });

      chunkIndex++;
      const nextStart = endChar - CHUNK_OVERLAP;
      startChar = Math.max(endChar, nextStart);
      if (startChar >= fileContent.length) break;
    }

    // Handle very short content
    if (chunks.length === 0 && fileContent.length > 0) {
      chunks.push({
        chunk_index: 0,
        start_char: 0,
        end_char: fileContent.length,
        embedding: [],
        text: fileContent,
      });
    }

    // Generate embeddings if model available
    if (EmbeddingService.isEmbeddingModelAvailable()) {
      console.log(
        `[EmbeddingStore] Generating embeddings for ${chunks.length} chunks...`,
      );

      const texts = chunks.map((c) => c.text);
      try {
        const embeddings = await EmbeddingService.generateEmbeddings(
          texts,
          3,
          (completed, total) => {
            onProgress?.(Math.round((completed / total) * 100), completed);
          },
        );

        for (let i = 0; i < chunks.length; i++) {
          chunks[i].embedding = embeddings[i];
        }

        console.log(
          `[EmbeddingStore] Successfully generated ${embeddings.length} embeddings`,
        );
      } catch (error) {
        console.error("[EmbeddingStore] Failed to generate embeddings:", error);
        set({
          lastError:
            error instanceof EmbeddingServiceError
              ? error.message
              : "Failed to generate embeddings",
        });
        // Continue with empty embeddings - keyword search will still work
      }
    } else {
      console.log(
        "[EmbeddingStore] Embedding model not available, skipping embedding generation",
      );
      // Report progress completion even without embeddings
      onProgress?.(100, chunks.length);
    }

    return chunks;
  },

  runHybridSearch: async (
    query: string,
    chunks: EmbedResultData,
  ): Promise<SearchResultData> => {
    if (!query || !query.trim()) {
      return [];
    }

    if (!chunks || chunks.length === 0) {
      return [];
    }

    return hybridSearch(query, chunks);
  },

  runKeywordSearch: async (
    query: string,
    chunks: EmbedResultData,
  ): Promise<SearchResultData> => {
    if (!query || !query.trim() || !chunks || chunks.length === 0) {
      return [];
    }

    const queryTokens = smartTokenize(query);
    const isCJKQuery = containsCJK(query);

    const tokenizedChunks = chunks.map((chunk, index) => ({
      chunk,
      tokens: isCJKQuery ? smartTokenize(chunk.text) : tokenize(chunk.text),
      index,
    }));

    const totalTokens = tokenizedChunks.reduce(
      (sum, tc) => sum + tc.tokens.length,
      0,
    );
    const avgDocLength = totalTokens / chunks.length || 1;

    const docFrequencies = new Map<string, number>();
    for (const { tokens } of tokenizedChunks) {
      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        docFrequencies.set(term, (docFrequencies.get(term) || 0) + 1);
      }
    }

    const keywordScores = keywordSearch(
      queryTokens,
      tokenizedChunks,
      avgDocLength,
      docFrequencies,
    );

    // Add exact phrase match bonus
    const normalizedQuery = normalizeText(query);
    if (normalizedQuery) {
      for (const [idx, score] of keywordScores.entries()) {
        const normalizedChunkText = normalizeText(chunks[idx].text);
        if (normalizedChunkText.includes(normalizedQuery)) {
          keywordScores.set(idx, score * 1.5);
        }
      }
    }

    const sortedResults = [...keywordScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_RESULTS);

    const maxScore = sortedResults[0]?.[1] || 1;

    console.log(
      `[EmbeddingStore] Keyword-only search: ${sortedResults.length} matches`,
    );

    return sortedResults.map(([idx, score]) => {
      const chunk = chunks[idx];
      return {
        id:
          "id" in chunk
            ? (chunk as unknown as { id: string }).id
            : `chunk-${chunk.chunk_index}`,
        text: chunk.text,
        rrf_score: score / maxScore,
      };
    });
  },

  runSemanticSearch: async (
    query: string,
    chunks: EmbedResultData,
  ): Promise<SearchResultData> => {
    if (!query || !query.trim() || !chunks || chunks.length === 0) {
      return [];
    }

    const hasEmbeddings = chunks.some((c) => hasValidEmbedding(c.embedding));
    const embeddingModelAvailable = EmbeddingService.isEmbeddingModelAvailable();

    if (!hasEmbeddings || !embeddingModelAvailable) {
      console.log(
        `[EmbeddingStore] Semantic search unavailable (embeddings: ${hasEmbeddings}, model: ${embeddingModelAvailable})`,
      );
      return [];
    }

    try {
      const queryEmbedding = await EmbeddingService.generateEmbedding(query);
      const semanticScores = semanticSearch(queryEmbedding, chunks);

      const sortedResults = [...semanticScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_RESULTS);

      const maxScore = sortedResults[0]?.[1] || 1;

      console.log(
        `[EmbeddingStore] Semantic-only search: ${sortedResults.length} matches`,
      );

      return sortedResults.map(([idx, score]) => {
        const chunk = chunks[idx];
        return {
          id:
            "id" in chunk
              ? (chunk as unknown as { id: string }).id
              : `chunk-${chunk.chunk_index}`,
          text: chunk.text,
          rrf_score: score / maxScore,
        };
      });
    } catch (error) {
      console.error("[EmbeddingStore] Semantic search failed:", error);
      return [];
    }
  },

  runSearch: async (
    query: string,
    chunks: EmbedResultData,
    mode: SearchMode,
  ): Promise<SearchResultData> => {
    switch (mode) {
      case "text":
        return get().runKeywordSearch(query, chunks);
      case "embedding":
        return get().runSemanticSearch(query, chunks);
      case "hybrid":
      default:
        return get().runHybridSearch(query, chunks);
    }
  },

  isEmbeddingAvailable: (chunks: EmbedResultData): boolean => {
    const hasEmbeddings = chunks.some((c) => hasValidEmbedding(c.embedding));
    const modelAvailable = EmbeddingService.isEmbeddingModelAvailable();
    return hasEmbeddings && modelAvailable;
  },

  generateQueryEmbedding: async (query: string): Promise<number[]> => {
    if (!EmbeddingService.isEmbeddingModelAvailable()) {
      throw new EmbeddingServiceError(
        "Embedding model not available",
        "MODEL_UNAVAILABLE",
      );
    }
    return EmbeddingService.generateEmbedding(query);
  },

  getModelInfo: async (): Promise<{
    dimension: number;
    modelId: string;
  } | null> => {
    try {
      const model = EmbeddingService.getEmbeddingModel();
      return {
        dimension: EMBEDDING_DIMENSION,
        modelId: model.modelId,
      };
    } catch {
      return null;
    }
  },

  resetWorker: () => {
    set({
      status: "READY",
      statusMessage: "Search ready.",
      lastError: null,
    });
  },

  getWorkerHealth: () => {
    const { status, statusMessage, lastError } = get();
    const isAvailable = EmbeddingService.isEmbeddingModelAvailable();
    return {
      isHealthy: status === "READY",
      details: `Status: ${status}, Embedding model: ${isAvailable ? "available" : "unavailable"}, Message: ${statusMessage}${lastError ? `, Last error: ${lastError}` : ""}`,
    };
  },
}));
