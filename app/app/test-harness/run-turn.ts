import {
  executeOnce,
  type IdempotencyStore,
} from "@/lib/connectors/idempotency";
import { callLlmGuarded, type LlmFailure } from "@/lib/llm/guarded-call";
import type { LlmCompletion } from "@/lib/llm/port";
import type { LlmMetricsSink } from "@/lib/observability/llm-metrics";
import type { Logger } from "@/lib/observability/logger";
import type { RequestContext } from "@/lib/observability/request-context";
import type { FakeWebhook } from "@/lib/testing/fake-connectors";
import { FakeLlm, type FakeLlmStep } from "@/lib/testing/fake-llm";
import { fakePricing } from "@/lib/testing/fixtures";

import type { HarnessScenario } from "./scenarios";

export interface HarnessTurnResult {
  outcome: "completed" | LlmFailure;
  answer: { text: string; source: string } | null;
  requestId: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicros: number | null;
  webhookDeliveries: number;
}

interface HarnessTurnInput {
  organizationId: string;
  turnId: string;
  message: string;
  scenario: Exclude<HarnessScenario, "crash">;
  context: RequestContext;
  logger: Logger;
  metrics: LlmMetricsSink;
  webhook: FakeWebhook;
  store: IdempotencyStore;
}

const answer: FakeLlmStep = {
  kind: "answer",
  text: "This is a scripted answer. I have no approved price, so a person would confirm it.",
  delayMs: 400,
};

const scripts: Record<HarnessTurnInput["scenario"], FakeLlmStep> = {
  answer,
  duplicate: answer,
  budget: answer,
  timeout: { kind: "hang" },
  refusal: { kind: "refusal" },
  rate_limited: { kind: "rate_limited", retryAfterMs: 2_000 },
  unavailable: { kind: "unavailable" },
};

/** One visitor message through the guarded call and the idempotent webhook. */
export async function runHarnessTurn({
  organizationId,
  turnId,
  message,
  scenario,
  context,
  logger,
  metrics,
  webhook,
  store,
}: HarnessTurnInput): Promise<HarnessTurnResult> {
  const deliver = (completion: LlmCompletion) =>
    executeOnce(store, {
      organizationId,
      operation: "webhook.turn_completed",
      key: turnId,
      input: { outputTokens: completion.usage.outputTokens },
      run: () =>
        webhook.deliver({
          organizationId,
          idempotencyKey: turnId,
          event: "harness.turn_completed",
          payload: { outputTokens: completion.usage.outputTokens },
        }),
    });

  const result = await callLlmGuarded({
    port: new FakeLlm([scripts[scenario]]),
    request: {
      purpose: "harness_preview",
      messages: [{ role: "user", content: message }],
      maxOutputTokens: 200,
    },
    tenant: { organizationId, siteId: null },
    context,
    limits: {
      timeoutMs: 1_000,
      maxCostMicros: scenario === "budget" ? 1 : 10_000,
    },
    pricing: fakePricing,
    metrics,
    logger,
    onCompleted: async (completion) => {
      await deliver(completion);
      if (scenario === "duplicate") await deliver(completion);
    },
  });

  return {
    outcome: result.status === "completed" ? "completed" : result.reason,
    answer:
      result.status === "completed"
        ? { text: result.completion.text, source: "Fixture source" }
        : null,
    requestId: context.requestId,
    latencyMs: result.metric.latencyMs,
    inputTokens: result.metric.usage?.inputTokens ?? null,
    outputTokens: result.metric.usage?.outputTokens ?? null,
    costMicros: result.metric.costMicros,
    webhookDeliveries: webhook.attempts.filter(
      (delivery) =>
        delivery.organizationId === organizationId &&
        delivery.idempotencyKey === turnId,
    ).length,
  };
}
