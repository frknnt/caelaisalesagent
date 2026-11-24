export interface LatencyProxyOptions {
  listenPort: number;
  targetPort: number;
  roundTripMs: number;
  /** Round trips before the first byte of a new connection. */
  setupRoundTrips: number;
  /** 0 is unlimited. */
  downKbps: number;
  upKbps: number;
}

/** Resolves with a function that stops the proxy. */
export function startLatencyProxy(
  options: LatencyProxyOptions,
): Promise<() => Promise<void>>;
