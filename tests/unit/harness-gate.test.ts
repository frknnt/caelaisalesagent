import { describe, expect, it } from "vitest";

import { isTestHarnessEnabled } from "@/lib/testing/harness-gate";

const local = {
  CAEL_TEST_HARNESS: "enabled",
  APP_BASE_URL: "http://127.0.0.1:3210",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65421",
};

describe("test harness gate", () => {
  it("opens only for an explicit opt-in on loopback", () => {
    expect(isTestHarnessEnabled(local)).toBe(true);
  });

  it.each<[string, Record<string, string | undefined>]>([
    ["no environment", {}],
    ["flag missing", { ...local, CAEL_TEST_HARNESS: undefined }],
    ["flag is a truthy value", { ...local, CAEL_TEST_HARNESS: "1" }],
    ["flag is true", { ...local, CAEL_TEST_HARNESS: "true" }],
    ["hosted app", { ...local, APP_BASE_URL: "https://app.cael.example" }],
    ["app URL missing", { ...local, APP_BASE_URL: undefined }],
    [
      "hosted Supabase",
      { ...local, NEXT_PUBLIC_SUPABASE_URL: "https://ref.supabase.co" },
    ],
    [
      "host that only starts like loopback",
      { ...local, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1.evil.example" },
    ],
    [
      "loopback in the user info",
      { ...local, APP_BASE_URL: "http://localhost@evil.example" },
    ],
    ["malformed URL", { ...local, APP_BASE_URL: "localhost" }],
    ["Vercel deployment", { ...local, VERCEL: "1" }],
  ])("stays closed: %s", (_name, env) => {
    expect(isTestHarnessEnabled(env)).toBe(false);
  });
});
