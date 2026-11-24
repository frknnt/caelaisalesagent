import { describe, expect, it } from "vitest";

import {
  AuthorizationError,
  assertRequestedOrganization,
} from "@/lib/auth/authorization";

describe("tenant identifier guard", () => {
  it("accepts an omitted or matching identifier", () => {
    expect(() =>
      assertRequestedOrganization(undefined, "tenant-a"),
    ).not.toThrow();
    expect(() =>
      assertRequestedOrganization("tenant-a", "tenant-a"),
    ).not.toThrow();
  });

  it("returns the same 403 boundary for every untrusted request source", () => {
    for (const source of [
      "url",
      "query",
      "header",
      "cookie",
      "body",
      "client-state",
    ]) {
      try {
        assertRequestedOrganization(`tenant-b-${source}`, "tenant-a");
        throw new Error("guard did not reject");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthorizationError);
        expect(error).toMatchObject({ status: 403, code: "PERMISSION_DENIED" });
      }
    }
  });
});
