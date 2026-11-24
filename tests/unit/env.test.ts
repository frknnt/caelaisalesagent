import { describe, expect, it } from "vitest";

import { readRuntimeConfig, readSupabasePublicConfig } from "@/lib/env";

describe("readRuntimeConfig", () => {
  it("uses a safe local default outside production", () => {
    expect(readRuntimeConfig({}, "development")).toEqual({
      ok: true,
      value: { appBaseUrl: "http://localhost:3000" },
    });
  });

  it("returns a safe production error without leaking environment details", () => {
    const result = readRuntimeConfig(
      { INTERNAL_SECRET: "must-not-leak" },
      "production",
    );

    expect(result).toMatchObject({
      ok: false,
      status: 503,
      error: { code: "APP_BASE_URL_MISSING" },
    });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(JSON.stringify(result)).not.toContain("INTERNAL_SECRET");
  });

  it("accepts only HTTP origins", () => {
    expect(
      readRuntimeConfig(
        { APP_BASE_URL: "https://app.cael.example/path" },
        "production",
      ),
    ).toEqual({
      ok: true,
      value: { appBaseUrl: "https://app.cael.example" },
    });
    expect(
      readRuntimeConfig({ APP_BASE_URL: "file:///tmp/app" }, "production"),
    ).toMatchObject({
      ok: false,
      error: { code: "APP_BASE_URL_INVALID" },
    });
  });
});

describe("readSupabasePublicConfig", () => {
  it("requires both public values and rejects non-http URLs", () => {
    expect(readSupabasePublicConfig({})).toBeNull();
    expect(
      readSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "file:///secret",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
      }),
    ).toBeNull();
  });

  it("returns only browser-safe configuration", () => {
    expect(
      readSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65421/path",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
        SUPABASE_SECRET_KEY: "must-not-leak",
      }),
    ).toEqual({ url: "http://127.0.0.1:65421", publishableKey: "public-key" });
  });
});
