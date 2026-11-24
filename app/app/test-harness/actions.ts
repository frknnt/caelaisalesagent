"use server";

import { headers } from "next/headers";

import { createMemoryIdempotencyStore } from "@/lib/connectors/idempotency";
import { recordAudit } from "@/lib/observability/audit";
import { createLogger } from "@/lib/observability/logger";
import { readRequestContext } from "@/lib/observability/request-context";
import {
  supabaseAuditSink,
  supabaseLlmMetricsSink,
} from "@/lib/observability/supabase-sinks";
import { FakeWebhook } from "@/lib/testing/fake-connectors";

import { requireHarness } from "./harness-access";
import { runHarnessTurn, type HarnessTurnResult } from "./run-turn";
import { harnessScenarios } from "./scenarios";

const webhook = new FakeWebhook();
const store = createMemoryIdempotencyStore();

const MAX_MESSAGE_LENGTH = 2_000;
const turnIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function sendHarnessMessage(input: {
  turnId: string;
  message: string;
  scenario: string;
}): Promise<HarnessTurnResult> {
  const { user, activeMembership } = await requireHarness(
    "/app/test-harness/preview",
  );
  const scenario = harnessScenarios.find(({ id }) => id === input.scenario)?.id;
  const message = String(input.message).trim();
  if (
    !scenario ||
    !turnIdPattern.test(String(input.turnId)) ||
    message === "" ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    throw new Error("HARNESS_INPUT_INVALID");
  }
  // The text stands in for a real failure that quotes visitor data.
  if (scenario === "crash") {
    throw new Error(`HARNESS_CRASH while answering: ${message}`);
  }

  const context = readRequestContext(await headers());
  const logger = createLogger({ context });
  const result = await runHarnessTurn({
    organizationId: activeMembership.organization_id,
    turnId: input.turnId,
    message,
    scenario,
    context,
    logger,
    metrics: supabaseLlmMetricsSink,
    webhook,
    store,
  });
  await recordAudit(
    supabaseAuditSink,
    {
      organizationId: activeMembership.organization_id,
      actor: { type: "user", userId: user.id },
      action: "test_harness.turn_run",
      entityType: "harness_turn",
      entityId: input.turnId,
      outcome: result.outcome === "completed" ? "success" : "failure",
      context,
      metadata: { scenario, llm_outcome: result.outcome, simulated: true },
    },
    logger,
  );
  return result;
}
