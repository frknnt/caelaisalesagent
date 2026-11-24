export class NetworkBlockedError extends Error {
  readonly code: "NETWORK_BLOCKED";
}

export function installNetworkGuard(options?: {
  allowLoopback?: boolean;
  onBlocked?: (target: string) => void;
}): () => void;
