import { Principal } from "@icp-sdk/core/principal";

/**
 * Converts a value to a Candid Optional variant ([] | [T]).
 * Robustly handles undefined/null by returning empty array.
 */
export function toOpt<T>(val: T | undefined | null): [] | [T] {
  return val !== undefined && val !== null ? [val] : [];
}

/**
 * Extracts a value from a Candid Optional variant ([] | [T]).
 * Handles cases where the binding might return T | undefined directly.
 */
export function fromOpt<T>(
  val: [] | [T] | T | undefined | null,
): T | undefined {
  if (val === undefined || val === null) return undefined;
  if (Array.isArray(val)) {
    return val.length > 0 ? val[0] : undefined;
  }
  return val as T;
}

/**
 * Safely converts a number or string to a BigInt.
 */
export function toBigInt(val: number | string): bigint {
  try {
    return BigInt(val);
  } catch {
    return BigInt(0);
  }
}

/**
 * Converts a BigInt (nat64/int64) to a string representation.
 */
export function fromBigInt(val: bigint | undefined | null): string {
  if (val === undefined || val === null) return "0";
  return val.toString();
}

/**
 * Safely converts a nanosecond timestamp (BigInt) to a millisecond timestamp (Number).
 */
export function fromTimestamp(nanoseconds: bigint | undefined | null): number {
  if (nanoseconds === undefined || nanoseconds === null) return 0;
  const divisor = BigInt(1000000);
  const milliseconds = nanoseconds / divisor;
  return Number(milliseconds);
}

/**
 * Converts a frontend Uint8Array or number array to a Uint8Array.
 */
export function toBlob(data: Uint8Array | number[]): Uint8Array {
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data);
}

/**
 * Serializes a float32 array (embeddings) to bytes for storage.
 * Each float32 value is converted to 4 bytes.
 */
export function serializeEmbedding(embedding: number[]): Uint8Array {
  if (!embedding || embedding.length === 0) return new Uint8Array(0);
  const float32Array = new Float32Array(embedding);
  return new Uint8Array(float32Array.buffer);
}

/**
 * Deserializes bytes back to a float32 array (embeddings).
 * Expects the byte length to be a multiple of 4.
 */
export function deserializeEmbedding(bytes: Uint8Array | number[]): number[] {
  const uint8 =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as number[]);
  if (uint8.length === 0) return [];
  // Ensure proper alignment for Float32Array (must be multiple of 4 bytes)
  if (uint8.length % 4 !== 0) {
    console.warn(
      "[deserializeEmbedding] Invalid byte length:",
      uint8.length,
      "- expected multiple of 4",
    );
    return [];
  }
  // Create a properly aligned Float32Array view
  const float32Array = new Float32Array(
    uint8.buffer,
    uint8.byteOffset,
    uint8.length / 4,
  );
  return Array.from(float32Array);
}

/**
 * Extracts the key from a Candid Variant object.
 */
export function getVariantKey<T extends object>(variant: T): keyof T {
  return Object.keys(variant)[0] as keyof T;
}

export function isPrincipal(val: unknown): val is Principal {
  return (
    !!val &&
    typeof val === "object" &&
    "_isPrincipal" in val &&
    (val as any)._isPrincipal === true
  );
}
