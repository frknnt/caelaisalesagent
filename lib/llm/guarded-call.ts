import {
  calculateCostMicros,
  isValidUsage,
  type LlmCallMetric,
  type LlmCallOutcome,
  type LlmMetricsSink,
  type LlmPricing,
  type LlmTokenUsage,
} from "@/lib/observability/llm-metrics";
import type { Logger } from "@/lib/observability/logger";
import type { RequestContext } from "@/lib/observability/request-context";

import {
  LlmProviderError,
  type LlmCompletion,
  type LlmPort,
  type LlmRequest,
} from "./port";

export type LlmFailure = Exclude<LlmCallOutcome, "completed">;

export type GuardedLlmResult<Effect> =
  | {
      status: "completed";
      completion: LlmCompletion;
      effect: Effect | undefined;
      metric: LlmCallMetric;
    }
  | {
      /** No model text and no side effect. The visitor is offered a person. */
      status: "handoff";
      reason: LlmFailure;
      retryAfterMs: number | null;
      metric: LlmCallMetric;
    };

export interface GuardedLlmInput<Effect> {
  port: LlmPort;
  request: LlmRequest;
  tenant: { organizationId: string; siteId: string | null };
  context: RequestContext;
  limits: { timeoutMs: number; maxCostMicros: number };
  /** Null means the price is unknown, so the budget cannot be verified. */
  pricing: LlmPricing | null;
  metrics: LlmMetricsSink;
  logger: Logger;
  attempt?: number;
  newId?: () => string;
  monotonicMs?: () => number;
  /** Runs once, only after a valid completion that arrived in time. */
  onCompleted?: (completion: LlmCompletion) => Promise<Effect>;
}

type Attempt =
  | { outcome: "completed"; completion: LlmCompletion }
  | {
      outcome: LlmFailure;
      usage: LlmTokenUsage | null;
      retryAfterMs: number | null;
    };

function failure(
  outcome: LlmFailure,
  usage: LlmTokenUsage | null = null,
  retryAfterMs: number | null = null,
): Attempt {
  return { outcome, usage, retryAfterMs };
}

function fitsBudget<Effect>({
  port,
  request,
  pricing,
  limits,
}: GuardedLlmInput<Effect>) {
  if (!pricing) return false;
  const worstCase = {
    inputTokens: port.estimateInputTokens(request),
    outputTokens: request.maxOutputTokens,
    cachedInputTokens: 0,
  };
  return (
    isValidUsage(worstCase) &&
    calculateCostMicros(worstCase, pricing) <= limits.maxCostMicros
  );
}

function classify(completion: LlmCompletion): Attempt {
  if (!isValidUsage(completion.usage)) return failure("invalid_output");
  if (completion.finish === "refusal") {
    return failure("refusal", completion.usage);
  }
  if (completion.finish !== "stop" || completion.text.trim() === "") {
    return failure("invalid_output", completion.usage);
  }
  return { outcome: "completed", completion };
}

async function attemptCall<Effect>(
  input: GuardedLlmInput<Effect>,
): Promise<Attempt> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The race, not the abort signal, enforces the limit: a provider that
  // ignores the signal and answers late is discarded.
  const timeout = new Promise<Attempt>((resolve) => {
    timer = setTimeout(() => {
      resolve(failure("timeout"));
      controller.abort();
    }, input.limits.timeoutMs);
  });
  const call = async () => {
    if (!fitsBudget(input)) return failure("budget_exceeded");
    return classify(
      await input.port.complete(input.request, controller.signal),
    );
  };
  const settled = call().catch((error: unknown) => {
    if (error instanceof LlmProviderError) {
      return failure(error.code, null, error.retryAfterMs);
    }
    if (!controller.signal.aborted) {
      input.logger.error("llm.call_failed", error, {
        provider: input.port.provider,
        model: input.port.model,
      });
    }
    return failure("unavailable");
  });

  try {
    return await Promise.race([settled, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** One provider attempt with a time limit, a budget and a recorded metric. */
export async function callLlmGuarded<Effect = void>(
  input: GuardedLlmInput<Effect>,
): Promise<GuardedLlmResult<Effect>> {
  const monotonicMs = input.monotonicMs ?? (() => performance.now());
  const startedAt = monotonicMs();
  const attempt = await attemptCall(input);
  const usage =
    attempt.outcome === "completed" ? attempt.completion.usage : attempt.usage;
  const price = usage && input.pricing;

  const metric: LlmCallMetric = {
    id: (input.newId ?? (() => crypto.randomUUID()))(),
    organizationId: input.tenant.organizationId,
    siteId: input.tenant.siteId,
    requestId: input.context.requestId,
    traceId: input.context.traceId,
    provider: input.port.provider,
    model: input.port.model,
    purpose: input.request.purpose,
    attempt: input.attempt ?? 1,
    outcome: attempt.outcome,
    usage,
    latencyMs: Math.max(0, Math.round(monotonicMs() - startedAt)),
    costMicros: usage && price ? calculateCostMicros(usage, price) : null,
    pricingVersion: price ? price.version : null,
    isSimulated: input.port.isSimulated,
  };
  await recordMetric(input.metrics, metric, input.logger);

  if (attempt.outcome !== "completed") {
    return {
      status: "handoff",
      reason: attempt.outcome,
      retryAfterMs: attempt.retryAfterMs,
      metric,
    };
  }
  const effect = await input.onCompleted?.(attempt.completion);
  return {
    status: "completed",
    completion: attempt.completion,
    effect,
    metric,
  };
}

async function recordMetric(
  sink: LlmMetricsSink,
  metric: LlmCallMetric,
  logger: Logger,
) {
  logger.info("llm.call", {
    provider: metric.provider,
    model: metric.model,
    purpose: metric.purpose,
    outcome: metric.outcome,
    latencyMs: metric.latencyMs,
    inputTokens: metric.usage?.inputTokens ?? null,
    outputTokens: metric.usage?.outputTokens ?? null,
    costMicros: metric.costMicros,
    isSimulated: metric.isSimulated,
  });
  try {
    await sink.record(metric);
  } catch (error) {
    // Telemetry must not turn a good answer into a failed turn.
    logger.error("llm.metric_write_failed", error);
  }
}
