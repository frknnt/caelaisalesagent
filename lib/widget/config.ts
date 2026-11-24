import { readRuntimeConfig } from "@/lib/env";

type Env = Readonly<Record<string, string | undefined>>;

export interface WidgetTokenKey {
  kid: string;
  secret: Buffer;
}

export interface WidgetConfig {
  /** Public origin of this application; also the token issuer. */
  appOrigin: string;
  /** The first key signs. The others only verify, so keys can rotate. */
  keys: readonly [WidgetTokenKey, ...WidgetTokenKey[]];
  /** Header the platform sets to the client address, or null on loopback. */
  clientIpHeader: string | null;
  /** True only when this application itself runs on loopback. */
  allowLoopbackOrigins: boolean;
}

export type WidgetConfigProblem =
  "APP_BASE_URL" | "WIDGET_TOKEN_SECRETS" | "WIDGET_CLIENT_IP_HEADER";

export type WidgetConfigResult =
  | { ok: true; value: WidgetConfig }
  | { ok: false; problem: WidgetConfigProblem };

const MIN_SECRET_BYTES = 32;

function isLoopbackHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

/** `kid:base64url` pairs, newest first, separated by commas. */
export function parseTokenKeys(
  raw: string | undefined,
): WidgetConfig["keys"] | null {
  const keys = (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): WidgetTokenKey | null => {
      const match = /^([a-z0-9]{1,12}):([A-Za-z0-9_-]+)$/.exec(part);
      const [, kid, encoded] = match ?? [];
      if (!kid || !encoded) return null;
      const secret = Buffer.from(encoded, "base64url");
      return secret.length >= MIN_SECRET_BYTES ? { kid, secret } : null;
    });
  const valid = keys.filter((key) => key !== null);
  const [first, ...rest] = valid;
  // One unreadable entry makes the whole value unusable: fail closed.
  if (!first || valid.length !== keys.length) return null;
  if (new Set(valid.map(({ kid }) => kid)).size !== valid.length) return null;
  return [first, ...rest];
}

/**
 * Everything the widget needs, or the name of the first thing missing. There
 * is no default key and no unsigned mode: without this the widget stays off.
 */
export function readWidgetConfig(
  env: Env,
  mode: "development" | "test" | "production",
): WidgetConfigResult {
  const runtime = readRuntimeConfig(env, mode);
  if (!runtime.ok) return { ok: false, problem: "APP_BASE_URL" };
  const appOrigin = runtime.value.appBaseUrl;
  const allowLoopbackOrigins = isLoopbackHost(new URL(appOrigin).hostname);
  if (!allowLoopbackOrigins && !appOrigin.startsWith("https://")) {
    return { ok: false, problem: "APP_BASE_URL" };
  }

  const keys = parseTokenKeys(env.WIDGET_TOKEN_SECRETS);
  if (!keys) return { ok: false, problem: "WIDGET_TOKEN_SECRETS" };

  const header = env.WIDGET_CLIENT_IP_HEADER?.trim().toLowerCase() || null;
  if (header !== null && !/^[a-z0-9-]{1,60}$/.test(header)) {
    return { ok: false, problem: "WIDGET_CLIENT_IP_HEADER" };
  }
  // Without it every visitor would share one limit, or none.
  if (header === null && !allowLoopbackOrigins) {
    return { ok: false, problem: "WIDGET_CLIENT_IP_HEADER" };
  }

  return {
    ok: true,
    value: { appOrigin, keys, clientIpHeader: header, allowLoopbackOrigins },
  };
}
