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
