import { Model } from "@/types";
import {
  CUSTOM_PROMPT_TEMPLATE,
  WEB_SEARCH_PROMPT_TEMPLATE,
} from "@/constants/prompts";

/**
 * Compiles the system prompt by injecting model-specific metadata and dynamic temporal context into the template.
 * @param model The model object selected for the chat.
 * @returns The fully formatted system prompt string.
 */
export const compileSystemPrompt = (model: Model): string => {
  const name = model.name || "AI Assistant";
  const maker = model.maker || "an advanced research lab";
  const provider = model.provider || "GPT Protocol";

  // Dynamic Time Calculation
  const now = new Date();
  const currentDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentTime = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const userTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  // Heuristic for training cutoff based on maker
  // This avoids hardcoding specific dates for every model but gives a reasonable baseline
  let trainingCutoff = "January 1, 2024";
  if (maker === "openai" || maker === "anthropic" || maker === "google") {
    trainingCutoff = "October 2023";
  } else if (maker === "meta" || maker === "mistral") {
    trainingCutoff = "December 2023";
  }

  return CUSTOM_PROMPT_TEMPLATE.replace(/{model_name}/g, name)
    .replace(/{model_maker}/g, maker)
    .replace(/{model_provider}/g, provider)
    .replace(/{current_date}/g, currentDate)
    .replace(/{current_time}/g, currentTime)
    .replace(/{user_timezone}/g, userTimezone)
    .replace(/{training_cutoff}/g, trainingCutoff);
};

/**
 * Compiles the web search prompt by injecting the current date and timezone.
 * @param query The user's search query.
 * @returns The fully formatted web search prompt string.
 */
export const compileWebSearchPrompt = (query: string): string => {
  const now = new Date();
  const currentDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentTime = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const userTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  return WEB_SEARCH_PROMPT_TEMPLATE.replace(/{current_date}/g, currentDate)
    .replace(/{current_time}/g, currentTime)
    .replace(/{user_timezone}/g, userTimezone)
    .replace(/{query}/g, query);
};
