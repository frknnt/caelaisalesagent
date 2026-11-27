import { describe, expect, it } from "vitest";

import { hasPermission } from "@/lib/auth/permissions";
import { readInboxEmailConfig } from "@/lib/inbox/notifications";

describe("P1.5 inbox boundaries", () => {
  it("limits inbox mutation to sales and administrative roles", () => {
    expect(hasPermission("owner", "inbox:manage")).toBe(true);
    expect(hasPermission("admin", "inbox:manage")).toBe(true);
    expect(hasPermission("sales", "inbox:manage")).toBe(true);
    expect(hasPermission("editor", "inbox:manage")).toBe(false);
    expect(hasPermission("viewer", "inbox:manage")).toBe(false);
  });

  it("accepts only a secret-backed HTTPS delivery hook", () => {
    expect(
      readInboxEmailConfig({
        INBOX_EMAIL_WEBHOOK_URL: "https://mail.example.test/inbox",
        INBOX_EMAIL_WEBHOOK_TOKEN: "x".repeat(32),
      }),
    ).toEqual({
      url: "https://mail.example.test/inbox",
      token: "x".repeat(32),
    });
    expect(
      readInboxEmailConfig({
        INBOX_EMAIL_WEBHOOK_URL: "http://mail.example.test/inbox",
        INBOX_EMAIL_WEBHOOK_TOKEN: "x".repeat(32),
      }),
    ).toBeNull();
    expect(
      readInboxEmailConfig({
        INBOX_EMAIL_WEBHOOK_URL: "https://mail.example.test/inbox",
        INBOX_EMAIL_WEBHOOK_TOKEN: "short",
      }),
    ).toBeNull();
  });
});
