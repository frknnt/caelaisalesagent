import { randomUUID } from "node:crypto";

import type { Logger } from "@/lib/observability/logger";

import { clientHash } from "./client-hash";
import type { WidgetConfigResult } from "./config";
import { widgetCopy } from "./copy";
import {
  frameCsp,
  renderFrame,
  renderFrameRefusal,
  REFUSED_FRAME_CSP,
} from "./frame-document";
import { parseEmbedOrigin } from "./origin";
import type { WidgetStore } from "./store";
import {
  BOOTSTRAP_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  issueWidgetToken,
  verifyWidgetToken,
} from "./tokens";

export interface WidgetDeps {
  config: WidgetConfigResult;
  store: WidgetStore;
  logger: Logger;
  now: () => Date;
}

const MAX_BODY_BYTES = 2048;
const publicKeyPattern = /^cael_pk_[0-9a-f]{32}$/;

export type WidgetErrorCode =
  | "WIDGET_DENIED"
  | "WIDGET_RATE_LIMITED"
  | "WIDGET_UNAVAILABLE"
  | "WIDGET_BAD_REQUEST"
  | "WIDGET_TOKEN_REJECTED"
  | "WIDGET_VISITOR_REQUIRED"
  | "WIDGET_MESSAGE_INVALID"
  | "WIDGET_ATTACHMENTS_UNSUPPORTED"
  | "WIDGET_MESSAGE_REPEATED"
  | "WIDGET_LIMIT_REACHED"
  | "WIDGET_REPLY_FAILED";

export const baseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

export function problem(
  status: number,
  code: WidgetErrorCode,
  headers: Record<string, string> = {},
) {
  return Response.json(
    { error: { code } },
    { status, headers: { ...baseHeaders, Vary: "Origin", ...headers } },
  );
}

const unavailable = (logger: Logger, missing: string) => {
  logger.error("widget.misconfigured", null, { problem: missing });
  return problem(503, "WIDGET_UNAVAILABLE");
};

export const limited = (retryAfter: number) =>
  problem(429, "WIDGET_RATE_LIMITED", { "Retry-After": String(retryAfter) });

/** Body text, or null when it is larger than any real request. */
export async function readSmallBody(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declared) || declared > maxBytes) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function parseRecord(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Browsers that send fetch metadata must tell a consistent story. */
function fetchMetadataFits(
  headers: Headers,
  expected: { mode: readonly string[]; dest: string; site?: string },
) {
  const mode = headers.get("sec-fetch-mode");
  const dest = headers.get("sec-fetch-dest");
  const site = headers.get("sec-fetch-site");
  return (
    (mode === null || expected.mode.includes(mode)) &&
    (dest === null || dest === expected.dest) &&
    (site === null || !expected.site || site === expected.site)
  );
}

/**
 * POST /api/widget/v1/bootstrap, called by the loader on the customer's page.
 * A simple CORS request, so it needs no preflight. The browser sets Origin and
 * the page cannot change it; a client outside a browser can (see the ADR).
 */
export async function handleBootstrap(
  request: Request,
  { config, store, logger, now }: WidgetDeps,
): Promise<Response> {
  if (!config.ok) return unavailable(logger, config.problem);
  const { value } = config;
  const denied = (reason: string, fields: Record<string, unknown> = {}) => {
    logger.info("widget.bootstrap_denied", { reason, ...fields });
    return problem(403, "WIDGET_DENIED");
  };

  const embed = parseEmbedOrigin(request.headers.get("origin"), {
    allowLoopback: value.allowLoopbackOrigins,
  });
  if (!embed) return denied("origin");
  if (
    !fetchMetadataFits(request.headers, { mode: ["cors"], dest: "empty" }) ||
    request.headers.get("sec-fetch-site") === "none"
  ) {
    return denied("fetch_metadata");
  }

  const body = await readSmallBody(request);
  if (body === null) return problem(413, "WIDGET_BAD_REQUEST");
  const publicKey = parseRecord(body)?.key;
  if (typeof publicKey !== "string" || !publicKeyPattern.test(publicKey)) {
    return denied("key_format");
  }

  const at = now();
  const result = await store.bootstrap({
    publicKey,
    hostname: embed.hostname,
    clientHash: clientHash(request.headers, value, at),
  });
  if (result.outcome === "rate_limited") {
    logger.warn("widget.rate_limited", { stage: "bootstrap" });
    return limited(result.retryAfter);
  }
  if (result.outcome === "denied") return denied("policy");

  const { site } = result;
  const claims = {
    siteKeyId: site.siteKeyId,
    origin: embed.origin,
    id: randomUUID(),
  };
  const copy = widgetCopy(site.locale);
  const ticket = issueWidgetToken(value, "frame", claims, at);
  logger.info("widget.bootstrap_allowed", {
    siteId: site.siteId,
    siteKeyId: site.siteKeyId,
    environment: site.environment,
  });
  return Response.json(
    {
      frame: `${value.appOrigin}/widget/v1/frame?t=${ticket}`,
      token: issueWidgetToken(value, "bootstrap", claims, at),
      expiresIn: BOOTSTRAP_TTL_SECONDS,
      title: site.widgetTitle,
      theme: { accent: site.accentColor, position: site.position },
      handoffUrl: site.handoffUrl,
      copy: {
        lang: copy.lang,
        open: copy.open,
        close: copy.close,
        loading: copy.loading,
        failed: copy.failed,
        retry: copy.retry,
        person: copy.person,
        personFallback: copy.personFallback,
      },
    },
    {
      headers: {
        ...baseHeaders,
        // This one origin, never `*`, and never with credentials.
        "Access-Control-Allow-Origin": embed.origin,
        "Cross-Origin-Resource-Policy": "cross-origin",
        Vary: "Origin",
      },
    },
  );
}

function documentResponse(
  html: string,
  status: number,
  csp: string,
  headers: Record<string, string> = {},
) {
  return new Response(html, {
    status,
    headers: {
      ...baseHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": csp,
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy":
        "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()",
      // Lets a customer page that uses cross-origin isolation embed the frame.
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "cross-origin",
      ...headers,
    },
  });
}

/**
 * GET /widget/v1/frame. The signed ticket names the one origin that may frame
 * this document, so the header lists that origin and no other domain.
 */
export async function handleFrame(
  request: Request,
  { config, store, logger, now }: WidgetDeps,
): Promise<Response> {
  const refuse = (status: number, headers: Record<string, string> = {}) =>
    documentResponse(renderFrameRefusal(), status, REFUSED_FRAME_CSP, {
      "X-Frame-Options": "DENY",
      ...headers,
    });
  if (!config.ok) {
    unavailable(logger, config.problem);
    return refuse(503);
  }
  const { value } = config;
  const at = now();
  const ticket = new URL(request.url).searchParams.get("t") ?? "";
  const verified = verifyWidgetToken(value, "frame", ticket, at);
  const embed = verified.ok
    ? parseEmbedOrigin(verified.claims.origin, {
        allowLoopback: value.allowLoopbackOrigins,
      })
    : null;
  if (!verified.ok || !embed) {
    logger.info("widget.frame_denied", {
      reason: verified.ok ? "origin" : verified.reason,
    });
    return refuse(403);
  }

  const result = await store.frame({
    siteKeyId: verified.claims.siteKeyId,
    hostname: embed.hostname,
    clientHash: clientHash(request.headers, value, at),
  });
  if (result.outcome === "rate_limited") {
    logger.warn("widget.rate_limited", { stage: "frame" });
    return refuse(429, { "Retry-After": String(result.retryAfter) });
  }
  if (result.outcome === "denied") {
    logger.info("widget.frame_denied", { reason: "policy" });
    return refuse(403);
  }
  return documentResponse(
    renderFrame({ embedOrigin: embed.origin, site: result.site }),
    200,
    frameCsp(embed.origin),
  );
}

/** Requests from the frame itself: same origin as this application. */
function isFromFrame(
  headers: Headers,
  appOrigin: string,
  needsOrigin: boolean,
) {
  const origin = headers.get("origin");
  return (
    (origin === appOrigin || (origin === null && !needsOrigin)) &&
    fetchMetadataFits(headers, {
      mode: ["cors", "same-origin"],
      dest: "empty",
      site: "same-origin",
    })
  );
}

/** POST /api/widget/v1/session: one bootstrap token buys one session. */
export async function handleCreateSession(
  request: Request,
  { config, store, logger, now }: WidgetDeps,
): Promise<Response> {
  if (!config.ok) return unavailable(logger, config.problem);
  const { value } = config;
  const rejected = (reason: string) => {
    logger.info("widget.session_rejected", { reason });
    return problem(401, "WIDGET_TOKEN_REJECTED");
  };

  if (!isFromFrame(request.headers, value.appOrigin, true)) {
    logger.info("widget.session_rejected", { reason: "request_origin" });
    return problem(403, "WIDGET_DENIED");
  }
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:;|$)/i.test(type)) {
    return problem(415, "WIDGET_BAD_REQUEST");
  }
  const body = await readSmallBody(request);
  if (body === null) return problem(413, "WIDGET_BAD_REQUEST");
  const { token, embedder } = parseRecord(body) ?? {};
  if (typeof token !== "string" || typeof embedder !== "string") {
    return problem(400, "WIDGET_BAD_REQUEST");
  }

  const at = now();
  const verified = verifyWidgetToken(value, "bootstrap", token, at);
  if (!verified.ok) return rejected(verified.reason);
  const { claims } = verified;
  const embed = parseEmbedOrigin(claims.origin, {
    allowLoopback: value.allowLoopbackOrigins,
  });
  // The frame reports the parent the browser told it about.
  if (!embed || embedder !== claims.origin) return rejected("embedder");

  const result = await store.createSession({
    siteKeyId: claims.siteKeyId,
    hostname: embed.hostname,
    origin: embed.origin,
    bootstrapId: claims.id,
    clientHash: clientHash(request.headers, value, at),
    ttlSeconds: SESSION_TTL_SECONDS,
  });
  if (result.outcome === "rate_limited") {
    logger.warn("widget.rate_limited", { stage: "session" });
    return limited(result.retryAfter);
  }
  if (result.outcome !== "allowed") return rejected(result.outcome);

  // The database row is the authority on when the session ends.
  const expiresAt = Math.min(
    Math.floor(result.expiresAt.getTime() / 1000),
    Math.floor(at.getTime() / 1000) + SESSION_TTL_SECONDS,
  );
  logger.info("widget.session_created", {
    siteKeyId: claims.siteKeyId,
    widgetId: result.sessionId,
  });
  return Response.json(
    {
      session: issueWidgetToken(
        value,
        "session",
        {
          siteKeyId: claims.siteKeyId,
          origin: embed.origin,
          id: result.sessionId,
        },
        at,
        expiresAt,
      ),
      expiresIn: expiresAt - Math.floor(at.getTime() / 1000),
    },
    { status: 201, headers: baseHeaders },
  );
}

export interface WidgetSessionContext {
  sessionId: string;
  siteKeyId: string;
  organizationId: string;
  siteId: string;
  origin: string;
  expiresAt: Date;
}

export type WidgetSessionGuard =
  | { ok: true; session: WidgetSessionContext }
  | { ok: false; response: Response };

/**
 * The gate for every request made with a session token (P1.4 messages use it).
 * The signature alone is never enough: the live check lets a revoked key, a
 * removed domain, an inactive site or a revoked session take effect at once.
 */
export async function requireWidgetSession(
  request: Request,
  { config, store, logger, now }: WidgetDeps,
): Promise<WidgetSessionGuard> {
  const refuse = (response: Response, reason: string): WidgetSessionGuard => {
    logger.info("widget.session_rejected", { reason });
    return { ok: false, response };
  };
  if (!config.ok) {
    return { ok: false, response: unavailable(logger, config.problem) };
  }
  const { value } = config;
  const safeMethod = request.method === "GET" || request.method === "HEAD";
  if (!isFromFrame(request.headers, value.appOrigin, !safeMethod)) {
    return refuse(problem(403, "WIDGET_DENIED"), "request_origin");
  }
  const token =
    /^Bearer ([A-Za-z0-9._-]+)$/.exec(
      request.headers.get("authorization") ?? "",
    )?.[1] ?? "";
  const verified = verifyWidgetToken(value, "session", token, now());
  if (!verified.ok) {
    return refuse(problem(401, "WIDGET_TOKEN_REJECTED"), verified.reason);
  }
  const { claims } = verified;
  const embed = parseEmbedOrigin(claims.origin, {
    allowLoopback: value.allowLoopbackOrigins,
  });
  if (!embed) return refuse(problem(401, "WIDGET_TOKEN_REJECTED"), "origin");

  const result = await store.checkSession({
    sessionId: claims.id,
    siteKeyId: claims.siteKeyId,
    origin: embed.origin,
    hostname: embed.hostname,
  });
  if (result.outcome === "rate_limited") {
    return refuse(limited(result.retryAfter), "rate_limited");
  }
  if (result.outcome === "denied") {
    return refuse(problem(401, "WIDGET_TOKEN_REJECTED"), "not_live");
  }
  return {
    ok: true,
    session: {
      sessionId: claims.id,
      siteKeyId: claims.siteKeyId,
      organizationId: result.organizationId,
      siteId: result.siteId,
      origin: embed.origin,
      expiresAt: result.expiresAt,
    },
  };
}

/** GET /api/widget/v1/session: is this session still live? */
export async function handleReadSession(
  request: Request,
  deps: WidgetDeps,
): Promise<Response> {
  const guard = await requireWidgetSession(request, deps);
  if (!guard.ok) return guard.response;
  const remaining = guard.session.expiresAt.getTime() - deps.now().getTime();
  return Response.json(
    { expiresIn: Math.max(0, Math.floor(remaining / 1000)) },
    { headers: baseHeaders },
  );
}
