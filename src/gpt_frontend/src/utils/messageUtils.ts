import { MessageErrorStatus } from "@/types";

export function formatErrorStatus(errorStatus?: MessageErrorStatus): string {
  if (!errorStatus) return "";
  switch (errorStatus.type) {
    case "Timeout":
      return "Generation timed out. Please try again.";
    case "NodeOffline":
      return "The assigned node seems to be offline. Please try again.";
    case "ProviderError":
      switch (errorStatus.details?.type) {
        case "RateLimited":
          return "Rate limit reached with the AI provider. Please try again later.";
        case "AuthenticationError":
          return "AI provider authentication failed. This could be due to an invalid API key on the node or other provider-side authentication issues. Please create an issue on GitHub if this persists.";
        case "ServerError":
          return "The AI provider encountered a server error. Please try again.";
        case "ServiceUnavailable":
          return "The AI service is temporarily unavailable (503). Please try again in a moment.";
        case "BadRequest":
          return "The request to the AI provider was invalid. Please check your input or settings.";
        case "ContextLengthExceeded":
          return "The conversation is too long for this model. Please start a new chat or select a model with a larger context window.";
        case "ContentPolicyViolation":
          return "The request was rejected due to the AI provider's content policy. Please modify your prompt.";
        case "NetworkError":
          return "Network error connecting to the AI provider. Please check your connection and try again.";
        case "Timeout":
          return "Timed out waiting for a response from the AI provider.";
        case "InvalidImage":
          return `The provider rejected an image: ${errorStatus.details.message}`;
        case "Unknown":
          return `Provider error: ${errorStatus.details.message}`;
        default:
          return "An unknown provider error occurred.";
      }
    case "CanisterCallError":
      return `Error communicating with backend canisters: ${errorStatus.message}`;
    case "InvalidState":
      return `An internal state error occurred: ${errorStatus.message}`;
    case "ConfigurationError":
      return `Node configuration error: ${errorStatus.message}`;
    case "Unknown":
      return `An unknown error occurred during generation: ${errorStatus.message}`;
    default:
      return "An unexpected error occurred.";
  }
}

export function dataToSrc(
  mimeType: string,
  data: Uint8Array | number[],
): string {
  const byteArray = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  const len = byteArray.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(byteArray[i]);
  }
  const base64 = window.btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}
