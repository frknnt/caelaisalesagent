import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runHarnessTurn } from "@/app/app/test-harness/run-turn";
import { createMemoryIdempotencyStore } from "@/lib/connectors/idempotency";
import { FakeWebhook } from "@/lib/testing/fake-connectors";
import { fixtureContext, tenantA, tenantB } from "@/lib/testing/fixtures";
import {
  createMemoryLogger,
  createMemoryMetricsSink,
} from "@/lib/testing/memory-sinks";

type Scenario = Parameters<typeof runHarnessTurn>[0]["scenario"];

function createHarness() {
  const webhook = new FakeWebhook();
  const store = createMemoryIdempotencyStore();
  const metrics = createMemoryMetricsSink();
  const log = createMemoryLogger();
  const run = async (
    scenario: Scenario,
    turnId = "ffffffff-0000-4000-8000-000000000001",
    organizationId: string = tenantA.organizationId,
  ) => {
    const pending = runHarnessTurn({
      organizationId,
      turnId,
      message: "Call me on 0532 555 12 34",
      scenario,
      context: fixtureContext,
      logger: log.logger,
      metrics: metrics.sink,
      webhook,
      store,
    });
    await vi.advanceTimersByTimeAsync(2_000);
    return pending;
  };
  return { run, webhook, metrics: metrics.records, log };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("core flow with fakes only", () => {
  it("answers with a source and delivers one webhook", async () => {
    const { run, webhook, metrics } = createHarness();
    expect(await run("answer")).toMatchObject({
      outcome: "completed",
      answer: { source: "Fixture source" },
      requestId: fixtureContext.requestId,
      webhookDeliveries: 1,
    });
    expect(webhook.processedFor(tenantA.organizationId)).toHaveLength(1);
    expect(metrics).toMatchObject([
      { outcome: "completed", isSimulated: true },
    ]);
  });

  it.each<[Scenario, string]>([
    ["timeout", "timeout"],
    ["refusal", "refusal"],
    ["rate_limited", "rate_limited"],
    ["unavailable", "unavailable"],
    ["budget", "budget_exceeded"],
  ])("%s: no answer and no webhook", async (scenario, outcome) => {
    const { run, webhook, metrics } = createHarness();
    expect(await run(scenario)).toMatchObject({
      outcome,
      answer: null,
      webhookDeliveries: 0,
    });
    expect(webhook.attempts).toEqual([]);
    expect(metrics).toMatchObject([{ outcome }]);
  });

  it("sends a duplicate event only once, in one turn or in a repeated turn", async () => {
    const { run, webhook } = createHarness();
    expect(await run("duplicate")).toMatchObject({ webhookDeliveries: 1 });
    expect(await run("answer")).toMatchObject({ webhookDeliveries: 1 });
    expect(webhook.attempts).toHaveLength(1);
  });

  it("keeps the same turn id of two tenants apart", async () => {
    const { run, webhook } = createHarness();
    const turnId = "ffffffff-0000-4000-8000-000000000002";
    await run("answer", turnId, tenantA.organizationId);
    await run("answer", turnId, tenantB.organizationId);
    expect(webhook.processedFor(tenantA.organizationId)).toHaveLength(1);
    expect(webhook.processedFor(tenantB.organizationId)).toHaveLength(1);
  });

  it("logs no visitor text", async () => {
    const { run, log } = createHarness();
    await run("answer");
    await run("unavailable");
    expect(log.lines.join("\n")).not.toMatch(/0532|Call me/);
  });
});
