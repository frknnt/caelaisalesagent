import { randomBytes } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { clientHash, clientNetwork } from "@/lib/widget/client-hash";
import { parseTokenKeys, readWidgetConfig } from "@/lib/widget/config";
import {
  domainChallenge,
  isDomainProven,
} from "@/lib/widget/domain-verification";
import { canAllowSubdomains, parseEmbedOrigin } from "@/lib/widget/origin";
import { inkOn } from "@/widget/protocol";

const secret = Buffer.alloc(32, 7).toString("base64url");
const hosted = {
  APP_BASE_URL: "https://app.cael.example",
  WIDGET_TOKEN_SECRETS: `k1:${secret}`,
  WIDGET_CLIENT_IP_HEADER: "x-real-ip",
};

describe("widget configuration", () => {
  it("reads a complete hosted environment", () => {
    const result = readWidgetConfig(hosted, "production");
    expect(result).toMatchObject({
      ok: true,
      value: {
        appOrigin: "https://app.cael.example",
        clientIpHeader: "x-real-ip",
        allowLoopbackOrigins: false,
      },
    });
  });

  it.each<[string, Record<string, string | undefined>, string]>([
    ["no environment", {}, "APP_BASE_URL"],
    [
      "plain http outside loopback",
      { ...hosted, APP_BASE_URL: "http://app.cael.example" },
      "APP_BASE_URL",
    ],
    [
      "no secret",
      { ...hosted, WIDGET_TOKEN_SECRETS: undefined },
      "WIDGET_TOKEN_SECRETS",
    ],
    [
      "empty secret",
      { ...hosted, WIDGET_TOKEN_SECRETS: " " },
      "WIDGET_TOKEN_SECRETS",
    ],
    [
      "short secret",
      {
        ...hosted,
        WIDGET_TOKEN_SECRETS: `k1:${Buffer.alloc(31).toString("base64url")}`,
      },
      "WIDGET_TOKEN_SECRETS",
    ],
    [
      "secret without a key id",
      { ...hosted, WIDGET_TOKEN_SECRETS: secret },
      "WIDGET_TOKEN_SECRETS",
    ],
    [
      "one bad entry among good ones",
      { ...hosted, WIDGET_TOKEN_SECRETS: `k2:${secret},k1:short` },
      "WIDGET_TOKEN_SECRETS",
    ],
    [
      "the same key id twice",
      { ...hosted, WIDGET_TOKEN_SECRETS: `k1:${secret},k1:${secret}` },
      "WIDGET_TOKEN_SECRETS",
    ],
    [
      "no client address outside loopback",
      { ...hosted, WIDGET_CLIENT_IP_HEADER: undefined },
      "WIDGET_CLIENT_IP_HEADER",
    ],
    [
      "a header name that is not one",
      { ...hosted, WIDGET_CLIENT_IP_HEADER: "x real ip" },
      "WIDGET_CLIENT_IP_HEADER",
    ],
  ])("stays off with %s", (_, env, problem) => {
    expect(readWidgetConfig(env, "production")).toEqual({ ok: false, problem });
  });

  it("allows loopback pages only when it runs on loopback itself", () => {
    const local = readWidgetConfig(
      { ...hosted, APP_BASE_URL: "http://127.0.0.1:3211" },
      "production",
    );
    expect(local).toMatchObject({
      ok: true,
      value: { allowLoopbackOrigins: true },
    });
    const lookalike = readWidgetConfig(
      { ...hosted, APP_BASE_URL: "https://localhost.evil.example" },
      "production",
    );
    expect(lookalike).toMatchObject({
      ok: true,
      value: { allowLoopbackOrigins: false },
    });
  });

  it("keeps the first key for signing", () => {
    const other = randomBytes(32).toString("base64url");
    const keys = parseTokenKeys(`new:${other}, old:${secret}`);
    expect(keys?.map(({ kid }) => kid)).toEqual(["new", "old"]);
  });
});

describe("embedding origin", () => {
  const hostedRule = { allowLoopback: false };
  const localRule = { allowLoopback: true };

  it.each([
    ["https://shop-a.example", "shop-a.example"],
    ["https://www.shop-a.example", "www.shop-a.example"],
    ["https://xn--maaza-n1a.example", "xn--maaza-n1a.example"],
  ])("accepts %s", (origin, hostname) => {
    expect(parseEmbedOrigin(origin, hostedRule)).toEqual({ origin, hostname });
  });

  it.each([
    ["a missing header", null],
    ["an empty header", ""],
    ["an opaque origin", "null"],
    ["plain http", "http://shop-a.example"],
    ["another port", "https://shop-a.example:8443"],
    ["a written default port", "https://shop-a.example:443"],
    ["a trailing slash", "https://shop-a.example/"],
    ["a path", "https://shop-a.example/page"],
    ["credentials", "https://user@shop-a.example"],
    ["upper case", "https://SHOP-A.example"],
    ["a trailing dot", "https://shop-a.example."],
    ["two origins", "https://shop-a.example https://evil.example"],
    ["a single label", "https://intranet"],
    ["an IPv4 address", "https://203.0.113.7"],
    ["an IPv6 address", "https://[2001:db8::1]"],
    ["an underscore", "https://shop_a.example"],
    ["localhost", "https://localhost"],
    ["a localhost name", "http://shop-a.localhost:3212"],
    ["a file", "file://"],
    ["an extension", "chrome-extension://abcdefghijklmnop"],
    ["javascript", "javascript:alert(1)"],
    ["a very long value", `https://${"a".repeat(300)}.example`],
  ])("rejects %s", (_, origin) => {
    expect(parseEmbedOrigin(origin, hostedRule)).toBeNull();
  });

  it("accepts localhost names on a loopback server, and nothing like them", () => {
    expect(parseEmbedOrigin("http://shop-a.localhost:3212", localRule)).toEqual(
      { origin: "http://shop-a.localhost:3212", hostname: "shop-a.localhost" },
    );
    for (const origin of [
      "http://localhost:3212",
      "http://127.0.0.1:3212",
      "http://shop-a.localhost.evil.example",
      "http://shop-a.example",
    ]) {
      expect(parseEmbedOrigin(origin, localRule), origin).toBeNull();
    }
  });
});

describe("wildcard policy", () => {
  it.each([
    "example.com",
    "shop.example.com",
    "example.co.uk",
    "ornek.com.tr",
    "my-app.vercel.app",
    "team.github.io",
  ])("allows subdomains of %s", (hostname) => {
    expect(canAllowSubdomains(hostname)).toBe(true);
  });

  it.each([
    "com",
    "co.uk",
    "com.tr",
    "gov.tr",
    "vercel.app",
    "netlify.app",
    "github.io",
    "pages.dev",
    "web.app",
    "myshopify.com",
    "herokuapp.com",
    "203.0.113.7",
    "localhost",
    "shop.localhost",
    "unknown-suffix.invalid",
    "*.example.com",
    "",
  ])("refuses subdomains of %s", (hostname) => {
    expect(canAllowSubdomains(hostname)).toBe(false);
  });
});

describe("client hash", () => {
  const config = readWidgetConfig(hosted, "production");
  if (!config.ok) throw new Error("fixture");
  const day = new Date("2026-11-24T10:00:00Z");
  const hash = (address: string | null, at = day, header = "x-real-ip") =>
    clientHash(
      new Headers(address === null ? {} : { [header]: address }),
      config.value,
      at,
    );

  it("is stable for a day and unrelated the next day", () => {
    expect(hash("203.0.113.7")).toBe(
      hash("203.0.113.7", new Date("2026-11-24T23:59:59Z")),
    );
    expect(hash("203.0.113.7")).not.toBe(
      hash("203.0.113.7", new Date("2026-11-25T00:00:00Z")),
    );
  });

  it("never contains the address", () => {
    expect(hash("203.0.113.7")).toMatch(/^[0-9a-f]{64}$/);
    expect(hash("203.0.113.7")).not.toBe(hash("203.0.113.8"));
  });

  it("uses what the nearest proxy added, not what the client claims", () => {
    expect(hash("198.51.100.1, 203.0.113.7")).toBe(hash("203.0.113.7"));
    expect(hash("203.0.113.7", day, "x-forwarded-for")).toBe(hash(null));
  });

  it("groups addresses a single client can rotate through", () => {
    expect(clientNetwork("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2");
    expect(clientNetwork("2001:0db8:0001:0002:bbbb::9")).toBe("2001:db8:1:2");
    expect(clientNetwork("2001:db8::1")).toBe("2001:db8:0:0");
    expect(clientNetwork("::1")).toBe("0:0:0:0");
    expect(clientNetwork("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(clientNetwork("not-an-address")).toBeNull();
  });

  it("puts unreadable addresses in one shared bucket", () => {
    expect(hash("garbage")).toBe(hash(null));
    expect(hash(null)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is absent only where no header is configured", () => {
    expect(
      clientHash(
        new Headers({ "x-real-ip": "203.0.113.7" }),
        { ...config.value, clientIpHeader: null },
        day,
      ),
    ).toBeNull();
  });
});

describe("domain proof", () => {
  const token = "0123456789abcdef0123456789abcdef";
  const { name, value } = domainChallenge("shop-a.example", token);

  it("asks for a record below the name itself", () => {
    expect(name).toBe("_cael-challenge.shop-a.example");
    expect(value).toBe(`cael-site-verification=${token}`);
  });

  it("accepts only the exact record", async () => {
    const proven = (records: string[]) =>
      isDomainProven({ txt: async () => records }, "shop-a.example", token);
    expect(await proven(["v=spf1 -all", value])).toBe(true);
    for (const records of [
      [],
      [`${value} `],
      [`x${value}`],
      [token],
      ["cael-site-verification=ffffffffffffffffffffffffffffffff"],
    ]) {
      expect(await proven(records), JSON.stringify(records)).toBe(false);
    }
  });

  it("looks up the challenge name of that host only", async () => {
    const txt = vi.fn(async () => [value]);
    await isDomainProven({ txt }, "shop-a.example", token);
    expect(txt.mock.calls).toEqual([["_cael-challenge.shop-a.example"]]);
  });

  it("is not proven when DNS fails or hangs", async () => {
    const failing = { txt: () => Promise.reject(new Error("ENOTFOUND")) };
    const hanging = { txt: () => new Promise<string[]>(() => {}) };
    expect(await isDomainProven(failing, "shop-a.example", token)).toBe(false);
    expect(await isDomainProven(hanging, "shop-a.example", token, 20)).toBe(
      false,
    );
  });
});

describe("text on the accent color", () => {
  const luminance = (hex: string) => {
    const channel = (offset: number) => {
      const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const contrast = (left: string, right: string) => {
    const [light = 0, dark = 0] = [luminance(left), luminance(right)].sort(
      (a, b) => b - a,
    );
    return (light + 0.05) / (dark + 0.05);
  };

  it("reads at AA on every color of a 9 x 9 x 9 grid", () => {
    const steps = [0, 32, 64, 96, 128, 160, 192, 224, 255];
    for (const red of steps) {
      for (const green of steps) {
        for (const blue of steps) {
          const hex = `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
          expect(contrast(inkOn(hex), hex), hex).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
