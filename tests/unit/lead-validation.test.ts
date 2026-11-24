import { describe, expect, it } from "vitest";

import { readLeadIntakeUrl } from "@/lib/env";
import {
  buildLeadPayload,
  marketingConsent,
  validateLead,
} from "@/lib/leads/validation";

const modes = ["qualifier", "meeting-booker"];

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

const contact = {
  kind: "contact",
  name: "Ada Example",
  email: "ada@example.com",
  topic: "sales",
  message: "Hello",
};

describe("lead validation", () => {
  it("accepts a complete contact request", () => {
    const result = validateLead(form(contact), modes);
    expect(result.ok).toBe(true);
  });

  it("reports every missing field by name", () => {
    const result = validateLead(form({ kind: "contact" }), modes);
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: expect.any(String),
        email: expect.any(String),
        topic: expect.any(String),
        message: expect.any(String),
      },
    });
  });

  it.each(["plain", "a@b", "a b@c.com", "@c.com"])(
    "rejects the malformed email %s",
    (email) => {
      const result = validateLead(form({ ...contact, email }), modes);
      expect(result.ok).toBe(false);
    },
  );

  it("does not require a message for a demo request", () => {
    const result = validateLead(
      form({ ...contact, topic: "demo", message: "" }),
      modes,
    );
    expect(result.ok).toBe(true);
  });

  it("requires a company for a trial and drops unknown choices", () => {
    const trial = { kind: "trial", name: "Ada", email: "ada@example.com" };
    expect(validateLead(form(trial), modes).ok).toBe(false);

    const result = validateLead(
      form({ ...trial, company: "X", agentMode: "evil", channel: "fax" }),
      modes,
    );
    expect(result.ok && result.value.agentMode).toBe("");
    expect(result.ok && result.value.channel).toBe(null);
  });

  it("never assumes marketing consent and records the evidence", () => {
    const result = validateLead(form(contact), modes);
    if (!result.ok) throw new Error("expected a valid lead");
    const payload = buildLeadPayload(result.value, {
      source: "/contact",
      submittedAt: "2026-11-24T10:00:00.000Z",
    });
    expect(payload.marketingConsent).toEqual({
      granted: false,
      purpose: marketingConsent.purpose,
      textVersion: marketingConsent.version,
      timestamp: "2026-11-24T10:00:00.000Z",
      source: "/contact",
    });
  });
});

describe("lead intake endpoint", () => {
  it("accepts https and local http only", () => {
    const read = (value?: string) =>
      readLeadIntakeUrl({ LEAD_INTAKE_WEBHOOK_URL: value });
    expect(read("https://hooks.example.com/cael")).toBe(
      "https://hooks.example.com/cael",
    );
    expect(read("http://localhost:4000/leads")).toBe(
      "http://localhost:4000/leads",
    );
    expect(read("http://hooks.example.com")).toBeNull();
    expect(read("not a url")).toBeNull();
    expect(read(undefined)).toBeNull();
  });
});
