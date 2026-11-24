import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";

const updateSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/proxy", () => ({ updateSession }));

beforeEach(() => {
  updateSession.mockReset();
  updateSession.mockImplementation(async () => NextResponse.next());
});

const run = (path: string) =>
  proxy(
    new NextRequest(`http://localhost${path}`, {
      headers: { cookie: "sb-auth-token=x" },
    }),
  );

describe("proxy and the panel session", () => {
  it.each([
    "/widget/v1/loader.js",
    "/widget/v1/frame?t=x",
    "/api/widget/v1/bootstrap",
    "/api/widget/v1/session",
  ])("never touches the session for %s", async (path) => {
    const response = await run(path);
    expect(updateSession).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    "/app",
    "/app/widget/v1/frame",
    "/login",
    "/widgets",
    "/widget",
    "/api/widgets",
    "/api/domains/x/verification",
    "/api/tenant-context",
  ])("still guards %s", async (path) => {
    await run(path);
    expect(updateSession).toHaveBeenCalledTimes(1);
  });
});
