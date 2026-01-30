import { create } from "zustand";
import { TextChunk, SearchResult } from "@/types";

type EmbeddingStatus = "IDLE" | "LOADING" | "READY" | "ERROR";

type EmbedResultData = (TextChunk & { text: string })[];
type SearchResultData = SearchResult[];

// BM25 parameters (tuned for document search)
const BM25_K1 = 1.2;
const BM25_B = 0.75;

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

// Note: Semantic search and hybrid search (RRF fusion) are disabled for now.
// All search modes use BM25 text search only.

/**
 * Performs text-based search using BM25 algorithm.
 * Note: Semantic/hybrid search is disabled for now - all search modes use text search.
 */
async function textBasedSearch(
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

  // Keyword search scores using BM25
  const keywordScores = keywordSearch(
    queryTokens,
    tokenizedChunks,
    avgDocLength,
    docFrequencies,
  );

  console.log(
    `[EmbeddingStore] Text search: ${keywordScores.size} matches`,
  );

  // Add exact phrase match bonus (works for any language)
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery) {
    for (const [idx, score] of keywordScores.entries()) {
      const normalizedChunkText = normalizeText(chunks[idx].text);
      if (normalizedChunkText.includes(normalizedQuery)) {
        keywordScores.set(idx, score * 1.5); // 50% bonus for exact match
      }
    }
  }

  // Sort by score
  const sortedResults = [...keywordScores.entries()]
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
  statusMessage: "Text search ready (BM25 keyword matching).",
  lastError: null,

  initWorker: () => {
    // Embedding disabled for now - only text search available
    set({
      status: "READY",
      statusMessage: "Text search ready (BM25 keyword matching).",
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

    // Embedding generation disabled for now - only use text search
    console.log(
      `[EmbeddingStore] Created ${chunks.length} chunks for text search (embedding generation disabled)`,
    );
    onProgress?.(100, chunks.length);

    return chunks;
  },

  // All search methods now use text-based search (embedding disabled for now)
  runHybridSearch: async (
    query: string,
    chunks: EmbedResultData,
  ): Promise<SearchResultData> => {
    // Hybrid search disabled - falling back to text search
    console.log("[EmbeddingStore] Hybrid search disabled, using text search");
    return textBasedSearch(query, chunks);
  },

  runKeywordSearch: async (
    query: string,
    chunks: EmbedResultData,
  ): Promise<SearchResultData> => {
    return textBasedSearch(query, chunks);
  },

  runSemanticSearch: async (
    query: string,
    chunks: EmbedResultData,
  ): Promise<SearchResultData> => {
    // Semantic search disabled - falling back to text search
    console.log("[EmbeddingStore] Semantic search disabled, using text search");
    return textBasedSearch(query, chunks);
  },

  runSearch: async (
    query: string,
    chunks: EmbedResultData,
    mode: SearchMode,
  ): Promise<SearchResultData> => {
    // All modes use text search for now (embedding disabled)
    if (mode !== "text") {
      console.log(`[EmbeddingStore] Search mode "${mode}" requested, using text search instead`);
    }
    return textBasedSearch(query, chunks);
  },

  // Embedding is disabled for now
  isEmbeddingAvailable: (): boolean => {
    return false;
  },

  generateQueryEmbedding: async (): Promise<number[]> => {
    throw new Error("Embedding generation is disabled");
  },

  getModelInfo: async (): Promise<{
    dimension: number;
    modelId: string;
  } | null> => {
    // Embedding disabled for now
    return null;
  },

  resetWorker: () => {
    set({
      status: "READY",
      statusMessage: "Text search ready.",
      lastError: null,
    });
  },

  getWorkerHealth: () => {
    const { status, statusMessage, lastError } = get();
    return {
      isHealthy: status === "READY",
      details: `Status: ${status}, Mode: text search only, Message: ${statusMessage}${lastError ? `, Last error: ${lastError}` : ""}`,
    };
  },
}));
