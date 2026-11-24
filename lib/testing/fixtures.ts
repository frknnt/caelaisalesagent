import type { CalendarSlot } from "@/lib/connectors/ports";
import type { LlmPricing } from "@/lib/observability/llm-metrics";
import type { RequestContext } from "@/lib/observability/request-context";

/** Same identifiers as supabase/seed.sql. All values are synthetic. */
export const tenantA = {
  organizationId: "a0000000-0000-4000-8000-000000000001",
  siteId: "a0000000-0000-4000-8000-000000000101",
  ownerId: "a1111111-1111-4111-8111-111111111111",
} as const;

export const tenantB = {
  organizationId: "b0000000-0000-4000-8000-000000000001",
  siteId: "b0000000-0000-4000-8000-000000000101",
  ownerId: "b1111111-1111-4111-8111-111111111111",
} as const;

export const fixtureContext: RequestContext = {
  requestId: "f0000000-0000-4000-8000-000000000001",
  traceId: "0af7651916cd43dd8448eb211c80319c",
  spanId: "b7ad6b7169203331",
};

export const fixtureTime = "2026-11-24T09:00:00.000Z";

/** Not a real price list. Round numbers keep cost assertions readable. */
export const fakePricing: LlmPricing = {
  version: "fake-2026-11",
  inputMicrosPerMillion: 1_000_000,
  outputMicrosPerMillion: 5_000_000,
  cachedInputMicrosPerMillion: 100_000,
};

export const fixtureSlots: Readonly<Record<string, readonly CalendarSlot[]>> = {
  [tenantA.organizationId]: [
    { id: "slot-a-1", startsAt: "2026-11-25T09:00:00.000Z" },
    { id: "slot-a-2", startsAt: "2026-11-25T10:00:00.000Z" },
  ],
  [tenantB.organizationId]: [
    { id: "slot-b-1", startsAt: "2026-11-25T09:00:00.000Z" },
  ],
};

/** Predictable UUIDs: the sequence number is the last group. */
export function createSequentialIds() {
  let count = 0;
  return () => {
    count += 1;
    return `ffffffff-0000-4000-8000-${String(count).padStart(12, "0")}`;
  };
}
