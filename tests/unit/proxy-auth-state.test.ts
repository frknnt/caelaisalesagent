import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

import { copyAuthState } from "@/lib/supabase/proxy";

describe("proxy auth response propagation", () => {
  it("copies auth cookies and every anti-cache header onto redirects", () => {
    const source = NextResponse.next();
    source.cookies.set("sb-session", "fixture", { httpOnly: true });
    source.headers.set("Cache-Control", "private, no-cache, no-store");
    source.headers.set("Expires", "0");
    source.headers.set("Pragma", "no-cache");

    const result = copyAuthState(
      source,
      NextResponse.redirect("http://localhost/login"),
    );

    expect(result.cookies.get("sb-session")?.value).toBe("fixture");
    expect(result.headers.get("cache-control")).toBe(
      "private, no-cache, no-store",
    );
    expect(result.headers.get("expires")).toBe("0");
    expect(result.headers.get("pragma")).toBe("no-cache");
  });
});
