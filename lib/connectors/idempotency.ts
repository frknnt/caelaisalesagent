import { createHash } from "node:crypto";

export type IdempotencyClaim<Result> =
  | { state: "started" }
  | { state: "completed"; result: Result }
  | { state: "in_progress" }
  | { state: "conflict" };

/** P2.7 backs this with a durable table. Claims must be atomic there. */
export interface IdempotencyStore {
  claim<Result>(
    key: string,
    fingerprint: string,
  ): Promise<IdempotencyClaim<Result>>;
  complete<Result>(key: string, result: Result): Promise<void>;
  release(key: string): Promise<void>;
}

export interface IdempotentOperation<Result> {
  organizationId: string;
  operation: string;
  key: string;
  input: unknown;
  run: () => Promise<Result>;
}

export type IdempotentResult<Result> =
  | { status: "executed"; result: Result }
  | { status: "duplicate"; result: Result }
  | { status: "in_progress" }
  | { status: "conflict" };

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([key, entry]) => [key, canonical(entry)]),
  );
}

function fingerprintOf(input: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(input)) ?? "undefined")
    .digest("hex");
}

/**
 * Runs an operation once per tenant, operation and key. A failed run releases
 * its claim so the same key can be retried; the receiver sees that same key.
 */
export async function executeOnce<Result>(
  store: IdempotencyStore,
  { organizationId, operation, key, input, run }: IdempotentOperation<Result>,
): Promise<IdempotentResult<Result>> {
  // JSON keeps the three parts unambiguous, so tenants cannot collide.
  const scopedKey = JSON.stringify([organizationId, operation, key]);
  const claim = await store.claim<Result>(scopedKey, fingerprintOf(input));
  if (claim.state === "completed") {
    return { status: "duplicate", result: claim.result };
  }
  if (claim.state !== "started") return { status: claim.state };

  let result: Result;
  try {
    result = await run();
  } catch (error) {
    await store.release(scopedKey);
    throw error;
  }
  await store.complete(scopedKey, result);
  return { status: "executed", result };
}

/** Process-local store for tests and the harness. Not durable. */
export function createMemoryIdempotencyStore(): IdempotencyStore {
  const entries = new Map<
    string,
    { fingerprint: string; completed: boolean; result: unknown }
  >();
  return {
    async claim<Result>(
      key: string,
      fingerprint: string,
    ): Promise<IdempotencyClaim<Result>> {
      const entry = entries.get(key);
      if (!entry) {
        entries.set(key, { fingerprint, completed: false, result: undefined });
        return { state: "started" };
      }
      if (entry.fingerprint !== fingerprint) return { state: "conflict" };
      return entry.completed
        ? { state: "completed", result: entry.result as Result }
        : { state: "in_progress" };
    },
    async complete(key, result) {
      const entry = entries.get(key);
      if (entry) entries.set(key, { ...entry, completed: true, result });
    },
    async release(key) {
      entries.delete(key);
    },
  };
}
