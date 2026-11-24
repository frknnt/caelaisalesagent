import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "@/proxy";

// Uses Next.js' own matcher compiler, so it sees the pattern as the server does.
const matches = (path: string) =>
  doesProxyMatch({ config, url: `http://localhost${path}` });

describe("proxy matcher", () => {
  it.each([
    "/x.png",
    "/opengraph-image.jpg",
    "/images/hero.webp",
    "/icon.svg",
    "/a.b/c.jpeg",
    "/anim.gif",
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
  ])("skips the static file %s", (path) => {
    expect(matches(path)).toBe(false);
  });

  it.each(["svg", "png", "jpg", "jpeg", "gif", "webp"])(
    "runs for a path that only ends in the letters %s",
    (extension) => {
      for (const path of [
        `/app/x${extension}`,
        `/app/${extension}`,
        `/api/foo${extension}`,
        `/api/foo-${extension}`,
        `/app/test-harness/${extension}`,
      ]) {
        expect(matches(path), path).toBe(true);
      }
    },
  );

  it.each([
    "/",
    "/login",
    "/app",
    "/app/team",
    "/api/health",
    "/api/tenant-context",
    "/api/organizations/a0000000-0000-4000-8000-000000000001/context",
    "/app/file.pngx",
    "/app/file.svg/edit",
  ])("runs for %s", (path) => {
    expect(matches(path)).toBe(true);
  });

  it("replaces a client request id on a matched path without a dot", async () => {
    const clientId = "f0000000-0000-4000-8000-000000000009";
    const request = new NextRequest("http://localhost/api/foosvg", {
      headers: { "x-request-id": clientId },
    });
    expect(matches("/api/foosvg")).toBe(true);
    const response = await proxy(request);
    const requestId = response.headers.get("x-request-id");
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestId).not.toBe(clientId);
    expect(request.headers.get("x-request-id")).toBe(requestId);
  });
});
