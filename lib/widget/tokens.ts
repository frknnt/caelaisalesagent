import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import type { WidgetConfig, WidgetTokenKey } from "./config";

/**
 * - `frame`: lets the frame document render for one embedding origin. It is in
 *   a URL, so it can do nothing else.
 * - `bootstrap`: buys one session, once.
 * - `session`: what the frame uses afterwards.
 */
export const widgetAudiences = ["frame", "bootstrap", "session"] as const;
export type WidgetAudience = (typeof widgetAudiences)[number];

export const BOOTSTRAP_TTL_SECONDS = 120;
export const SESSION_TTL_SECONDS = 30 * 60;

const MAX_TTL_SECONDS: Record<WidgetAudience, number> = {
  frame: BOOTSTRAP_TTL_SECONDS,
  bootstrap: BOOTSTRAP_TTL_SECONDS,
  session: SESSION_TTL_SECONDS,
};
const CLOCK_SKEW_SECONDS = 30;
const MAX_TOKEN_LENGTH = 1024;
const VERSION = "cw1";

/** Identifiers only. A token is readable by whoever holds it. */
export interface WidgetClaims {
  siteKeyId: string;
  /** Origin of the page that embeds the widget. */
  origin: string;
  /** Bootstrap id, or session id for a session token. */
  id: string;
  expiresAt: number;
}

export type TokenRejection =
  "malformed" | "signature" | "audience" | "issuer" | "expired" | "lifetime";

export type TokenVerification =
  { ok: true; claims: WidgetClaims } | { ok: false; reason: TokenRejection };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Separate keys per purpose, so no token or hash can stand in for another. */
export function derivePurposeKey({ secret }: WidgetTokenKey, purpose: string) {
  return Buffer.from(
    hkdfSync("sha256", secret, "cael-widget", `cael-widget/${purpose}`, 32),
  );
}

function sign(key: WidgetTokenKey, audience: WidgetAudience, input: string) {
  return createHmac("sha256", derivePurposeKey(key, `token/${audience}`))
    .update(input)
    .digest();
}

const seconds = (now: Date) => Math.floor(now.getTime() / 1000);

export function issueWidgetToken(
  config: Pick<WidgetConfig, "keys" | "appOrigin">,
  audience: WidgetAudience,
  claims: Pick<WidgetClaims, "siteKeyId" | "origin" | "id">,
  now: Date,
  expiresAt = seconds(now) + MAX_TTL_SECONDS[audience],
): string {
  const [key] = config.keys;
  const payload = Buffer.from(
    JSON.stringify({
      aud: audience,
      iss: config.appOrigin,
      key: claims.siteKeyId,
      org: claims.origin,
      jti: claims.id,
      iat: seconds(now),
      exp: expiresAt,
    }),
  ).toString("base64url");
  const input = `${VERSION}.${key.kid}.${payload}`;
  return `${input}.${sign(key, audience, input).toString("base64url")}`;
}

export function verifyWidgetToken(
  config: Pick<WidgetConfig, "keys" | "appOrigin">,
  audience: WidgetAudience,
  token: string,
  now: Date,
): TokenVerification {
  const reject = (reason: TokenRejection): TokenVerification => ({
    ok: false,
    reason,
  });
  if (token.length > MAX_TOKEN_LENGTH) return reject("malformed");
  const match =
    /^(cw1)\.([a-z0-9]{1,12})\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(
      token,
    );
  const [, version, kid, payload, signature] = match ?? [];
  if (!version || !kid || !payload || !signature) return reject("malformed");

  const key = config.keys.find((candidate) => candidate.kid === kid);
  if (!key) return reject("signature");
  // The key depends on the audience the caller expects, not on the payload.
  const expected = sign(key, audience, `${version}.${kid}.${payload}`);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return reject("signature");
  }

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return reject("malformed");
  }
  const { aud, iss, key: siteKeyId, org: origin, jti: id, iat, exp } = claims;
  if (aud !== audience) return reject("audience");
  if (iss !== config.appOrigin) return reject("issuer");
  if (
    typeof siteKeyId !== "string" ||
    !uuidPattern.test(siteKeyId) ||
    typeof id !== "string" ||
    !uuidPattern.test(id) ||
    typeof origin !== "string" ||
    !Number.isSafeInteger(iat) ||
    !Number.isSafeInteger(exp)
  ) {
    return reject("malformed");
  }
  const issuedAt = iat as number;
  const expiresAt = exp as number;
  const current = seconds(now);
  if (
    issuedAt > current + CLOCK_SKEW_SECONDS ||
    expiresAt - issuedAt > MAX_TTL_SECONDS[audience]
  ) {
    return reject("lifetime");
  }
  if (expiresAt <= current) return reject("expired");
  return { ok: true, claims: { siteKeyId, origin, id, expiresAt } };
}
