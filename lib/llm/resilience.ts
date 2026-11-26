import {
  callLlmGuarded,
  type GuardedLlmInput,
  type GuardedLlmResult,
} from "./guarded-call";

/**
 * Opens after `failureThreshold` consecutive transient failures and rejects
 * calls without reaching the provider until `cooldownMs` has passed. One
 * breaker per provider+model per process; it is a load shield, not a ledger.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 30_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  canCall() {
    if (this.openedAt === null) return true;
    if (this.now() - this.openedAt >= this.cooldownMs) {
      // Half-open: one probe. A failure reopens immediately.
      this.openedAt = null;
      this.failures = this.failureThreshold - 1;
      return true;
    }
    return false;
  }

  record(success: boolean) {
    if (success) {
      this.failures = 0;
      return;
    }
    this.failures += 1;
    if (this.failures >= this.failureThreshold) this.openedAt = this.now();
  }

  get isOpen() {
    return this.openedAt !== null;
  }
}

const TRANSIENT = new Set(["timeout", "rate_limited", "unavailable"]);

export interface ResilientOptions {
  maxAttempts: number;
  breaker: CircuitBreaker;
  /** Base delay; attempt n waits base * 2^(n-1), or the provider's hint. */
  backoffMs?: number;
  maxBackoffMs?: number;
  sleep?: ((ms: number) => Promise<void>) | undefined;
}

export type ResilientResult<Effect> =
  | GuardedLlmResult<Effect>
  | { status: "handoff"; reason: "circuit_open"; retryAfterMs: null };

/**
 * Retries transient failures only. Refusal, invalid output and budget are
 * final: retrying them would spend money for the same answer. The side effect
 * in `onCompleted` still runs at most once, after the attempt that succeeds.
 */
export async function callLlmResilient<Effect = void>(
  input: GuardedLlmInput<Effect>,
  options: ResilientOptions,
): Promise<ResilientResult<Effect>> {
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let last: GuardedLlmResult<Effect> | null = null;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    if (!options.breaker.canCall()) {
      return (
        last ?? {
          status: "handoff",
          reason: "circuit_open",
          retryAfterMs: null,
        }
      );
    }
    last = await callLlmGuarded({ ...input, attempt });
    const transient = last.status === "handoff" && TRANSIENT.has(last.reason);
    // Only provider health counts; a refusal or budget stop is not an outage.
    options.breaker.record(!transient);
    if (!transient) return last;
    if (attempt < options.maxAttempts && last.status === "handoff") {
      const base = (options.backoffMs ?? 250) * 2 ** (attempt - 1);
      const wait = Math.min(
        last.retryAfterMs ?? base,
        options.maxBackoffMs ?? 2_000,
      );
      await sleep(wait);
    }
  }
  return last as GuardedLlmResult<Effect>;
}
