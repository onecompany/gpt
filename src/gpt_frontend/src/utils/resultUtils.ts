import { CanisterError } from "@candid/declarations/gpt_index.did";

// Helper type matching the structural shape of Candid results
// Supports both legacy {Ok: T} and modern {__kind__: 'Ok', value: T}
type ResultShape<T, E> =
  | { __kind__: "Ok"; value: T }
  | { __kind__: "Err"; value: E }
  | { Ok: T }
  | { Err: E };

/**
 * Generic helper to unwrap a Candid Result type.
 * Throws a standard Error if the result is an Err.
 * Accepts any object that structurally matches the Result pattern.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unwrapResult<T, E>(
  result: ResultShape<T, E> | any,
  errorFormatter: (err: E) => string = (e) => String(e),
): T {
  if (!result) throw new Error("Received null/undefined result from canister.");

  // Modern Candid (v2+ bindings)
  if ("__kind__" in result) {
    if (result.__kind__ === "Ok") {
      return result.value;
    }
    if (result.__kind__ === "Err") {
      throw new Error(errorFormatter(result.value));
    }
  }

  // Legacy Candid / Simple Variant
  if ("Ok" in result) {
    return result.Ok;
  }
  if ("Err" in result) {
    throw new Error(errorFormatter(result.Err));
  }

  // Fallback for unexpected structures
  console.error("Invalid result structure:", result);
  throw new Error("Invalid result format: Neither Ok nor Err present.");
}

export interface IcErrorDetail {
  title: string;
  message: string;
  isFatal: boolean;
}

const ERROR_CODE_MAP: Record<string, IcErrorDetail> = {
  // 1xx -- SysFatal (Fatal system errors)
  IC0101: {
    title: "System Overload",
    message: "The subnet is oversubscribed. Please try again later.",
    isFatal: false,
  },
  IC0102: {
    title: "Capacity Limit",
    message: "Maximum number of canisters reached on the subnet.",
    isFatal: true,
  },

  // 2xx -- SysTransient (Transient system errors - Retryable)
  IC0201: {
    title: "System Busy",
    message: "The canister queue is full. Please wait a moment and try again.",
    isFatal: false,
  },
  IC0202: {
    title: "Message Timeout",
    message: "The request timed out inside the ingress message queue.",
    isFatal: false,
  },
  IC0203: {
    title: "System Busy",
    message: "Canister queue is not empty. Please retry.",
    isFatal: false,
  },
  IC0204: {
    title: "System Busy",
    message: "Ingress history is full. Please retry.",
    isFatal: false,
  },
  IC0205: {
    title: "Conflict",
    message: "Canister ID already exists.",
    isFatal: false,
  },
  IC0206: {
    title: "Timeout",
    message: "Stop canister request timed out.",
    isFatal: false,
  },
  IC0207: {
    title: "Resource Exhausted",
    message: "The canister is out of cycles and cannot process requests.",
    isFatal: true,
  },
  IC0208: {
    title: "State Unavailable",
    message: "Certified state is currently unavailable.",
    isFatal: false,
  },
  IC0209: {
    title: "Rate Limited",
    message: "Install code rate limited.",
    isFatal: false,
  },
  IC0210: {
    title: "Rate Limited",
    message: "Heap delta rate limited.",
    isFatal: false,
  },

  // 3xx -- DestinationInvalid (Invalid destination errors - Fatal)
  IC0301: {
    title: "Not Found",
    message:
      "The target canister was not found. It may have been deleted or reclaimed.",
    isFatal: true,
  },
  IC0302: {
    title: "Method Not Found",
    message: "The canister does not have a method with that name.",
    isFatal: true,
  },
  IC0303: {
    title: "Invalid ID",
    message: "Canister ID is invalid.",
    isFatal: true,
  },
  IC0304: {
    title: "Resource Exhausted",
    message: "The canister has no resources.",
    isFatal: true,
  },
  IC0305: {
    title: "Snapshot Not Found",
    message: "The requested canister snapshot was not found.",
    isFatal: true,
  },

  // 4xx -- CanisterReject (Explicit reject errors - Fatal logic)
  IC0402: {
    title: "Allocation Error",
    message: "Insufficient memory allocation for canister.",
    isFatal: true,
  },
  IC0403: {
    title: "Insufficient Funds",
    message: "Insufficient cycles to create canister.",
    isFatal: true,
  },
  IC0404: {
    title: "Subnet Not Found",
    message: "The requested subnet was not found.",
    isFatal: true,
  },
  IC0405: {
    title: "Hosting Error",
    message: "Canister is not hosted by the subnet.",
    isFatal: true,
  },
  IC0406: {
    title: "Message Rejected",
    message: "The canister rejected the message explicitly.",
    isFatal: false, // Sometimes retryable if logic allows
  },

  // 5xx -- CanisterError (Runtime errors)
  IC0501: {
    title: "Canister Trapped",
    message: "The canister trapped during execution.",
    isFatal: false, // Logic bugs might be transient with different inputs
  },
  IC0502: {
    title: "Canister Trapped",
    message: "The canister encountered a runtime error (trap). Please retry.",
    isFatal: false,
  },
  IC0503: {
    title: "Canister Trapped",
    message: "The canister called trap explicitly.",
    isFatal: false,
  },
  IC0504: {
    title: "Contract Violation",
    message: "The canister violated the system contract.",
    isFatal: true,
  },
  IC0505: {
    title: "Invalid Configuration",
    message: "The canister code (Wasm) is invalid or missing.",
    isFatal: true,
  },
  IC0506: {
    title: "No Reply",
    message: "The canister did not produce a reply.",
    isFatal: false,
  },
  IC0507: {
    title: "Memory Exhausted",
    message: "The canister is out of memory.",
    isFatal: true,
  },
  IC0508: {
    title: "Maintenance Mode",
    message:
      "The system is currently stopped for maintenance. Please check back later.",
    isFatal: true,
  },
  IC0509: {
    title: "Stopping",
    message: "The system is currently shutting down.",
    isFatal: true,
  },
  IC0515: {
    title: "Input Error",
    message: "Arguments deserialization failed.",
    isFatal: true,
  },
  IC0516: {
    title: "Output Error",
    message: "Results serialization failed.",
    isFatal: true,
  },
  IC0537: {
    title: "Service Unavailable",
    message:
      "The system is currently undergoing scheduled maintenance. Please try again shortly.",
    isFatal: true,
  },

  // 6xx -- SysUnknown
  IC0601: {
    title: "Expired",
    message: "The request deadline expired.",
    isFatal: false,
  },

  // HTTP / Network Codes
  NET_403: {
    title: "Access Denied",
    message: "You do not have permission to access this resource.",
    isFatal: true,
  },
  NET_404: {
    title: "Not Found",
    message: "The requested resource could not be found.",
    isFatal: true,
  },
  NET_429: {
    title: "Too Many Requests",
    message: "You are being rate limited. Please slow down.",
    isFatal: false,
  },
  NET_502: {
    title: "Bad Gateway",
    message: "The server received an invalid response from an upstream server.",
    isFatal: false,
  },
  NET_503: {
    title: "Service Unavailable",
    message: "The service is temporarily unavailable.",
    isFatal: false,
  },
  NET_504: {
    title: "Gateway Timeout",
    message: "The server timed out waiting for a response.",
    isFatal: false,
  },
};

/**
 * Classifies setup errors to provide user-friendly messages for infrastructure issues.
 * Uses regex to detect IC error codes, HTTP status codes, and common error patterns.
 */
export function classifySetupError(error: unknown): IcErrorDetail {
  const errString = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errObj = error as any;

  // 1. Check for specific IC Error Code pattern (ICxxxx) in message
  const codeMatch = errString.match(/(IC\d{4})/);
  if (codeMatch && codeMatch[1]) {
    const code = codeMatch[1];
    if (ERROR_CODE_MAP[code]) {
      return ERROR_CODE_MAP[code];
    }
  }

  // 2. Check for Agent HTTP Status properties
  if (errObj?.status || errObj?.props?.status) {
    const status = errObj.status || errObj.props.status;
    const netCode = `NET_${status}`;
    if (ERROR_CODE_MAP[netCode]) {
      return ERROR_CODE_MAP[netCode];
    }
  }

  // 3. Fallback text matching
  if (errString.includes("no Wasm module")) {
    return ERROR_CODE_MAP["IC0505"];
  }
  if (errString.includes("stopped") || errString.includes("Canister stopped")) {
    return ERROR_CODE_MAP["IC0508"];
  }
  if (
    errString.includes("Connection refused") ||
    errString.includes("Network request failed") ||
    errString.includes("Failed to fetch")
  ) {
    return {
      title: "Network Error",
      message:
        "Could not connect to the Internet Computer. Please check your internet connection.",
      isFatal: false,
    };
  }
  if (errString.includes("Fail to verify certificate")) {
    return {
      title: "Security Error",
      message: "Failed to verify the response certificate. Potential MITM.",
      isFatal: true,
    };
  }

  // 4. Generic Cleanup
  let cleanMessage = errString;
  if (cleanMessage.includes("Reject text:")) {
    const parts = cleanMessage.split("Reject text:");
    if (parts.length > 1) {
      const afterText = parts[1];
      const errorCodeIndex = afterText.indexOf("Error code:");
      if (errorCodeIndex !== -1) {
        cleanMessage = afterText.substring(0, errorCodeIndex).trim();
      } else {
        cleanMessage = afterText.trim();
      }
    }
  }

  // Truncate ultra-long messages
  if (cleanMessage.length > 200) {
    cleanMessage = cleanMessage.substring(0, 197) + "...";
  }

  return {
    title: "Connection Error",
    message: cleanMessage || "An unknown error occurred during setup.",
    isFatal: false,
  };
}

export function formatCanisterError(error: CanisterError | unknown): string {
  if (!error || typeof error !== "object") return "Unknown error";
  const err = error as Record<string, unknown>;

  if ("UserNotFound" in err) return "User not found.";
  if ("ChatNotFound" in err) return "Chat not found.";
  if ("MessageNotFound" in err) return "Message not found.";
  if ("ModelNotFound" in err) return "Model not found.";
  if ("NodeNotFound" in err) return "Node not found.";
  if ("InvalidSecretKey" in err) return "Invalid secret key.";
  if ("Unauthorized" in err) return "Unauthorized access.";
  if ("InvalidInput" in err) return `Invalid input: ${err.InvalidInput}`;
  if ("GenerationInProgress" in err) return "Generation in progress.";
  if ("CallError" in err) return `Canister call error: ${err.CallError}`;
  if ("FileSystemLimitExceeded" in err)
    return `Storage limit exceeded: ${err.FileSystemLimitExceeded}`;
  if ("ItemNameCollision" in err)
    return `Name collision: ${err.ItemNameCollision}`;
  if ("FolderNotFound" in err) return "Folder not found.";
  if ("FileNotFound" in err) return "File not found.";
  if ("DeleteNonEmptyFolder" in err) return "Cannot delete a non-empty folder.";
  if ("CannotDeleteRootFolder" in err)
    return "The root folder cannot be deleted.";
  if ("InvalidPathDepth" in err) return "Maximum folder depth exceeded.";
  if ("UnsupportedMimeType" in err)
    return `Unsupported MIME type: ${err.UnsupportedMimeType}`;
  if ("PathNotFound" in err) return "The specified path does not exist.";
  if ("RoleAlreadyClaimed" in err)
    return "The manager role has already been claimed.";
  if ("Other" in err) return String(err.Other);

  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown canister error";
  }
}
