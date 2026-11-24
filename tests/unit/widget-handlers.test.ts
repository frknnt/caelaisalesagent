import { beforeEach, describe, expect, it } from "vitest";

import {
  createFakeWidgetStore,
  fixturePublicKey,
  fixtureSite,
} from "@/lib/testing/fake-widget-store";
import { createMemoryLogger } from "@/lib/testing/memory-sinks";
import { parseTokenKeys, type WidgetConfig } from "@/lib/widget/config";
import {
  handleBootstrap,
  handleCreateSession,
  handleFrame,
  handleReadSession,
  requireWidgetSession,
  type WidgetDeps,
} from "@/lib/widget/handlers";
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

let clock: Date;
let fake: ReturnType<typeof createFakeWidgetStore>;
let log: ReturnType<typeof createMemoryLogger>;
let deps: WidgetDeps;

beforeEach(() => {
  clock = new Date("2026-11-24T10:00:00Z");
  fake = createFakeWidgetStore({ now: () => clock });
  log = createMemoryLogger();
  deps = {
    config: { ok: true, value: config },
    store: fake.store,
    logger: log.logger,
    now: () => clock,
  };
});

const advance = (seconds: number) => {
  clock = new Date(clock.getTime() + seconds * 1000);
};

function bootstrapRequest(
  headers: Record<string, string | undefined> = {},
  body: string = JSON.stringify({ key: fixturePublicKey }),
) {
  const merged: Record<string, string | undefined> = {
    origin: shop,
    "content-type": "text/plain;charset=UTF-8",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "sec-fetch-site": "cross-site",
    "x-real-ip": "203.0.113.7",
    ...headers,
  };
  return new Request(`${app}/api/widget/v1/bootstrap`, {
    method: "POST",
    body,
    headers: Object.entries(merged).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  });
}

async function bootstrap() {
  const response = await handleBootstrap(bootstrapRequest(), deps);
  expect(response.status).toBe(200);
  return (await response.json()) as { frame: string; token: string };
}

function sessionRequest(
  body: unknown,
  headers: Record<string, string | undefined> = {},
) {
  const merged: Record<string, string | undefined> = {
    origin: app,
    "content-type": "application/json",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "sec-fetch-site": "same-origin",
    "x-real-ip": "203.0.113.7",
    ...headers,
  };
  return new Request(`${app}/api/widget/v1/session`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: Object.entries(merged).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  });
}

async function openSession() {
  const { token } = await bootstrap();
  const response = await handleCreateSession(
    sessionRequest({ token, embedder: shop }),
    deps,
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { session: string; expiresIn: number };
}

const readSession = (session: string, headers: Record<string, string> = {}) =>
  new Request(`${app}/api/widget/v1/session`, {
    headers: {
      authorization: `Bearer ${session}`,
      "sec-fetch-site": "same-origin",
      ...headers,
    },
  });

describe("bootstrap", () => {
  it("answers an allowed page for that one origin, without credentials", async () => {
    const response = await handleBootstrap(bootstrapRequest(), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(shop);
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    expect(response.headers.get("vary")).toBe("Origin");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      expiresIn: 120,
      title: fixtureSite.widgetTitle,
      theme: { accent: "#0b7188", position: "bottom-right" },
      handoffUrl: fixtureSite.handoffUrl,
      copy: { lang: "tr" },
    });
    const text = JSON.stringify(body);
    for (const internal of [
      fixtureSite.organizationId,
      fixtureSite.siteId,
      "203.0.113.7",
    ]) {
      expect(text).not.toContain(internal);
    }
  });

  it("passes the host, the key and a hash instead of the address", async () => {
    await bootstrap();
    expect(fake.calls[0]?.input).toMatchObject({
      publicKey: fixturePublicKey,
      hostname: "shop-a.example",
    });
    expect(fake.calls[0]?.input.clientHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each<[string, Record<string, string | undefined>]>([
    ["no Origin", { origin: undefined }],
    ["an opaque Origin", { origin: "null" }],
    ["an http Origin", { origin: "http://shop-a.example" }],
    ["a navigation", { "sec-fetch-mode": "navigate" }],
    ["a no-cors request", { "sec-fetch-mode": "no-cors" }],
    ["an image request", { "sec-fetch-dest": "image" }],
    ["a request typed into the address bar", { "sec-fetch-site": "none" }],
  ])("refuses %s before asking the database", async (_, headers) => {
    const response = await handleBootstrap(bootstrapRequest(headers), deps);
    expect(response.status).toBe(403);
    expect(fake.calls).toEqual([]);
  });

  it.each<[string, string]>([
    ["no JSON", "x"],
    ["an array", "[]"],
    ["null", "null"],
    ["no key", "{}"],
    ["a key of another type", '{"key":1}'],
    ["a malformed key", '{"key":"cael_pk_1"}'],
  ])("refuses %s before asking the database", async (_, body) => {
    const response = await handleBootstrap(bootstrapRequest({}, body), deps);
    expect(response.status).toBe(403);
    expect(fake.calls).toEqual([]);
  });

  it("refuses a large body, declared or not", async () => {
    const large = JSON.stringify({
      key: fixturePublicKey,
      x: "x".repeat(4000),
    });
    expect(
      (await handleBootstrap(bootstrapRequest({}, large), deps)).status,
    ).toBe(413);
    const stream = new Request(`${app}/api/widget/v1/bootstrap`, {
      method: "POST",
      headers: { origin: shop },
      body: new ReadableStream({
        pull(controller) {
          controller.enqueue(new Uint8Array(1024));
        },
      }),
      duplex: "half",
    } as RequestInit);
    expect((await handleBootstrap(stream, deps)).status).toBe(413);
    expect(fake.calls).toEqual([]);
  });

  it("gives every refusal the same answer and no CORS header", async () => {
    const answers = await Promise.all(
      [
        bootstrapRequest({ origin: "https://evil.example" }),
        bootstrapRequest(
          {},
          JSON.stringify({ key: "cael_pk_00000000000000000000000000000000" }),
        ),
        bootstrapRequest({ origin: "null" }),
        bootstrapRequest({}, "{}"),
      ].map(async (request) => {
        const response = await handleBootstrap(request, deps);
        return {
          status: response.status,
          body: await response.text(),
          cors: response.headers.get("access-control-allow-origin"),
          names: [...response.headers.keys()].sort(),
        };
      }),
    );
    expect(answers[0]).toMatchObject({
      status: 403,
      body: '{"error":{"code":"WIDGET_DENIED"}}',
      cors: null,
    });
    for (const answer of answers) expect(answer).toEqual(answers[0]);
  });

  it("tells a limited client when to come back", async () => {
    fake.force({ outcome: "rate_limited", retryAfter: 42 });
    const response = await handleBootstrap(bootstrapRequest(), deps);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("is off without its configuration", async () => {
    deps.config = { ok: false, problem: "WIDGET_TOKEN_SECRETS" };
    const response = await handleBootstrap(bootstrapRequest(), deps);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe(
      '{"error":{"code":"WIDGET_UNAVAILABLE"}}',
    );
    expect(fake.calls).toEqual([]);
  });

  it("logs no key, address, origin or token", async () => {
    const { token, frame } = await bootstrap();
    await handleBootstrap(
      bootstrapRequest({ origin: "https://evil.example" }),
      deps,
    );
    const output = log.lines.join("\n");
    for (const value of [
      fixturePublicKey,
      "203.0.113.7",
      "shop-a.example",
      "evil.example",
      token,
      frame,
    ]) {
      expect(output).not.toContain(value);
    }
    expect(output).toContain("widget.bootstrap_denied");
  });
});

describe("frame", () => {
  const frameRequest = (url: string) => new Request(url);

  it("may be framed by the one origin of its ticket", async () => {
    const { frame } = await bootstrap();
    const response = await handleFrame(frameRequest(frame), deps);
    expect(response.status).toBe(200);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain(`frame-ancestors ${shop}`);
    expect(csp.match(/frame-ancestors[^;]*/)?.[0]).toBe(
      `frame-ancestors ${shop}`,
    );
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("unsafe");
    expect(response.headers.get("x-frame-options")).toBeNull();
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("shows that it is an AI and the way to a person without any script", async () => {
    const { frame } = await bootstrap();
    const html = await (await handleFrame(frameRequest(frame), deps)).text();
    expect(html).toContain("Ben bir yapay zekâ asistanıyım, insan değilim.");
    expect(html).toContain("Bir kişiyle görüş");
    expect(html).toContain('href="https://shop-a.example/contact"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('<html lang="tr">');
  });

  it("carries no session token", async () => {
    const { frame, token } = await bootstrap();
    const html = await (await handleFrame(frameRequest(frame), deps)).text();
    expect(html).not.toContain(token);
    expect(html).not.toContain("cw1.");
  });

  it.each<[string, () => Promise<string>]>([
    ["no ticket", async () => `${app}/widget/v1/frame`],
    [
      "a public key instead",
      async () => `${app}/widget/v1/frame?t=${fixturePublicKey}`,
    ],
    [
      "a bootstrap token instead",
      async () => `${app}/widget/v1/frame?t=${(await bootstrap()).token}`,
    ],
    [
      "an expired ticket",
      async () => {
        const { frame } = await bootstrap();
        advance(121);
        return frame;
      },
    ],
    [
      "a broken signature",
      async () =>
        (await bootstrap()).frame.replace(/.$/, "").replace(/.$/, "-_"),
    ],
    [
      "a domain removed in the meantime",
      async () => {
        const { frame } = await bootstrap();
        fake.allowed.clear();
        return frame;
      },
    ],
  ])("refuses %s and cannot be framed at all", async (_, url) => {
    const response = await handleFrame(frameRequest(await url()), deps);
    expect(response.status).toBe(403);
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    const html = await response.text();
    expect(html).not.toContain(fixtureSite.siteName);
    expect(html).not.toContain("<script");
  });

  it("escapes what the site owner wrote", async () => {
    const hostile = {
      ...fixtureSite,
      widgetTitle: '"><script>alert(1)</script>',
      handoffUrl: "https://x.example/?a='\"><img>",
    };
    deps.store = {
      ...fake.store,
      frame: async () => ({ outcome: "allowed", site: hostile }),
    };
    const { frame } = await bootstrap();
    const html = await (await handleFrame(frameRequest(frame), deps)).text();
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("session", () => {
  it("is bought once with a bootstrap token", async () => {
    const { token } = await bootstrap();
    const first = await handleCreateSession(
      sessionRequest({ token, embedder: shop }),
      deps,
    );
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ expiresIn: 1800 });
    expect(first.headers.get("access-control-allow-origin")).toBeNull();
    expect(first.headers.get("set-cookie")).toBeNull();

    const replay = await handleCreateSession(
      sessionRequest({ token, embedder: shop }),
      deps,
    );
    expect(replay.status).toBe(401);
    expect(fake.sessions.size).toBe(1);
  });

  it.each<[string, () => Promise<string>]>([
    [
      "an expired token",
      async () => {
        const { token } = await bootstrap();
        advance(120);
        return token;
      },
    ],
    ["a broken token", async () => `${(await bootstrap()).token}x`],
    [
      "a frame ticket",
      async () =>
        new URL((await bootstrap()).frame).searchParams.get("t") ?? "",
    ],
    ["a session token", async () => (await openSession()).session],
    [
      "a token of another key",
      async () =>
        issueWidgetToken(
          config,
          "bootstrap",
          {
            siteKeyId: "b0000000-0000-4000-8000-000000000301",
            origin: shop,
            id: "f0000000-0000-4000-8000-00000000000a",
          },
          clock,
        ),
    ],
    [
      "a token for an origin that is no longer allowed",
      async () => {
        const { token } = await bootstrap();
        fake.allowed.clear();
        return token;
      },
    ],
    [
      "a token for an origin that can never be one",
      async () =>
        issueWidgetToken(
          config,
          "bootstrap",
          {
            siteKeyId: fixtureSite.siteKeyId,
            origin: "http://shop-a.localhost",
            id: "f0000000-0000-4000-8000-00000000000b",
          },
          clock,
        ),
    ],
  ])("is refused for %s, always with the same answer", async (_, token) => {
    const given = await token();
    const before = fake.sessions.size;
    const response = await handleCreateSession(
      sessionRequest({ token: given, embedder: shop }),
      deps,
    );
    expect(response.status).toBe(401);
    expect(await response.text()).toBe(
      '{"error":{"code":"WIDGET_TOKEN_REJECTED"}}',
    );
    expect(fake.sessions.size).toBe(before);
  });

  it("is refused when the frame sits on another page than the token names", async () => {
    fake.allowed.add("other-a.example");
    const { token } = await bootstrap();
    const response = await handleCreateSession(
      sessionRequest({ token, embedder: "https://other-a.example" }),
      deps,
    );
    expect(response.status).toBe(401);
    expect(fake.sessions.size).toBe(0);
  });

  it.each<[string, Record<string, string | undefined>, number]>([
    ["the customer's page", { origin: shop }, 403],
    ["a foreign page", { origin: "https://evil.example" }, 403],
    ["no Origin", { origin: undefined }, 403],
    ["an opaque Origin", { origin: "null" }, 403],
    ["a cross-site request", { "sec-fetch-site": "cross-site" }, 403],
    ["a same-site sibling", { "sec-fetch-site": "same-site" }, 403],
    ["a form", { "content-type": "application/x-www-form-urlencoded" }, 415],
    ["plain text", { "content-type": "text/plain" }, 415],
  ])("is refused for %s", async (_, headers, status) => {
    const { token } = await bootstrap();
    const response = await handleCreateSession(
      sessionRequest({ token, embedder: shop }, headers),
      deps,
    );
    expect(response.status).toBe(status);
    expect(fake.sessions.size).toBe(0);
  });

  it.each(["", "null", "[]", "{}", '{"token":1,"embedder":2}'])(
    "refuses the body %j",
    async (body) => {
      const response = await handleCreateSession(sessionRequest(body), deps);
      expect(response.status).toBe(400);
    },
  );

  it("is limited", async () => {
    const { token } = await bootstrap();
    fake.force({ outcome: "rate_limited", retryAfter: 9 });
    const response = await handleCreateSession(
      sessionRequest({ token, embedder: shop }),
      deps,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("9");
  });
});

describe("a request with a session", () => {
  it("knows its tenant and site from the database, not from the token", async () => {
    const { session } = await openSession();
    const guard = await requireWidgetSession(readSession(session), deps);
    expect(guard).toMatchObject({
      ok: true,
      session: {
        organizationId: fixtureSite.organizationId,
        siteId: fixtureSite.siteId,
        origin: shop,
      },
    });
  });

  it("is accepted while live and refused at its end", async () => {
    const { session } = await openSession();
    advance(1799);
    const live = await handleReadSession(readSession(session), deps);
    expect(live.status).toBe(200);
    expect(await live.json()).toEqual({ expiresIn: 1 });
    advance(1);
    expect((await handleReadSession(readSession(session), deps)).status).toBe(
      401,
    );
  });

  it("is refused at once when its domain is removed", async () => {
    const { session } = await openSession();
    fake.allowed.clear();
    expect((await handleReadSession(readSession(session), deps)).status).toBe(
      401,
    );
  });

  it("is refused at once when the session is gone", async () => {
    const { session } = await openSession();
    fake.sessions.clear();
    expect((await handleReadSession(readSession(session), deps)).status).toBe(
      401,
    );
  });

  it.each<[string, string]>([
    ["no token", ""],
    ["a bootstrap token", "bootstrap"],
    ["a broken token", "cw1.k1.e30.x"],
  ])("is refused with %s", async (_, kind) => {
    const token = kind === "bootstrap" ? (await bootstrap()).token : kind;
    expect((await handleReadSession(readSession(token), deps)).status).toBe(
      401,
    );
  });

  it("is refused from any other page", async () => {
    const { session } = await openSession();
    const statuses = await Promise.all(
      [
        { origin: "https://evil.example" },
        { origin: shop },
        { "sec-fetch-site": "cross-site" },
      ].map(
        async (headers) =>
          (
            await handleReadSession(
              readSession(session, headers as Record<string, string>),
              deps,
            )
          ).status,
      ),
    );
    expect(statuses).toEqual([403, 403, 403]);
  });

  it("needs an Origin as soon as it changes something", async () => {
    const { session } = await openSession();
    const write = new Request(`${app}/api/widget/v1/anything`, {
      method: "POST",
      headers: { authorization: `Bearer ${session}` },
    });
    const guard = await requireWidgetSession(write, deps);
    expect(guard.ok === false && guard.response.status).toBe(403);
  });

  it("is limited", async () => {
    const { session } = await openSession();
    fake.force({ outcome: "rate_limited", retryAfter: 5 });
    expect((await handleReadSession(readSession(session), deps)).status).toBe(
      429,
    );
  });
});
