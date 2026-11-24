import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { AuthorizationError } from "@/lib/auth/authorization";
import { withApiObservability } from "@/lib/observability/api-route";
import { installConsoleGuard } from "@/lib/observability/console-guard";
import {
  assertAuditEvent,
  recordAudit,
  type AuditEvent,
} from "@/lib/observability/audit";
import { calculateCostMicros } from "@/lib/observability/llm-metrics";
import { createLogger } from "@/lib/observability/logger";
import { errorFields, redactFields } from "@/lib/observability/redaction";
import {
  applyRequestContext,
  createRequestContext,
  parseTraceparent,
  readRequestContext,
} from "@/lib/observability/request-context";
import { fakePricing, fixtureContext, tenantA } from "@/lib/testing/fixtures";
import {
  createMemoryAuditSink,
  createMemoryLogger,
} from "@/lib/testing/memory-sinks";

const personalData = [
  "visitor@example.test",
  "+90 532 555 12 34",
  "0532-555-12-34",
  "905325551234",
  "(0532)5551234",
  "10000000146", // national identity number shape
  "4111111111111111",
  "4111-1111-1111-1111",
  "TR330006100519786457841326",
  "tel-0532-555-12-34",
  "x20261124905325551234",
  "Ayse Yilmaz asked about pricing",
];

// Assembled at run time so secret scanners do not flag the test itself.
const secrets = [
  ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "c2lnbmF0dXJl"].join("."),
  ["sb", "secret", "abcdefghijklmnop"].join("_"),
  ["sk", "live", "abcdefghijklmnop"].join("_"),
  ["sk", "ant", "api03", "abcdefghijklmnop"].join("-"),
  "Bearer abcdefghijkl",
];

describe("redaction", () => {
  it.each([...personalData, ...secrets])(
    "removes %s under an innocent key, nested or in an array",
    (value) => {
      const output = JSON.stringify(
        redactFields({ code: value, nested: { list: [{ code: value }] } }),
      );
      expect(output).not.toContain(value);
      expect(output).toContain("[REDACTED]");
    },
  );

  it.each([
    "password",
    "accessToken",
    "refresh_token",
    "Authorization",
    "set-cookie",
    "SUPABASE_SECRET_KEY",
    "apiKey",
    "sessionId",
    "email",
    "visitorEmail",
    "phone",
    "name",
    "displayName",
    "message",
    "content",
    "prompt",
    "body",
    "payload",
    "headers",
    "ip",
    "userAgent",
  ])("removes anything stored under %s", (key) => {
    expect(redactFields({ [key]: "harmless" })).toEqual({
      [key]: "[REDACTED]",
    });
    expect(redactFields({ [key]: { inner: 1 } })).toEqual({
      [key]: "[REDACTED]",
    });
  });

  it("removes phone numbers stored as numbers", () => {
    expect(redactFields({ value: 905325551234 })).toEqual({
      value: "[REDACTED]",
    });
  });

  it("drops query strings and fragments from paths", () => {
    expect(
      redactFields({
        path: "/login?email=visitor@example.test#token",
        url: "https://cael.example/app?next=secret",
      }),
    ).toEqual({ path: "/login", url: "https://cael.example/app" });
  });

  it("keeps identifiers, counts, codes and timestamps readable", () => {
    const fields = {
      organizationId: tenantA.organizationId,
      path: `/api/organizations/${tenantA.organizationId}/context`,
      requestId: fixtureContext.requestId,
      traceId: "01234567890123456789012345678901",
      digest: "3052117482",
      inputTokens: 1200,
      outputTokens: null,
      status: 403,
      ok: false,
      none: null,
      outcome: "rate_limited",
      at: "2026-11-24T09:00:00.000Z",
      day: "2026-11-24",
      model: "model-5-20260901",
      alias: "model-4o-2026-08-06",
    };
    expect(redactFields(fields)).toEqual(fields);
  });

  it("survives cycles, depth, size and unsupported values", () => {
    const cyclic: Record<string, unknown> = { id: 1 };
    cyclic.self = cyclic;
    expect(redactFields({ cyclic })).toEqual({
      cyclic: { id: 1, self: "[REDACTED]" },
    });
    const wide = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [`k${index}`, index]),
    );
    expect(Object.keys(redactFields(wide))).toHaveLength(40);
    expect(String(redactFields({ long: "a".repeat(500) }).long)).toHaveLength(
      203,
    );
    expect(redactFields({ nan: Number.NaN })).toEqual({ nan: null });
  });

  it("keeps an error's type, code and call sites but not its message", () => {
    const error = Object.assign(
      new TypeError("Failed for visitor@example.test with sb_secret_abcdefgh"),
      { code: "23505", digest: "123456789" },
    );
    const fields = errorFields(error);
    expect(fields).toMatchObject({
      errorType: "TypeError",
      errorCode: "23505",
      digest: "123456789",
    });
    expect(fields.frames).toEqual(
      expect.arrayContaining([
        expect.stringContaining("observability.test.ts"),
      ]),
    );
    expect(JSON.stringify(redactFields({ error }))).not.toMatch(
      /example\.test|sb_secret|Users/,
    );
    expect(errorFields("plain text")).toEqual({ errorType: "string" });
  });
});

describe("structured log", () => {
  it("writes one JSON object per line with request and trace ids", () => {
    const { logger, lines } = createMemoryLogger();
    logger.info("api.request", { status: 200, note: "line one\nline two" });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("\n");
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      ts: "2026-11-24T09:00:00.000Z",
      level: "info",
      event: "api.request",
      service: "cael-web",
      requestId: fixtureContext.requestId,
      traceId: fixtureContext.traceId,
      fields: { status: 200, note: "[REDACTED]" },
    });
  });

  it("cannot be steered by caller data: fields stay nested, events stay codes", () => {
    const { logger, records } = createMemoryLogger();
    logger.info("visitor@example.test wrote", {
      level: "error",
      event: "audit.forged",
    });
    expect(records()[0]).toMatchObject({
      level: "info",
      event: "log.invalid_event_name",
      fields: { level: "error", event: "audit.forged" },
    });
  });

  it("filters by level and never throws", () => {
    const lines: string[] = [];
    const quiet = createLogger({
      minLevel: "warn",
      sink: (line) => lines.push(line),
    });
    quiet.debug("a.b");
    quiet.info("a.b");
    quiet.warn("a.b");
    expect(lines).toHaveLength(1);

    const broken = createLogger({
      sink: () => {
        throw new Error("sink down");
      },
    });
    expect(() => broken.error("a.b", new Error("x"))).not.toThrow();
    expect(() => broken.info("a.b", { big: 1n })).not.toThrow();
  });
});

describe("console guard", () => {
  const leak = "prompt of visitor@example.test";

  function setup() {
    const printed: unknown[][] = [];
    const target = {
      error: (...args: unknown[]) => void printed.push(args),
      warn: (...args: unknown[]) => void printed.push(args),
    };
    const { logger, lines, records } = createMemoryLogger();
    const restore = installConsoleGuard(target, logger);
    return { target, printed, lines, records, restore };
  }

  it("turns a framework error into a structured line without its message", () => {
    const { target, printed, lines, records } = setup();
    target.error("x", Object.assign(new TypeError(leak), { digest: "42" }));
    expect(printed).toEqual([]);
    expect(records()).toMatchObject([
      {
        level: "error",
        event: "console.error",
        fields: { errorType: "TypeError", digest: "42" },
      },
    ]);
    expect(lines.join()).not.toContain("example.test");
  });

  it("drops free text and objects, and restores the console", () => {
    const { target, printed, lines, records, restore } = setup();
    target.error(leak);
    target.error({ body: leak });
    target.warn(leak, new Error(leak));
    target.warn(leak);
    expect(records().map((record) => record.event)).toEqual([
      "console.error",
      "console.error",
      "console.warn",
      "console.warn",
    ]);
    expect(lines.join()).not.toMatch(/visitor|example/);

    restore();
    target.error("after");
    expect(printed).toEqual([["after"]]);
  });
});

describe("request context", () => {
  const traceparent = `00-${fixtureContext.traceId}-${fixtureContext.spanId}-01`;

  it.each([
    null,
    "",
    "not-a-trace",
    "ff-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    "00-00000000000000000000000000000000-b7ad6b7169203331-01",
    "00-0af7651916cd43dd8448eb211c80319c-0000000000000000-01",
    `${traceparent}\r\nx-injected: 1`,
    traceparent.toUpperCase(),
  ])("rejects the traceparent %j", (value) => {
    expect(parseTraceparent(value)).toBeNull();
  });

  it("continues a valid trace with a new span and its own request id", () => {
    const incoming = new Headers({
      traceparent,
      "x-request-id": fixtureContext.requestId,
    });
    const context = createRequestContext(incoming);
    expect(context.traceId).toBe(fixtureContext.traceId);
    expect(context.spanId).not.toBe(fixtureContext.spanId);
    expect(context.requestId).not.toBe(fixtureContext.requestId);
  });

  it("replaces client headers at the edge and is read back unchanged", () => {
    const headers = new Headers({
      "x-request-id": "<script>",
      traceparent: "bad",
    });
    const context = applyRequestContext(headers);
    expect(readRequestContext(headers)).toEqual(context);
    expect(context.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(context.spanId).toMatch(/^[0-9a-f]{16}$/);
  });

  it("creates a context when the edge did not set a valid one", () => {
    const headers = new Headers({ "x-request-id": "' or 1=1 --" });
    expect(readRequestContext(headers).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("can be written to the headers of a proxied request", () => {
    const request = new NextRequest("http://localhost/app", {
      headers: { "x-request-id": "client" },
    });
    const context = applyRequestContext(request.headers);
    expect(request.headers.get("x-request-id")).toBe(context.requestId);
  });
});

describe("API route wrapper", () => {
  const call = async (handler: () => Promise<Response>) => {
    const { logger, lines, records } = createMemoryLogger();
    const route = withApiObservability("/api/example", handler, () => logger);
    const response = await route(
      new NextRequest("http://localhost/api/example?email=a@example.test"),
    );
    return { response, lines, records: records() };
  };

  it("logs route, status and duration without the query string", async () => {
    const { response, records, lines } = await call(async () =>
      Response.json({ ok: true }),
    );
    expect(response.status).toBe(200);
    expect(records).toMatchObject([
      {
        event: "api.request",
        fields: { route: "/api/example", method: "GET", status: 200 },
      },
    ]);
    expect(lines.join()).not.toContain("example.test");
  });

  it.each([
    [401, "AUTHENTICATION_REQUIRED"],
    [403, "PERMISSION_DENIED"],
  ] as const)(
    "keeps the %i contract and adds the request id",
    async (status, code) => {
      const { response } = await call(async () => {
        throw new AuthorizationError(status, code);
      });
      expect(response.status).toBe(status);
      const body = (await response.json()) as {
        error: { code: string; requestId: string };
      };
      expect(body.error.code).toBe(code);
      expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  it("turns an unexpected error into a safe 500", async () => {
    const { response, lines, records } = await call(async () => {
      throw new Error("connection string postgres://user:pw@host/db");
    });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("postgres");
    expect(records.map((record) => record.event)).toEqual([
      "api.request_failed",
      "api.request",
    ]);
    expect(lines.join()).not.toContain("postgres");
  });
});

describe("audit events", () => {
  const event: AuditEvent = {
    organizationId: tenantA.organizationId,
    actor: { type: "user", userId: tenantA.ownerId },
    action: "tenant.access_denied",
    entityType: "organization",
    outcome: "denied",
    context: fixtureContext,
    metadata: { source: "query", attempts: 2, blocked: true, previous: null },
  };

  it("records a valid event", async () => {
    const { sink, records } = createMemoryAuditSink();
    const { logger, lines } = createMemoryLogger();
    expect(await recordAudit(sink, event, logger)).toBe(true);
    expect(records).toEqual([event]);
    expect(lines).toEqual([]);
  });

  it.each<[string, Partial<AuditEvent>]>([
    ["free-text action", { action: "Deleted a user" }],
    ["single-word action", { action: "delete" }],
    ["entity type", { entityType: "User Profile" }],
    ["e-mail in metadata", { metadata: { target: "visitor@example.test" } }],
    ["phone in metadata", { metadata: { target: "05325551234" } }],
    ["numeric phone", { metadata: { target: 905325551234 } }],
    ["prose in metadata", { metadata: { reason: "Ayse asked for it" } }],
    ["personal key", { metadata: { email: "hidden" } }],
    ["secret key", { metadata: { access_token: "abc" } }],
    ["key format", { metadata: { "Bad Key": 1 } }],
  ])("rejects %s before it reaches the store", async (_name, override) => {
    const { sink, records } = createMemoryAuditSink();
    const { logger, records: logs } = createMemoryLogger();
    expect(() => assertAuditEvent({ ...event, ...override })).toThrow();
    expect(await recordAudit(sink, { ...event, ...override }, logger)).toBe(
      false,
    );
    expect(records).toEqual([]);
    expect(logs()).toMatchObject([{ event: "audit.write_failed" }]);
  });

  it("does not throw when the store is down", async () => {
    const { logger, records } = createMemoryLogger();
    const sink = { record: () => Promise.reject(new Error("down")) };
    expect(await recordAudit(sink, event, logger)).toBe(false);
    expect(records()).toMatchObject([
      {
        level: "error",
        event: "audit.write_failed",
        fields: { action: "tenant.access_denied" },
      },
    ]);
  });
});

describe("cost calculation", () => {
  it("prices fresh, cached and output tokens and rounds up", () => {
    expect(
      calculateCostMicros(
        { inputTokens: 1_000, outputTokens: 200, cachedInputTokens: 400 },
        fakePricing,
      ),
    ).toBe(600 + 40 + 1_000);
    expect(
      calculateCostMicros(
        { inputTokens: 1, outputTokens: 0, cachedInputTokens: 1 },
        fakePricing,
      ),
    ).toBe(1);
  });
});
