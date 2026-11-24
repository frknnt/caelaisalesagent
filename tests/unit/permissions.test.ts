import { describe, expect, it } from "vitest";

import { hasPermission, roles } from "@/lib/auth/permissions";

describe("organization role matrix", () => {
  it("keeps the five roles explicit and ordered", () => {
    expect(roles).toEqual(["owner", "admin", "editor", "sales", "viewer"]);
  });

  it.each([
    ["owner", "members:manage", true],
    ["admin", "members:manage", true],
    ["editor", "members:manage", false],
    ["editor", "content:write", true],
    ["sales", "content:write", false],
    ["sales", "content:read", true],
    ["viewer", "content:read", true],
  ] as const)(
    "maps %s / %s deterministically",
    (role, permission, expected) => {
      expect(hasPermission(role, permission)).toBe(expected);
    },
  );
});
