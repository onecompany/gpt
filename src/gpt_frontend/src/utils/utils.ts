import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names with support for conditional logic (clsx)
 * and Tailwind CSS conflict resolution (tailwind-merge).
 *
 * @param inputs - A variable list of class values (strings, objects, arrays).
 * @returns A single string with resolved class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
