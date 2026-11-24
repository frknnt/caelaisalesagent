import { readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import {
  expect,
  lastTurn,
  localDatabase,
  openPreview,
  ownerAState,
  runTurn,
  tenantAId,
  test,
} from "../support";

test.use({ storageState: ownerAState });

const visitorText = "Reach me at visitor@example.test or 0532 555 12 34";

interface ServerLogLine {
  event?: string;
  level?: string;
  requestId?: string;
  traceId?: string;
  fields?: Record<string, unknown>;
}

const serverLog = () => readFileSync("test-results/server/harness.log", "utf8");

/** Structured lines only. Next.js also prints plain text. */
function logLines(): ServerLogLine[] {
  return serverLog()
    .split("\n")
    .filter((line) => line.startsWith('{"ts"'))
    .map((line) => JSON.parse(line) as ServerLogLine);
}

async function metricOf(page: Page) {
  const requestId = (await lastTurn(page, "Request id").textContent()) ?? "";
  const { data, error } = await localDatabase()
    .from("llm_call_metrics")
    .select()
    .eq("request_id", requestId);
  expect(error).toBeNull();
  return { requestId, metrics: data ?? [] };
}

test.beforeEach(async ({ page }) => {
  await openPreview(page);
});

test("a completed turn is logged, measured and audited under one request id", async ({
  page,
}) => {
  await runTurn(page, "answer", visitorText);
  await expect(lastTurn(page, "Outcome")).toHaveText("completed");
  const { requestId, metrics } = await metricOf(page);

  expect(metrics).toHaveLength(1);
  expect(metrics[0]).toMatchObject({
    organization_id: tenantAId,
    provider: "fake",
    outcome: "completed",
    is_simulated: true,
    pricing_version: "fake-2026-11",
  });
  expect(metrics[0]?.latency_ms).toBeGreaterThanOrEqual(350);
  expect(metrics[0]?.cost_micros).toBe(
    Number(await lastTurn(page, "Simulated cost (micro-USD)").textContent()),
  );

  const { data: audits } = await localDatabase()
    .from("audit_events")
    .select()
    .eq("request_id", requestId);
  expect(audits).toMatchObject([
    {
      organization_id: tenantAId,
      actor_type: "user",
      action: "test_harness.turn_run",
      outcome: "success",
      trace_id: metrics[0]?.trace_id,
      metadata: {
        scenario: "answer",
        llm_outcome: "completed",
        simulated: true,
      },
    },
  ]);

  const line = logLines().find((item) => item.requestId === requestId);
  expect(line).toMatchObject({
    event: "llm.call",
    traceId: metrics[0]?.trace_id,
    fields: { outcome: "completed", isSimulated: true },
  });
  expect(JSON.stringify([metrics, audits])).not.toMatch(/example\.test|0532/);
});

for (const [scenario, outcome] of [
  ["timeout", "timeout"],
  ["refusal", "refusal"],
  ["rate_limited", "rate_limited"],
  ["unavailable", "unavailable"],
  ["budget", "budget_exceeded"],
] as const) {
  test(`${scenario}: hands off with no webhook and no model text`, async ({
    page,
  }) => {
    await runTurn(page, scenario, visitorText);
    await expect(lastTurn(page, "Outcome")).toHaveText(outcome);
    await expect(lastTurn(page, "Webhook deliveries")).toHaveText("0");
    const conversation = page.getByRole("log", { name: "Conversation" });
    await expect(conversation).toContainText("A person can help you.");
    await expect(conversation).not.toContainText("scripted answer");
    await expect(
      page.getByRole("button", { name: "Talk to a Person" }),
    ).toBeEnabled();

    const { metrics } = await metricOf(page);
    expect(metrics).toMatchObject([{ outcome, is_simulated: true }]);
  });
}

test("a duplicated webhook event is delivered once", async ({ page }) => {
  await runTurn(page, "duplicate", "Hello");
  await expect(lastTurn(page, "Outcome")).toHaveText("completed");
  await expect(lastTurn(page, "Webhook deliveries")).toHaveText("1");
});

test("a server error shows the boundary with a reference that is in the log", async ({
  page,
}) => {
  await runTurn(page, "crash", visitorText);
  const boundary = page
    .getByRole("alert")
    .filter({ hasText: "Your workspace could not be loaded" });
  await expect(boundary).toBeVisible();
  await expect(boundary.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(boundary).not.toContainText(/HARNESS_CRASH|example\.test/);

  const reference = await boundary
    .getByText(/^Error reference: /)
    .textContent();
  const digest = reference?.replace("Error reference: ", "");
  await expect
    .poll(() =>
      logLines().find(
        (line) =>
          line.event === "request.error" && line.fields?.digest === digest,
      ),
    )
    .toMatchObject({
      level: "error",
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      traceId: expect.stringMatching(/^[0-9a-f]{32}$/),
      fields: { routeType: "action", errorType: "Error" },
    });

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Try Again" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 1, name: "Test preview" }),
  ).toBeVisible();
});

test("the raw server log carries no visitor text, address or credential", async ({
  page,
}) => {
  await runTurn(page, "crash", visitorText);
  await expect(page.getByText(/^Error reference: /)).toBeVisible();
  // Everything the process printed, not only our own lines: Next.js prints
  // caught errors too.
  await expect
    .poll(() => logLines().map((line) => line.event))
    .toEqual(expect.arrayContaining(["request.error", "console.error"]));
  expect(serverLog()).not.toMatch(
    /example\.test|0532|Reach me|HARNESS_CRASH|eyJ|sb_secret|CaelTest/,
  );
});

test("every response has a request id chosen by the server", async ({
  request,
}) => {
  const clientId = "f0000000-0000-4000-8000-000000000009";
  for (const path of ["/", "/login", "/api/health", "/api/tenant-context"]) {
    const response = await request.get(path, {
      headers: { "x-request-id": clientId },
    });
    const requestId = response.headers()["x-request-id"];
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestId).not.toBe(clientId);
  }
});

test("a cross-tenant request is denied, logged and audited without its value", async ({
  request,
}) => {
  const foreignId = "b0000000-0000-4000-8000-000000000001";
  const attempts = [
    ["query", request.get(`/api/tenant-context?organizationId=${foreignId}`)],
    [
      "header",
      request.get("/api/tenant-context", {
        headers: { "x-organization-id": foreignId },
      }),
    ],
    [
      "body",
      request.post("/api/tenant-context", {
        data: { organizationId: foreignId },
      }),
    ],
    ["path", request.get(`/api/organizations/${foreignId}/context`)],
  ] as const;

  for (const [source, pending] of attempts) {
    const response = await pending;
    expect(response.status(), source).toBe(403);
    const body = (await response.json()) as {
      error: { code: string; requestId: string };
    };
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(body.error.requestId).toBe(response.headers()["x-request-id"]);

    const { data } = await localDatabase()
      .from("audit_events")
      .select()
      .eq("request_id", body.error.requestId);
    expect(data, source).toMatchObject([
      {
        organization_id: tenantAId,
        action: "tenant.access_denied",
        outcome: "denied",
        metadata: { source },
      },
    ]);
    expect(JSON.stringify(data)).not.toContain(foreignId);
  }

  const allowed = await request.get(
    `/api/tenant-context?organizationId=${tenantAId}`,
  );
  expect(allowed.status()).toBe(200);
});
