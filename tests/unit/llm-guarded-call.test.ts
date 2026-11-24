import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { callLlmGuarded, type GuardedLlmInput } from "@/lib/llm/guarded-call";
import type { LlmCompletion, LlmPort, LlmRequest } from "@/lib/llm/port";
import { FakeLlm, type FakeLlmStep } from "@/lib/testing/fake-llm";
import {
  createSequentialIds,
  fakePricing,
  fixtureContext,
  tenantA,
} from "@/lib/testing/fixtures";
import {
  createMemoryLogger,
  createMemoryMetricsSink,
} from "@/lib/testing/memory-sinks";

const visitorText =
  "My number is 0532 555 12 34, write to visitor@example.test";

const request: LlmRequest = {
  purpose: "agent_reply",
  messages: [{ role: "user", content: visitorText }],
  maxOutputTokens: 100,
};

function setup(
  port: LlmPort,
  overrides: Partial<GuardedLlmInput<string>> = {},
) {
  const metrics = createMemoryMetricsSink();
  const log = createMemoryLogger();
  const effects: LlmCompletion[] = [];
  const input: GuardedLlmInput<string> = {
    port,
    request,
    tenant: { organizationId: tenantA.organizationId, siteId: tenantA.siteId },
    context: fixtureContext,
    limits: { timeoutMs: 1_000, maxCostMicros: 10_000 },
    pricing: fakePricing,
    metrics: metrics.sink,
    logger: log.logger,
    newId: createSequentialIds(),
    monotonicMs: () => Date.now(),
    onCompleted: async (completion) => {
      effects.push(completion);
      return "effect-done";
    },
    ...overrides,
  };
  return { input, metrics: metrics.records, log, effects };
}

const fake = (...steps: FakeLlmStep[]) => new FakeLlm(steps);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("callLlmGuarded: success", () => {
  it("returns the completion, runs the effect once and records cost, latency and tokens", async () => {
    const { input, metrics, effects } = setup(
      fake({ kind: "answer", text: "a".repeat(40), delayMs: 250 }),
    );
    const pending = callLlmGuarded(input);
    await vi.advanceTimersByTimeAsync(250);
    const result = await pending;

    expect(result).toMatchObject({
      status: "completed",
      effect: "effect-done",
      completion: { text: "a".repeat(40) },
    });
    expect(effects).toHaveLength(1);
    const inputTokens = Math.ceil(visitorText.length / 4);
    expect(metrics).toEqual([
      {
        id: "ffffffff-0000-4000-8000-000000000001",
        organizationId: tenantA.organizationId,
        siteId: tenantA.siteId,
        requestId: fixtureContext.requestId,
        traceId: fixtureContext.traceId,
        provider: "fake",
        model: "fake-model-1",
        purpose: "agent_reply",
        attempt: 1,
        outcome: "completed",
        usage: { inputTokens, outputTokens: 10, cachedInputTokens: 0 },
        latencyMs: 250,
        costMicros: inputTokens * 1 + 10 * 5,
        pricingVersion: "fake-2026-11",
        isSimulated: true,
      },
    ]);
  });

  it("is deterministic: the same script gives the same result", async () => {
    const run = async () => {
      const { input, metrics } = setup(fake({ kind: "answer", text: "Same" }));
      return { result: await callLlmGuarded(input), metrics };
    };
    expect(await run()).toEqual(await run());
  });

  it("keeps the answer when the metric store fails, and logs the failure", async () => {
    const { input, log, effects } = setup(
      fake({ kind: "answer", text: "ok" }),
      {
        metrics: {
          record: () => Promise.reject(new Error(`db down: ${visitorText}`)),
        },
      },
    );
    expect((await callLlmGuarded(input)).status).toBe("completed");
    expect(effects).toHaveLength(1);
    expect(log.records().at(-1)).toMatchObject({
      level: "error",
      event: "llm.metric_write_failed",
    });
    expect(log.lines.join("\n")).not.toContain("visitor@example.test");
  });
});

describe("callLlmGuarded: failures hand off without side effects", () => {
  it("timeout: gives up at the limit and aborts the provider", async () => {
    let signal: AbortSignal | undefined;
    const port = fake({ kind: "hang" });
    const complete = port.complete.bind(port);
    port.complete = (llmRequest, abortSignal) => {
      signal = abortSignal;
      return complete(llmRequest, abortSignal);
    };
    const { input, metrics, effects, log } = setup(port);
    const pending = callLlmGuarded(input);
    await vi.advanceTimersByTimeAsync(999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(await pending).toMatchObject({
      status: "handoff",
      reason: "timeout",
    });
    expect(signal?.aborted).toBe(true);
    expect(effects).toEqual([]);
    expect(metrics).toMatchObject([
      { outcome: "timeout", latencyMs: 1_000, usage: null, costMicros: null },
    ]);
    expect(log.records().map((record) => record.event)).toEqual(["llm.call"]);
  });

  it("timeout: discards an answer that ignores the abort and arrives late", async () => {
    const { input, metrics, effects } = setup(
      fake({ kind: "hang", lateAnswerMs: 5_000 }),
    );
    const pending = callLlmGuarded(input);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await pending).toMatchObject({ status: "handoff" });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(effects).toEqual([]);
    expect(metrics).toHaveLength(1);
  });

  it("refusal: hides the model output and still records the tokens used", async () => {
    const { input, metrics, effects } = setup(fake({ kind: "refusal" }));
    const result = await callLlmGuarded(input);
    expect(result).toMatchObject({ status: "handoff", reason: "refusal" });
    expect(result).not.toHaveProperty("completion");
    expect(effects).toEqual([]);
    expect(metrics).toMatchObject([
      { outcome: "refusal", usage: { outputTokens: 0 } },
    ]);
    expect(metrics[0]?.costMicros).toBeGreaterThan(0);
  });

  it("rate limit: reports the retry delay and does not retry by itself", async () => {
    const port = fake(
      { kind: "rate_limited", retryAfterMs: 2_000 },
      { kind: "answer", text: "must not be reached" },
    );
    const { input, metrics, effects } = setup(port);
    expect(await callLlmGuarded(input)).toMatchObject({
      status: "handoff",
      reason: "rate_limited",
      retryAfterMs: 2_000,
    });
    expect(port.calls).toHaveLength(1);
    expect(effects).toEqual([]);
    expect(metrics).toMatchObject([
      { outcome: "rate_limited", usage: null, costMicros: null },
    ]);
  });

  it.each<[string, FakeLlmStep, string]>([
    ["provider outage", { kind: "unavailable" }, "unavailable"],
    ["blank output", { kind: "malformed" }, "invalid_output"],
  ])("%s", async (_name, step, reason) => {
    const { input, effects, metrics } = setup(fake(step));
    expect(await callLlmGuarded(input)).toMatchObject({
      status: "handoff",
      reason,
    });
    expect(effects).toEqual([]);
    expect(metrics).toMatchObject([{ outcome: reason }]);
  });

  it.each<[string, Partial<LlmCompletion>]>([
    ["cut-off output", { finish: "length" }],
    [
      "negative token counts",
      { usage: { inputTokens: -1, outputTokens: 1, cachedInputTokens: 0 } },
    ],
    [
      "more cached than total input",
      { usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 2 } },
    ],
  ])("invalid provider response: %s", async (_name, override) => {
    const port = fake();
    port.complete = async () => ({
      finish: "stop",
      text: "text",
      usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 },
      ...override,
    });
    const { input, effects } = setup(port);
    expect(await callLlmGuarded(input)).toMatchObject({
      status: "handoff",
      reason: "invalid_output",
    });
    expect(effects).toEqual([]);
  });

  it("unexpected provider error: falls back and logs no message text", async () => {
    const port = fake();
    port.complete = async () => {
      throw new Error(`400 for prompt ${visitorText}`);
    };
    const { input, effects, log } = setup(port);
    expect(await callLlmGuarded(input)).toMatchObject({
      status: "handoff",
      reason: "unavailable",
    });
    expect(effects).toEqual([]);
    expect(log.records()[0]).toMatchObject({ event: "llm.call_failed" });
    expect(log.lines.join("\n")).not.toMatch(/0532|example\.test/);
  });
});

describe("callLlmGuarded: budget", () => {
  const worstCase = Math.ceil(visitorText.length / 4) + 100 * 5;

  it("does not call the provider when the worst case exceeds the budget", async () => {
    const port = fake({ kind: "answer", text: "must not be reached" });
    const { input, metrics, effects } = setup(port, {
      limits: { timeoutMs: 1_000, maxCostMicros: worstCase - 1 },
    });
    expect(await callLlmGuarded(input)).toMatchObject({
      status: "handoff",
      reason: "budget_exceeded",
    });
    expect(port.calls).toEqual([]);
    expect(effects).toEqual([]);
    expect(metrics).toMatchObject([
      { outcome: "budget_exceeded", usage: null, costMicros: null },
    ]);
  });

  it("calls the provider when the worst case equals the budget", async () => {
    const { input } = setup(fake({ kind: "answer", text: "ok" }), {
      limits: { timeoutMs: 1_000, maxCostMicros: worstCase },
    });
    expect((await callLlmGuarded(input)).status).toBe("completed");
  });

  it("fails closed when the price or the input size is unknown", async () => {
    for (const { port, pricing } of [
      { port: fake({ kind: "answer", text: "no" }), pricing: null },
      {
        port: Object.assign(fake({ kind: "answer", text: "no" }), {
          estimateInputTokens: () => Number.NaN,
        }),
        pricing: fakePricing,
      },
    ]) {
      const { input } = setup(port, { pricing });
      expect(await callLlmGuarded(input)).toMatchObject({
        status: "handoff",
        reason: "budget_exceeded",
      });
      expect(port.calls).toEqual([]);
    }
  });
});

describe("callLlmGuarded: logs", () => {
  it("never contain message content on any path", async () => {
    const steps: FakeLlmStep[] = [
      { kind: "answer", text: "Reply for visitor@example.test" },
      { kind: "refusal" },
      { kind: "rate_limited", retryAfterMs: 1 },
      { kind: "unavailable" },
      { kind: "malformed" },
    ];
    for (const step of steps) {
      const { input, log } = setup(fake(step));
      await callLlmGuarded(input);
      const output = log.lines.join("\n");
      expect(output).not.toMatch(/0532|example\.test|My number/);
      expect(log.records()[0]).toMatchObject({
        requestId: fixtureContext.requestId,
        traceId: fixtureContext.traceId,
      });
    }
  });
});
