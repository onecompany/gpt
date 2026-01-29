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

export const tokenizeQuery = (query: string): string[] => {
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
