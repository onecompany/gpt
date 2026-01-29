import { cn } from "@/utils/utils";

/**
 * Standard label style based on NodeWizard implementation.
 * Used for form field labels to ensure consistent typography and spacing.
 */
export const FORM_LABEL_CLASS =
  "block text-sm font-medium text-zinc-300 mb-1.5";

/**
 * Standard input style based on NodeWizard implementation.
 * Includes base styling, colors, spacing, and focus states.
 * Use with cn() to override properties (e.g. padding) if needed.
 */
export const FORM_INPUT_CLASS =
  "mt-0 block w-full px-3 py-2 rounded-md bg-zinc-800 text-sm text-zinc-200 placeholder-zinc-500  focus:ring-0 transition-colors disabled:opacity-50";

/**
 * Helper for select elements, adding appearance-none to remove native UI
 * while maintaining the standard input look.
 */
export const FORM_SELECT_CLASS = cn(FORM_INPUT_CLASS, "appearance-none");

/**
 * A smaller, uppercase label variant used in dense UIs like review grids.
 */
export const FORM_LABEL_SMALL_CLASS =
  "block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5";
