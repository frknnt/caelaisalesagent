import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseTokenKeys, type WidgetConfig } from "@/lib/widget/config";
import {
  BOOTSTRAP_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  derivePurposeKey,
  issueWidgetToken,
  verifyWidgetToken,
  widgetAudiences,
  type WidgetAudience,
} from "@/lib/widget/tokens";

const key = (kid: string, fill: number) =>
  `${kid}:${Buffer.alloc(32, fill).toString("base64url")}`;

function config(raw = key("k1", 1), appOrigin = "https://app.cael.example") {
  const keys = parseTokenKeys(raw);
  if (!keys) throw new Error("fixture");
  return { keys, appOrigin } satisfies Pick<WidgetConfig, "keys" | "appOrigin">;
}

const now = new Date("2026-11-24T10:00:00Z");
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);
const claims = {
  siteKeyId: "a0000000-0000-4000-8000-000000000301",
  origin: "https://shop-a.example",
  id: "f0000000-0000-4000-8000-000000000001",
};
const issue = (audience: WidgetAudience = "bootstrap", settings = config()) =>
  issueWidgetToken(settings, audience, claims, now);

/** Signs any payload with the real key, as a leaked or buggy signer would. */
function forge(payload: object, audience: WidgetAudience = "bootstrap") {
  const [signer] = config().keys;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const input = `cw1.${signer.kid}.${body}`;
  const signature = createHmac(
    "sha256",
    derivePurposeKey(signer, `token/${audience}`),
  )
    .update(input)
    .digest("base64url");
  return `${input}.${signature}`;
}

const payloadOf = (token: string) =>
  JSON.parse(
    Buffer.from(token.split(".")[2] ?? "", "base64url").toString("utf8"),
  ) as Record<string, unknown>;

describe("widget tokens", () => {
  it.each(widgetAudiences)("round-trips a %s token", (audience) => {
    const result = verifyWidgetToken(config(), audience, issue(audience), now);
    expect(result).toMatchObject({ ok: true, claims });
  });

  it("carries identifiers and times, nothing else", () => {
    expect(Object.keys(payloadOf(issue())).sort()).toEqual([
      "aud",
      "exp",
      "iat",
      "iss",
      "jti",
      "key",
      "org",
    ]);
    expect(issue()).not.toContain(Buffer.alloc(32, 1).toString("base64url"));
  });

  it("is accepted until the last second and refused after it", () => {
    const check = (seconds: number) =>
      verifyWidgetToken(config(), "bootstrap", issue(), later(seconds));
    expect(check(BOOTSTRAP_TTL_SECONDS - 1).ok).toBe(true);
    expect(check(BOOTSTRAP_TTL_SECONDS)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(
      verifyWidgetToken(
        config(),
        "session",
        issue("session"),
        later(SESSION_TTL_SECONDS),
      ),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses any changed character", () => {
    const token = issue();
    for (let index = 0; index < token.length; index += 1) {
      const character = token[index] === "A" ? "B" : "A";
      const changed =
        token.slice(0, index) + character + token.slice(index + 1);
      if (changed === token) continue;
      const result = verifyWidgetToken(config(), "bootstrap", changed, now);
      // The last base64 character carries unused bits; same bytes, same token.
      if (
        Buffer.from(changed.split(".")[3] ?? "", "base64url").equals(
          Buffer.from(token.split(".")[3] ?? "", "base64url"),
        ) &&
        changed.split(".").slice(0, 3).join() ===
          token.split(".").slice(0, 3).join()
      ) {
        continue;
      }
      expect(result.ok, `index ${index}`).toBe(false);
    }
  });

  it("refuses a token for another purpose", () => {
    for (const issued of widgetAudiences) {
      for (const expected of widgetAudiences) {
        if (issued === expected) continue;
        expect(
          verifyWidgetToken(config(), expected, issue(issued), now),
          `${issued} as ${expected}`,
        ).toEqual({ ok: false, reason: "signature" });
      }
    }
  });

  it("refuses a payload that names another purpose even when signed", () => {
    const token = forge({ ...payloadOf(issue()), aud: "session" });
    expect(verifyWidgetToken(config(), "bootstrap", token, now)).toEqual({
      ok: false,
      reason: "audience",
    });
  });

  it("refuses a token of another deployment", () => {
    const staging = config(undefined, "https://staging.cael.example");
    expect(
      verifyWidgetToken(
        config(),
        "bootstrap",
        issue("bootstrap", staging),
        now,
      ),
    ).toEqual({ ok: false, reason: "issuer" });
  });

  it("refuses a lifetime longer than the purpose allows", () => {
    const base = payloadOf(issue());
    const iat = base.iat as number;
    expect(
      verifyWidgetToken(
        config(),
        "bootstrap",
        forge({ ...base, exp: iat + BOOTSTRAP_TTL_SECONDS + 1 }),
        now,
      ),
    ).toEqual({ ok: false, reason: "lifetime" });
    expect(
      verifyWidgetToken(
        config(),
        "bootstrap",
        forge({ ...base, iat: iat + 31, exp: iat + 60 }),
        now,
      ),
    ).toEqual({ ok: false, reason: "lifetime" });
  });

  it.each<[string, Record<string, unknown>]>([
    ["no site key", { key: undefined }],
    ["a site key that is not an id", { key: "1" }],
    ["no id", { jti: undefined }],
    ["no origin", { org: undefined }],
    ["a text expiry", { exp: "9999999999" }],
    ["no expiry", { exp: undefined }],
    ["no issue time", { iat: undefined }],
  ])("refuses a signed payload with %s", (_, change) => {
    const token = forge({ ...payloadOf(issue()), ...change });
    expect(verifyWidgetToken(config(), "bootstrap", token, now)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it.each([
    "",
    "cw1",
    "a.b.c.d",
    "cw2.k1.e30.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "eyJhbGciOiJub25lIn0.e30.",
    "x".repeat(5000),
  ])("refuses %j", (token) => {
    expect(verifyWidgetToken(config(), "bootstrap", token, now).ok).toBe(false);
  });

  it("rotates keys without ending live sessions", () => {
    const old = issue("session", config(key("old", 1)));
    const during = config(`${key("new", 2)},${key("old", 1)}`);
    expect(verifyWidgetToken(during, "session", old, now).ok).toBe(true);
    expect(issue("session", during).split(".")[1]).toBe("new");
    const after = config(key("new", 2));
    expect(verifyWidgetToken(after, "session", old, now)).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it("does not accept a new secret under an old key id", () => {
    const token = issue("session", config(key("k1", 1)));
    expect(
      verifyWidgetToken(config(key("k1", 9)), "session", token, now).ok,
    ).toBe(false);
  });
});
