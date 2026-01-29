/* import {
  env,
  FeatureExtractionPipeline,
  AutoModel,
  AutoTokenizer,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  type Tensor,
} from "@huggingface/transformers";
import MiniSearch from "minisearch";
import type {
  TextChunk,
  SentenceSpan,
  SearchableChunk,
  SearchResult,
} from "@/types";

const UNIVERSAL_STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "what",
  "when",
  "why",
  "how",
  "is",
  "it",
  "this",
  "that",
  "to",
  "in",
  "on",
]);

const tokenizeQuery = (query: string): string[] => {
  if (!query || typeof query !== "string") {
    return [];
  }
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    return Array.from(segmenter.segment(query))
      .filter((segment) => segment.isWordLike)
      .map((segment) => segment.segment.toLowerCase())
      .filter((term) => term.length > 2 && !UNIVERSAL_STOP_WORDS.has(term));
  } catch (e) {
    console.warn(
      "Intl.Segmenter not available, using regex fallback for tokenization.",
      e,
    );
    const matches = query.toLowerCase().match(/[a-z0-9]+/g);
    return matches
      ? matches.filter(
          (term) => term.length > 2 && !UNIVERSAL_STOP_WORDS.has(term),
        )
      : [];
  }
};

const MODEL_ID = "mixedbread-ai/mxbai-embed-xsmall-v1";
const CHUNK_SIZE_TOKENS = 1024;
const CHUNK_OVERLAP_TOKENS = 128;
const RRF_K = 60;
const MAX_DOCUMENT_TOKENS = 100000;
const QUANTIZATION_CONFIG = { dtype: "q8" as const };

const log = (message: string, ...args: unknown[]) =>
  console.log("[EmbeddingWorker]", new Date().toISOString(), message, ...args);

function configureEnvironment() {
  env.remoteHost = "https://internetcomputer.b-cdn.net/";
  env.remotePathTemplate = "{model}/resolve/{revision}/";
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  const wasmPath = new URL("/transformers/", self.location.origin).toString();

  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.wasmPaths = wasmPath;
    env.backends.onnx.wasm.simd = true;
    env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4;
    env.backends.onnx.wasm.proxy = true;
  }
  log("Hugging Face Transformers environment configured.");
}

const packFloats = (v: Float32Array): Uint8Array => {
  const out = new Uint8Array(Math.ceil(v.length / 8));
  for (let i = 0; i < v.length; i++) {
    if (v[i] > 0) {
      out[i >> 3] |= 1 << (i & 7);
    }
  }
  return out;
};

const lut = new Uint8Array(256).map((_, i) => {
  let c = 0,
    n = i;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
});

function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += lut[a[i] ^ b[i]];
  return d;
}

function rrfFuse<T extends string | number>(
  lists: { ids: T[]; weight: number }[],
  k: number,
): Map<T, number> {
  const out = new Map<T, number>();
  lists.forEach(({ ids, weight }) => {
    if (!weight) return;
    ids.forEach((id, rank) => {
      const add = weight * (1 / (k + rank + 1));
      out.set(id, (out.get(id) ?? 0) + add);
    });
  });
  return out;
}

interface ModelAndTokenizer {
  pipeline: FeatureExtractionPipeline;
  tokenizer: PreTrainedTokenizer;
  modelInfo: {
    isQuantized: boolean;
    dtype: string;
  };
}

interface ProgressInfo {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

async function initializeModel(
  progressCallback: (progress: ProgressInfo) => void,
): Promise<ModelAndTokenizer> {
  log(`Initializing optimized model: ${MODEL_ID}`);
  log(`CPU cores available: ${navigator.hardwareConcurrency || "unknown"}`);

  progressCallback({ status: "LOADING", file: "Tokenizer" });
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, {
    progress_callback: progressCallback,
  });
  log("Tokenizer initialized successfully.");

  progressCallback({
    status: "LOADING",
    file: `Quantized Model (${QUANTIZATION_CONFIG.dtype})`,
  });
  const model = await AutoModel.from_pretrained(MODEL_ID, {
    progress_callback: progressCallback,
    dtype: QUANTIZATION_CONFIG.dtype,
    device: "wasm",
  });
  log(`Model loaded with dtype: ${QUANTIZATION_CONFIG.dtype}`);

  const pipeline = new FeatureExtractionPipeline({
    task: "feature-extraction",
    model: model as PreTrainedModel,
    tokenizer: tokenizer as PreTrainedTokenizer,
  });
  log("Pipeline created successfully with CPU optimizations.");

  const modelInfo = {
    isQuantized: true,
    dtype: QUANTIZATION_CONFIG.dtype,
  };

  return { pipeline, tokenizer, modelInfo };
}

function createApproximateOffsetMappings(
  text: string,
  numTokens: number,
): [number, number][] {
  if (numTokens === 0) return [];
  const avgCharsPerToken = text.length / numTokens;
  const mappings: [number, number][] = [];
  for (let i = 0; i < numTokens; i++) {
    const start = Math.floor(i * avgCharsPerToken);
    const end = Math.floor((i + 1) * avgCharsPerToken);
    mappings.push([start, Math.min(end, text.length)]);
  }
  return mappings;
}

async function chunkAndEmbed(
  text: string,
  pipeline: FeatureExtractionPipeline,
  tokenizer: PreTrainedTokenizer,
  onProgress?: (progress: number, chunks: number) => void,
): Promise<(TextChunk & { text: string })[]> {
  log(`Starting to process document of length ${text.length}...`);
  const startTime = performance.now();

  if (!text) {
    log("WARN: Empty document provided. Returning empty chunks.");
    return [];
  }

  const encodings = await tokenizer(text, {
    return_offsets_mapping: true,
    add_special_tokens: false,
    use_fast: true,
  });

  const inputIds = encodings.input_ids;
  // Safely extract input IDs as array of numbers
  // This avoids `data as number[]` casting if input_ids is Tensor or similar
  const tokenIds = inputIds.data
    ? Array.from(inputIds.data as unknown as Int32Array)
    : [];

  let totalTokens = tokenIds.length;
  log(`Tokenized document into ${totalTokens} tokens.`);

  if (totalTokens > MAX_DOCUMENT_TOKENS) {
    log(`WARN: Document truncated to ${MAX_DOCUMENT_TOKENS} tokens.`);
    tokenIds.length = MAX_DOCUMENT_TOKENS;
    totalTokens = tokenIds.length;
  }
  if (totalTokens === 0) return [];

  // offset_mapping is returned as [number, number][]
  let offsetMappings: [number, number][] = encodings.offset_mapping;
  if (!offsetMappings || offsetMappings.length !== totalTokens) {
    log(
      "WARN: Invalid or missing offset mappings. Creating approximate mappings.",
    );
    offsetMappings = createApproximateOffsetMappings(text, totalTokens);
  }

  const stride = CHUNK_SIZE_TOKENS - CHUNK_OVERLAP_TOKENS;
  const chunks: (TextChunk & { text: string })[] = [];
  const sentenceSegmenter = new Intl.Segmenter(undefined, {
    granularity: "sentence",
  });
  log(`Beginning chunking process...`);

  const BATCH_SIZE = 4;
  const chunkPromises: Promise<(TextChunk & { text: string }) | null>[] = [];

  for (let i = 0; i < totalTokens; i += stride) {
    const processChunk = async () => {
      const chunkIndex = Math.floor(i / stride);
      const tokenChunkEnd = Math.min(i + CHUNK_SIZE_TOKENS, totalTokens);
      const tokenChunk = tokenIds.slice(i, tokenChunkEnd);
      if (tokenChunk.length === 0) return null;

      const offsetChunk = offsetMappings.slice(i, tokenChunkEnd);
      const startChar = Math.max(0, offsetChunk[0][0]);
      const endChar = Math.min(
        text.length,
        offsetChunk[offsetChunk.length - 1][1],
      );
      if (startChar >= endChar) return null;

      const decodedText = text.substring(startChar, endChar);
      if (!decodedText.trim()) return null;

      const sentences: SentenceSpan[] = Array.from(
        sentenceSegmenter.segment(decodedText),
      ).map((s) => ({
        start: s.index,
        end: s.index + s.segment.length,
      }));
      const t: Tensor = await pipeline(`passage: ${decodedText}`, {
        pooling: "mean",
        normalize: true,
      });
      const floatEmbedding = t.data as Float32Array;
      const binaryEmbedding = packFloats(floatEmbedding.slice(0, 384));

      return {
        chunk_index: chunkIndex,
        start_char: startChar,
        end_char: endChar,
        embedding: Array.from(binaryEmbedding),
        text: decodedText,
        sentences,
      };
    };
    chunkPromises.push(processChunk());

    if (chunkPromises.length >= BATCH_SIZE || i + stride >= totalTokens) {
      const results = await Promise.all(chunkPromises);
      results.forEach((chunk) => {
        if (chunk) chunks.push(chunk);
      });
      chunkPromises.length = 0;
      if (onProgress) {
        onProgress(Math.round((i / totalTokens) * 100), chunks.length);
      }
    }
  }

  const endTime = performance.now();
  log(
    `SUCCESS: Created ${chunks.length} chunks in ${((endTime - startTime) / 1000).toFixed(2)}s.`,
  );
  return chunks;
}

async function embedQuery(
  text: string,
  pipeline: FeatureExtractionPipeline,
): Promise<Uint8Array> {
  const t: Tensor = await pipeline(`query: ${text}`, {
    pooling: "mean",
    normalize: true,
  });
  return packFloats(t.data as Float32Array);
}

async function runHybridSearch(
  query: string,
  chunks: SearchableChunk[],
  pipeline: FeatureExtractionPipeline,
): Promise<SearchResult[]> {
  log(`[Search] Received query: "${query}" for ${chunks.length} chunks.`);

  const miniSearch = new MiniSearch({
    fields: ["text"],
    storeFields: ["text", "chunk_index", "fileId"],
    idField: "id",
    tokenize: (string) => tokenizeQuery(string),
    searchOptions: {
      boost: { text: 2 },
      fuzzy: 0.2,
      prefix: true,
      tokenize: (string) => tokenizeQuery(string),
    },
  });

  miniSearch.addAll(chunks);
  const keywordResults = miniSearch.search(query) ?? [];
  const keywordIDs = keywordResults.map((r) => r.id);
  log(`[Search] Keyword search found ${keywordResults.length} results.`);

  const queryEmbedding = await embedQuery(query, pipeline);
  const semanticResults = chunks
    .map((chunk) => ({
      id: chunk.id,
      distance: hammingDistance(
        queryEmbedding,
        new Uint8Array(chunk.embedding),
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 100);
  const semanticIDs = semanticResults.map((r) => r.id);
  log(
    `[Search] Semantic search completed with ${semanticResults.length} results.`,
  );

  const fusedMap = rrfFuse<string>(
    [
      { ids: keywordIDs.slice(0, 50), weight: 0.5 },
      { ids: semanticIDs.slice(0, 50), weight: 0.5 },
    ],
    RRF_K,
  );
  log(`[Search] Fused map contains ${fusedMap.size} unique items.`);

  const finalResults: SearchResult[] = [...fusedMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, rrf_score]) => {
      const chunk = chunks.find((c) => c.id === id);
      let contextText = chunk?.text ?? "";

      if (chunk?.text && chunk.sentences?.length) {
        const queryTokens = new Set(tokenizeQuery(query));
        let bestSentenceIndex = -1;
        let maxScore = -1;

        chunk.sentences.forEach((sentence, index) => {
          const sentenceText = chunk.text!.substring(
            sentence.start,
            sentence.end,
          );
          const score = tokenizeQuery(sentenceText).filter((token) =>
            queryTokens.has(token),
          ).length;
          if (score > maxScore) {
            maxScore = score;
            bestSentenceIndex = index;
          }
        });

        if (bestSentenceIndex !== -1) {
          const windowStart = Math.max(0, bestSentenceIndex - 1);
          const windowEnd = Math.min(
            chunk.sentences.length,
            bestSentenceIndex + 2,
          );
          const relevantSentences = chunk.sentences.slice(
            windowStart,
            windowEnd,
          );
          contextText = chunk.text.substring(
            relevantSentences[0].start,
            relevantSentences[relevantSentences.length - 1].end,
          );
        }
      }
      return { id, text: contextText, rrf_score };
    });

  log(`[Search] Returning ${finalResults.length} final ranked results.`);
  return finalResults;
}

log("Worker script loaded.");

let modelState: ModelAndTokenizer | null = null;
let lastLoggedPct = -1; // Track percentage for throttling

const progressCallback = (progress: ProgressInfo) => {
  const { status, file, progress: pct, loaded, total } = progress;
  let message: string | null = null;

  if (pct !== undefined && loaded !== undefined && total !== undefined) {
    const roundedPct = Math.floor(pct);
    // Only log if percentage changed significantly (20% steps), or first/last
    if (
      roundedPct !== lastLoggedPct &&
      (roundedPct % 20 === 0 || roundedPct >= 99 || roundedPct === 0)
    ) {
      lastLoggedPct = roundedPct;
      const loadedMB = (loaded / 1024 / 1024).toFixed(2);
      const totalMB = (total / 1024 / 1024).toFixed(2);
      message = `Downloading ${file}: ${pct.toFixed(1)}% (${loadedMB}MB / ${totalMB}MB)`;
    }
  } else {
    // Always log non-progress status updates (Initiating, Done, etc)
    message = `Loading ${file}… (${status})`;
  }

  if (message) {
    postMessage({ type: "status", payload: { status: "LOADING", message } });
  }
};

async function handleInitialization() {
  try {
    configureEnvironment();
    modelState = await initializeModel(progressCallback);
    postMessage({
      type: "status",
      payload: {
        status: "READY",
        message: `Model ready (${modelState.modelInfo.dtype} quantization, ${
          navigator.hardwareConcurrency || 4
        } threads)`,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log("ERROR during initialization:", error);
    postMessage({
      type: "status",
      payload: {
        status: "ERROR",
        message: `Initialization failed: ${errorMsg}`,
      },
    });
  }
}

async function handleFileEmbedding(fileContent: string, reqId: string) {
  if (!modelState) throw new Error("Model not initialized.");

  try {
    const onProgress = (progress: number, chunks: number) => {
      postMessage({ type: "progress", payload: { progress, chunks } });
    };
    const result = await chunkAndEmbed(
      fileContent,
      modelState.pipeline,
      modelState.tokenizer,
      onProgress,
    );
    postMessage({ type: "embed_result", payload: { result, reqId } });
  } catch (embedError: unknown) {
    const errorMsg =
      embedError instanceof Error ? embedError.message : String(embedError);
    postMessage({
      type: "embed_error",
      payload: {
        error: errorMsg || "Unknown embedding error",
        reqId,
      },
    });
  }
}

async function handleSearch(
  query: string,
  chunks: SearchableChunk[],
  reqId: string,
) {
  if (!modelState) throw new Error("Model not initialized.");

  try {
    const result = await runHybridSearch(query, chunks, modelState.pipeline);
    postMessage({ type: "embed_result", payload: { result, reqId } });
  } catch (searchError: unknown) {
    const errorMsg =
      searchError instanceof Error ? searchError.message : String(searchError);
    postMessage({
      type: "embed_error",
      payload: { error: errorMsg || "Unknown search error", reqId },
    });
  }
}

function handleGetModelInfo() {
  postMessage({
    type: "model_info",
    payload: modelState
      ? {
          ...modelState.modelInfo,
          modelSize: 0,
        }
      : null,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
self.addEventListener("message", async (e: MessageEvent<any>) => {
  const { type, payload } = e.data;
  try {
    switch (type) {
      case "initialize_model":
        await handleInitialization();
        break;
      case "embed_file_content":
        await handleFileEmbedding(payload.fileContent, payload.reqId);
        break;
      case "run_hybrid_search":
        await handleSearch(payload.query, payload.chunks, payload.reqId);
        break;
      case "get_model_info":
        handleGetModelInfo();
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    postMessage({
      type: "embed_error",
      payload: {
        error: errorMsg || "Unknown error",
        reqId: payload?.reqId,
      },
    });
  }
});
 */
