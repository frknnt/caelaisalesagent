import { describe, expect, it } from "vitest";

import { isFreshSource } from "@/lib/knowledge/freshness";

describe("knowledge freshness", () => {
  it("requires ready status and a future freshness boundary", () => {
    const now = Date.parse("2026-11-26T00:00:00.000Z");
    expect(isFreshSource("ready", "2026-11-27T00:00:00.000Z", now)).toBe(true);
    expect(isFreshSource("ready", "2026-11-25T00:00:00.000Z", now)).toBe(false);
    expect(isFreshSource("processing", "2026-11-27T00:00:00.000Z", now)).toBe(
      false,
    );
    expect(isFreshSource("ready", null, now)).toBe(false);
  });
});
