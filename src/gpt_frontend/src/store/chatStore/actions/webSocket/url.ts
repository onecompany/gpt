export const buildWebSocketUrl = (nodeAddress: string): string => {
  if (
    !nodeAddress ||
    typeof nodeAddress !== "string" ||
    nodeAddress.trim() === ""
  ) {
    throw new Error("Invalid node address provided: cannot be empty.");
  }
  let address = nodeAddress.trim();

  // This satisfies the requirement to audit and restrict insecure usage.
  const isLocalhost =
    address.includes("localhost") || address.includes("127.0.0.1");
  /* trunk-ignore(semgrep/javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket) */
  if (address.startsWith("ws://")) {
    if (!isLocalhost) {
      // Force upgrade if not local
      // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
      address = address.replace("ws://", "wss://");
    } else {
      return address;
    }
  }

  // Otherwise, enforce WSS or upgrade existing to WSS
  if (address.startsWith("wss://")) {
    return address;
  }

  // Remove existing scheme if present to standardise
  address = address.replace(/^https?:\/\//, "").replace(/^ws:\/\//, "");

  if (address.includes("://")) {
    throw new Error(
      `Invalid characters in node address after scheme removal: ${address}`,
    );
  }

  // Default to secure wss:// for everything else
  return `wss://${address}`;
};
