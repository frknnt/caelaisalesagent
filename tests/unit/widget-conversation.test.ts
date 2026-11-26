import { beforeEach, describe, expect, it } from "vitest";

import { createMemoryBudgetLedger } from "@/lib/agent/budget";
import { runAgentTurn } from "@/lib/agent/loop";
import { foldIntoSummary } from "@/lib/agent/summary";
import { ToolRegistry, type AgentTool } from "@/lib/agent/tools";
import { createMemoryIdempotencyStore } from "@/lib/connectors/idempotency";
import { DemoLlm } from "@/lib/llm/adapters/demo";
import type { LlmConfig } from "@/lib/llm/config";
import { callLlmGuarded } from "@/lib/llm/guarded-call";
import type { LlmPort } from "@/lib/llm/port";
import { CircuitBreaker } from "@/lib/llm/resilience";
import { createFakeConversationStore } from "@/lib/testing/fake-conversation-store";
import { FakeLlm, type FakeLlmStep } from "@/lib/testing/fake-llm";
import {
  createFakeWidgetStore,
  fixtureSite,
} from "@/lib/testing/fake-widget-store";
import { fakePricing, fixtureContext } from "@/lib/testing/fixtures";
import {
  createMemoryLogger,
  createMemoryMetricsSink,
} from "@/lib/testing/memory-sinks";
import { parseTokenKeys, type WidgetConfig } from "@/lib/widget/config";
import {
  handleAttachVisitor,
  handleConversation,
  handleFeedback,
  handleMemoryConsent,
  handlePostMessage,
  MEMORY_CONSENT_VERSION,
  type AgentRunner,
  type ConversationDeps,
} from "@/lib/widget/conversation";
import {
  escapeHtml,
  jsonForHtml,
  renderFrame,
} from "@/lib/widget/frame-document";
import { issueWidgetToken } from "@/lib/widget/tokens";

const app = "https://app.cael.example";
const shop = "https://shop-a.example";
const keys = parseTokenKeys(`k1:${Buffer.alloc(32, 3).toString("base64url")}`);
if (!keys) throw new Error("fixture");
const config: WidgetConfig = {
  appOrigin: app,
  keys,
  clientIpHeader: "x-real-ip",
  allowLoopbackOrigins: false,
};
const llmConfig: LlmConfig = {
  provider: "fake",
  model: "fake-model-1",
  timeoutMs: 1_000,
  maxAttempts: 1,
  perCallMaxCostMicros: 50_000,
  dailyBudgetMicros: 1_000_000,
  emergencyStop: false,
  pricing: fakePricing,
};

const knowledgeTool: AgentTool = {
  name: "search_knowledge",
  description: "test",
  schema: {
    type: "object",
    properties: { query: { type: "string", minLength: 1, maxLength: 500 } },
    required: ["query"],
    additionalProperties: false,
  },
  sideEffect: false,
  async execute() {
    return {
      status: "supported",
      answer: "Teslimat iki is gunudur.",
      handoff: false,
      citations: [
        {
          sourceId: "s1",
          title: "Teslimat",
          url: "https://shop-a.example/kargo",
          snippet: "x",
        },
        {
          sourceId: "s2",
          title: "Gizli",
          url: "javascript:alert(1)",
          snippet: "y",
        },
      ],
    };
  },
};

let clock: Date;
let widget: ReturnType<typeof createFakeWidgetStore>;
let conversations: ReturnType<typeof createFakeConversationStore>;
let deps: ConversationDeps;
let scripts: FakeLlmStep[][];
let ports: LlmPort[];
let runs: number;

/** The real agent loop over a scripted fake provider. */
const realAgent: AgentRunner = async (input) => {
  runs += 1;
  const port = new FakeLlm(scripts.shift() ?? []);
  ports.push(port);
  return runAgentTurn({
    port,
    config: llmConfig,
    breaker: new CircuitBreaker(),
    budget: createMemoryBudgetLedger().ledger,
    tools: new ToolRegistry([knowledgeTool]),
    idempotency: createMemoryIdempotencyStore(),
    metrics: createMemoryMetricsSink().sink,
    logger: input.logger,
    context: fixtureContext,
    turn: {
      organizationId: input.session.organizationId,
      siteId: input.session.siteId,
      turnId: input.turnId,
      agentName: input.agentName,
      siteName: input.siteName,
    },
    history: input.history,
    summary: input.summary,
    onTextDelta: input.onTextDelta,
  });
};

const answered = (text: string, chunks?: string[]): FakeLlmStep[] => [
  {
    kind: "tool_call",
    calls: [
      { id: "t1", name: "search_knowledge", arguments: { query: "kargo" } },
    ],
  },
  chunks ? { kind: "answer", text, chunks } : { kind: "answer", text },
];

beforeEach(() => {
  clock = new Date("2026-11-26T10:00:00Z");
  widget = createFakeWidgetStore({ now: () => clock });
  conversations = createFakeConversationStore({ now: () => clock });
  scripts = [];
  ports = [];
  runs = 0;
  deps = {
    config: { ok: true, value: config },
    store: widget.store,
    conversations: conversations.store,
    runAgent: realAgent,
    logger: createMemoryLogger().logger,
    now: () => clock,
  };
});

async function openSession() {
  const created = await widget.store.createSession({
    siteKeyId: fixtureSite.siteKeyId,
    hostname: "shop-a.example",
    origin: shop,
    bootstrapId: crypto.randomUUID(),
    clientHash: null,
    ttlSeconds: 1800,
  });
  if (created.outcome !== "allowed") throw new Error("fixture");
  return issueWidgetToken(
    config,
    "session",
    { siteKeyId: fixtureSite.siteKeyId, origin: shop, id: created.sessionId },
    clock,
  );
}

function call(path: string, session: string, body?: unknown, method = "POST") {
  return new Request(`${app}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${session}`,
      origin: app,
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
    },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

const key = (fill: string) => fill.repeat(43);

async function attach(
  session: string,
  stored: string | null,
  fresh = key("f"),
) {
  const response = await handleAttachVisitor(
    call("/api/widget/v1/visitor", session, { key: stored, fresh }),
    deps,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as {
    key: string;
    resumed: boolean;
    memoryConsent: boolean;
    messages: {
      role: string;
      text: string;
      status: string;
      replyTo: string | null;
    }[];
  };
}

/** Parses the event stream of one reply. */
async function events(response: Response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => ({
      event: /^event: (\w+)$/m.exec(block)?.[1] ?? "",
      data: JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? "null") as Record<
        string,
        unknown
      >,
    }));
}

const post = (
  session: string,
  text: string,
  clientMessageId = crypto.randomUUID(),
) =>
  handlePostMessage(
    call("/api/widget/v1/messages", session, { clientMessageId, text }),
    deps,
  );

describe("anonymous identity and refresh", () => {
  it("starts an anonymous visitor and gives the frame its key back", async () => {
    const session = await openSession();
    const first = await attach(session, null, key("a"));
    expect(first).toMatchObject({
      key: key("a"),
      resumed: false,
      messages: [],
    });
    // Only a hash is handed to the database, never the key.
    expect(conversations.visitors[0]?.hash).not.toBe(key("a"));
    expect(conversations.visitors[0]?.hash).toHaveLength(43);
  });

  it("a refresh (new session, same key) returns the conversation", async () => {
    const before = await openSession();
    await attach(before, null, key("a"));
    scripts.push(answered("Teslimat iki is gunudur."));
    expect(
      (await events(await post(before, "Kargo ne zaman gelir?"))).at(-1)?.event,
    ).toBe("reply");

    const after = await openSession();
    const resumed = await attach(after, key("a"), key("b"));
    expect(resumed.resumed).toBe(true);
    expect(resumed.key).toBe(key("a"));
    expect(resumed.messages.map((m) => `${m.role}:${m.status}`)).toEqual([
      "visitor:completed",
      "assistant:completed",
    ]);
    const reconnect = await handleConversation(
      call("/api/widget/v1/conversation", after, undefined, "GET"),
      deps,
    );
    expect(
      ((await reconnect.json()) as { messages: unknown[] }).messages,
    ).toHaveLength(2);
  });

  it("without consent a visit after two hours has no memory; with consent it has", async () => {
    const first = await openSession();
    await attach(first, null, key("a"));
    scripts.push(answered("Yanit."));
    await events(await post(first, "Merhaba"));
    conversations.age(3 * 3600_000);
    const later = await attach(await openSession(), key("a"), key("c"));
    expect(later).toMatchObject({
      resumed: false,
      key: key("c"),
      messages: [],
    });

    const consenting = await openSession();
    await attach(consenting, key("c"), key("d"));
    const consent = await handleMemoryConsent(
      call("/api/widget/v1/visitor/consent", consenting, {
        granted: true,
        version: MEMORY_CONSENT_VERSION,
      }),
      deps,
    );
    expect(consent.status).toBe(200);
    expect(conversations.consents.at(-1)).toMatchObject({
      granted: true,
      version: MEMORY_CONSENT_VERSION,
    });
    conversations.age(3 * 24 * 3600_000);
    expect(
      (await attach(await openSession(), key("c"), key("e"))).resumed,
    ).toBe(true);
  });

  it("refuses a consent for a text version the visitor did not see", async () => {
    const session = await openSession();
    await attach(session, null);
    const response = await handleMemoryConsent(
      call("/api/widget/v1/visitor/consent", session, {
        granted: true,
        version: "other",
      }),
      deps,
    );
    expect(response.status).toBe(400);
  });

  it("rejects a malformed key and a request without a session", async () => {
    const session = await openSession();
    const bad = await handleAttachVisitor(
      call("/api/widget/v1/visitor", session, {
        key: "short",
        fresh: key("f"),
      }),
      deps,
    );
    expect(bad.status).toBe(400);
    const anonymous = await handleAttachVisitor(
      call("/api/widget/v1/visitor", "cw1.forged", { fresh: key("f") }),
      deps,
    );
    expect(anonymous.status).toBe(401);
  });
});

describe("messages", () => {
  it("streams the reply, then sends the authoritative text with safe citations", async () => {
    const session = await openSession();
    await attach(session, null);
    scripts.push(
      answered("Teslimat iki is gunudur.", [
        "Teslimat ",
        "iki is ",
        "gunudur.",
      ]),
    );
    const response = await post(session, "Kargo ne zaman gelir?");
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const stream = await events(response);
    expect(stream.map((item) => item.event)).toEqual([
      "accepted",
      "delta",
      "delta",
      "delta",
      "reply",
    ]);
    const deltas = stream
      .filter((item) => item.event === "delta")
      .map((item) => item.data.text);
    expect(deltas.join("")).toBe("Teslimat iki is gunudur.");
    const reply = stream.at(-1)?.data;
    expect(reply).toMatchObject({
      text: "Teslimat iki is gunudur.",
      handoff: false,
    });
    // The javascript: URL is not passed on.
    expect(reply?.citations).toEqual([
      {
        sourceId: "s1",
        title: "Teslimat",
        url: "https://shop-a.example/kargo",
      },
      { sourceId: "s2", title: "Gizli", url: null },
    ]);
  });

  it("the same message twice gives one message, one reply and one agent run", async () => {
    const session = await openSession();
    await attach(session, null);
    scripts.push(answered("Bir kez."));
    const id = crypto.randomUUID();
    const first = await events(await post(session, "Iade var mi?", id));
    const second = await events(await post(session, "Iade var mi?", id));
    expect(runs).toBe(1);
    expect(conversations.messages).toHaveLength(2);
    expect(second.at(-1)).toMatchObject({
      event: "reply",
      data: { text: "Bir kez.", duplicate: true },
    });
    expect(first.at(-1)?.data.replyId).toBe(second.at(-1)?.data.replyId);
  });

  it("a resend while the reply is still being written waits instead of answering twice", async () => {
    const session = await openSession();
    await attach(session, null);
    let release: () => void = () => undefined;
    deps.runAgent = async (input) => {
      await new Promise<void>((resolve) => (release = resolve));
      return realAgent(input);
    };
    scripts.push(answered("Tek cevap."));
    const id = crypto.randomUUID();
    const running = post(session, "Soru", id);
    const firstResponse = await running;
    const resend = await post(session, "Soru", id);
    expect(resend.status).toBe(202);
    release();
    await events(firstResponse);
    expect(runs).toBe(1);
    expect(
      conversations.messages.filter((m) => m.role === "assistant"),
    ).toHaveLength(1);
  });

  it("a failed reply says so, and a retry of the same id answers it", async () => {
    const session = await openSession();
    await attach(session, null);
    deps.runAgent = async () => {
      throw new Error("database down");
    };
    const id = crypto.randomUUID();
    const failed = await events(await post(session, "Soru", id));
    expect(failed.at(-1)).toEqual({
      event: "error",
      data: { code: "WIDGET_REPLY_FAILED" },
    });
    expect(
      conversations.messages.find((m) => m.role === "assistant")?.status,
    ).toBe("failed");

    deps.runAgent = realAgent;
    scripts.push(answered("Simdi oldu."));
    const retried = await events(await post(session, "Soru", id));
    expect(retried.at(-1)).toMatchObject({
      event: "reply",
      data: { text: "Simdi oldu." },
    });
    expect(conversations.messages).toHaveLength(2);
  });

  it("a provider failure is the fixed handoff text, never model output", async () => {
    const session = await openSession();
    await attach(session, null);
    scripts.push([{ kind: "unavailable" }]);
    const reply = (await events(await post(session, "Soru"))).at(-1);
    expect(reply?.event).toBe("reply");
    expect(reply?.data.handoff).toBe(true);
    expect(String(reply?.data.text)).toContain("temsilciye");
  });

  it("refuses attachments, empty and too long messages before storing anything", async () => {
    const session = await openSession();
    await attach(session, null);
    const attached = await handlePostMessage(
      call("/api/widget/v1/messages", session, {
        clientMessageId: crypto.randomUUID(),
        text: "dosya",
        attachments: [{ name: "a.pdf" }],
      }),
      deps,
    );
    expect(attached.status).toBe(400);
    expect(await attached.json()).toEqual({
      error: { code: "WIDGET_ATTACHMENTS_UNSUPPORTED" },
    });
    expect((await post(session, "   ")).status).toBe(400);
    expect((await post(session, "x".repeat(1001))).status).toBe(400);
    expect((await post(session, "ğ".repeat(1000))).status).not.toBe(400);
    const badId = await handlePostMessage(
      call("/api/widget/v1/messages", session, {
        clientMessageId: "1",
        text: "x",
      }),
      deps,
    );
    expect(badId.status).toBe(400);
    expect(
      conversations.messages.filter((m) => m.role === "visitor"),
    ).toHaveLength(1);
  });

  it("maps the database's spam and limit answers to their own codes", async () => {
    const session = await openSession();
    await attach(session, null);
    const store = deps.conversations;
    for (const [outcome, status, code] of [
      ["spam", 429, "WIDGET_MESSAGE_REPEATED"],
      ["limit_reached", 409, "WIDGET_LIMIT_REACHED"],
      ["denied", 409, "WIDGET_VISITOR_REQUIRED"],
    ] as const) {
      deps.conversations = { ...store, postMessage: async () => ({ outcome }) };
      const response = await post(session, "x");
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: { code } });
    }
    deps.conversations = {
      ...store,
      postMessage: async () => ({ outcome: "rate_limited", retryAfter: 7 }),
    };
    const limited = await post(session, "x");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("7");
  });

  it("feedback is stored for the visitor's own reply only", async () => {
    const session = await openSession();
    await attach(session, null);
    scripts.push(answered("Yanit."));
    const reply = (await events(await post(session, "Soru"))).at(-1);
    const ok = await handleFeedback(
      call("/api/widget/v1/feedback", session, {
        messageId: reply?.data.replyId,
        value: 1,
      }),
      deps,
    );
    expect(ok.status).toBe(200);
    const other = await openSession();
    await attach(other, null, key("o"));
    const foreign = await handleFeedback(
      call("/api/widget/v1/feedback", other, {
        messageId: reply?.data.replyId,
        value: -1,
      }),
      deps,
    );
    expect(foreign.status).toBe(404);
    expect(
      conversations.messages.find((m) => m.role === "assistant")?.feedback,
    ).toBe(1);
  });
});

describe("long conversations", () => {
  it("folds turns that leave the window into a summary the model gets as data", async () => {
    const session = await openSession();
    await attach(session, null);
    for (let turn = 0; turn < 14; turn += 1) {
      scripts.push(answered(`Cevap ${turn}`));
      clock = new Date(clock.getTime() + 1000);
      await events(await post(session, `Soru numara ${turn} hakkinda`));
    }
    const [summary] = [...conversations.summaries.values()];
    expect(summary?.summary).toContain("Ziyaretci: Soru numara 0 hakkinda");
    const last = ports.at(-1) as FakeLlm;
    const sent =
      last.calls[0]?.messages
        .filter((message) => message.role !== "system")
        .map((message) => message.content)
        .join("\n") ?? "";
    expect(sent).toContain("<conversation_summary>");
    expect(sent).toContain("Soru numara 13 hakkinda");
    // The window holds 12 turns at most: the oldest question is only in the summary.
    expect(sent.split("<visitor_message>").length - 1).toBeLessThanOrEqual(6);
  });

  it("keeps the newest lines when the summary grows past its limit", () => {
    const turns = Array.from({ length: 40 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: `mesaj ${index} ${"x".repeat(80)}`,
    }));
    const summary = foldIntoSummary("eski satir", turns, 600) ?? "";
    expect(summary.length).toBeLessThanOrEqual(600);
    expect(summary).toContain("mesaj 39");
    expect(summary).not.toContain("eski satir");
    expect(foldIntoSummary("ayni", [])).toBe("ayni");
  });
});

describe("streaming at the port", () => {
  it("drops pieces that arrive after the attempt timed out", async () => {
    const pieces: string[] = [];
    const port = new FakeLlm([
      {
        kind: "answer",
        text: "abc",
        chunks: ["a", "b", "c"],
        chunkDelayMs: 40,
      },
    ]);
    const result = await callLlmGuarded({
      port,
      request: {
        purpose: "agent_reply",
        messages: [{ role: "user", content: "x" }],
        maxOutputTokens: 10,
        onTextDelta: (delta) => pieces.push(delta),
      },
      tenant: {
        organizationId: fixtureSite.organizationId,
        siteId: fixtureSite.siteId,
      },
      context: fixtureContext,
      limits: { timeoutMs: 60, maxCostMicros: 50_000 },
      pricing: fakePricing,
      metrics: createMemoryMetricsSink().sink,
      logger: createMemoryLogger().logger,
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(result.status).toBe("handoff");
    expect(pieces).toEqual(["a"]);
  });

  it("the demo adapter searches first, then streams only what the source said", async () => {
    const demo = new DemoLlm("demo-1", 0);
    const pieces: string[] = [];
    const ask = await demo.complete(
      {
        purpose: "agent_reply",
        messages: [
          {
            role: "user",
            content: "<visitor_message>\nKargo?\n</visitor_message>",
          },
        ],
        maxOutputTokens: 100,
        tools: [{ name: "search_knowledge", description: "", parameters: {} }],
      },
      new AbortController().signal,
    );
    expect(ask.toolCalls).toEqual([
      {
        id: "demo-search-1",
        name: "search_knowledge",
        arguments: { query: "Kargo?" },
      },
    ]);
    const answer = await demo.complete(
      {
        purpose: "agent_reply",
        messages: [
          {
            role: "user",
            content: "<visitor_message>\nKargo?\n</visitor_message>",
          },
          { role: "assistant", content: "", toolCalls: ask.toolCalls ?? [] },
          {
            role: "tool",
            toolCallId: "demo-search-1",
            name: "search_knowledge",
            content: JSON.stringify({
              status: "supported",
              answer: "Iki gun.",
            }),
          },
        ],
        maxOutputTokens: 100,
        onTextDelta: (delta) => pieces.push(delta),
      },
      new AbortController().signal,
    );
    expect(answer.text).toBe("Ben bir yapay zekâ asistanıyım. Iki gun.");
    expect(pieces.join("")).toBe(answer.text);
    expect(demo.isSimulated).toBe(true);
  });
});

describe("frame document", () => {
  it("carries the chat words as inert JSON that cannot close its element", () => {
    expect(jsonForHtml({ text: "</script><b>&" })).toBe(
      '{"text":"\\u003c/script\\u003e\\u003cb\\u003e\\u0026"}',
    );
    const html = renderFrame({
      embedOrigin: shop,
      site: { ...fixtureSite, widgetTitle: "<b>x</b>" },
    });
    expect(html).toContain(escapeHtml("<b>x</b>"));
    expect(html).toContain('<textarea id="input"');
    expect(html).toContain('maxlength="1000"');
    expect(html).toContain(
      'id="announce" class="visually-hidden" aria-live="polite"',
    );
  });
});
