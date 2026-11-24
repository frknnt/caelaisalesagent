export const llmCallOutcomes = [
  "completed",
  "timeout",
  "refusal",
  "rate_limited",
  "unavailable",
  "budget_exceeded",
  "invalid_output",
] as const;
export type LlmCallOutcome = (typeof llmCallOutcomes)[number];

export interface LlmTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

/** Prices are micro-USD per million tokens, so costs stay integers. */
export interface LlmPricing {
  version: string;
  inputMicrosPerMillion: number;
  outputMicrosPerMillion: number;
  cachedInputMicrosPerMillion: number;
}

/**
 * One row per provider attempt. Unknown token counts and costs are null, never
 * zero. Billing (P3.3) keeps its own ledger; this is operational telemetry.
 */
export interface LlmCallMetric {
  id: string;
  organizationId: string;
  siteId: string | null;
  requestId: string;
  traceId: string;
  provider: string;
  model: string;
  purpose: string;
  attempt: number;
  outcome: LlmCallOutcome;
  usage: LlmTokenUsage | null;
  latencyMs: number;
  costMicros: number | null;
  pricingVersion: string | null;
  isSimulated: boolean;
}

export interface LlmMetricsSink {
  record(metric: LlmCallMetric): Promise<void>;
}

export function isValidUsage(usage: LlmTokenUsage) {
  const counts = [
    usage.inputTokens,
    usage.outputTokens,
    usage.cachedInputTokens,
  ];
  return (
    counts.every((count) => Number.isSafeInteger(count) && count >= 0) &&
    usage.cachedInputTokens <= usage.inputTokens
  );
}

/** Rounds up: a budget check must never under-count. */
export function calculateCostMicros(usage: LlmTokenUsage, pricing: LlmPricing) {
  const freshInput = usage.inputTokens - usage.cachedInputTokens;
  return Math.ceil(
    (freshInput * pricing.inputMicrosPerMillion +
      usage.cachedInputTokens * pricing.cachedInputMicrosPerMillion +
      usage.outputTokens * pricing.outputMicrosPerMillion) /
      1_000_000,
  );
}
