import { describe, expect, it, vi } from "vitest";

import {
  createMemoryIdempotencyStore,
  executeOnce,
  type IdempotencyStore,
} from "@/lib/connectors/idempotency";
import { ConnectorError } from "@/lib/connectors/ports";
import {
  FakeCalendar,
  FakeCrm,
  FakeWebhook,
} from "@/lib/testing/fake-connectors";
import { fixtureSlots, tenantA, tenantB } from "@/lib/testing/fixtures";

const event = "lead.created";
const orgA = tenantA.organizationId;
const orgB = tenantB.organizationId;

function deliver(
  store: IdempotencyStore,
  webhook: FakeWebhook,
  overrides: { organizationId?: string; key?: string; payload?: object } = {},
) {
  const organizationId = overrides.organizationId ?? orgA;
  const key = overrides.key ?? "evt-1";
  const payload = { leadId: "lead-1", ...overrides.payload };
  return executeOnce(store, {
    organizationId,
    operation: "webhook.deliver",
    key,
    input: { event, payload },
    run: () =>
      webhook.deliver({ organizationId, idempotencyKey: key, event, payload }),
  });
}

describe("webhook duplicates", () => {
  it("delivers once and replays the stored result for a duplicate", async () => {
    const store = createMemoryIdempotencyStore();
    const webhook = new FakeWebhook();
    const first = await deliver(store, webhook);
    const second = await deliver(store, webhook);

    expect(first).toEqual({
      status: "executed",
      result: { deliveryId: "delivery:evt-1" },
    });
    expect(second).toEqual({
      status: "duplicate",
      result: { deliveryId: "delivery:evt-1" },
    });
    expect(webhook.attempts).toHaveLength(1);
  });

  it("delivers once when duplicates arrive at the same time", async () => {
    const store = createMemoryIdempotencyStore();
    const webhook = new FakeWebhook();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => deliver(store, webhook)),
    );

    expect(webhook.attempts).toHaveLength(1);
    expect(results.map((result) => result.status)).toEqual([
      "executed",
      ...Array.from({ length: 4 }, () => "in_progress"),
    ]);
  });

  it("rejects a reused key with a different payload", async () => {
    const store = createMemoryIdempotencyStore();
    const webhook = new FakeWebhook();
    await deliver(store, webhook);
    expect(
      await deliver(store, webhook, { payload: { leadId: "lead-2" } }),
    ).toEqual({ status: "conflict" });
    expect(webhook.attempts).toHaveLength(1);
  });

  it("treats reordered payload keys as the same request", async () => {
    const store = createMemoryIdempotencyStore();
    const webhook = new FakeWebhook();
    const run = (input: unknown) =>
      executeOnce(store, {
        organizationId: orgA,
        operation: "webhook.deliver",
        key: "evt-1",
        input,
        run: () =>
          webhook.deliver({
            organizationId: orgA,
            idempotencyKey: "evt-1",
            event,
            payload: {},
          }),
      });
    await run({ a: 1, b: { c: [1, 2], d: 2 } });
    expect((await run({ b: { d: 2, c: [1, 2] }, a: 1 })).status).toBe(
      "duplicate",
    );
    expect((await run({ b: { d: 2, c: [2, 1] }, a: 1 })).status).toBe(
      "conflict",
    );
  });

  it("keeps tenants apart, including keys built to collide", async () => {
    const store = createMemoryIdempotencyStore();
    const webhook = new FakeWebhook();
    expect((await deliver(store, webhook)).status).toBe("executed");
    expect(
      (await deliver(store, webhook, { organizationId: orgB })).status,
    ).toBe("executed");
    expect(webhook.processedFor(orgA)).toHaveLength(1);
    expect(webhook.processedFor(orgB)).toHaveLength(1);

    const run = vi.fn(async () => "ran");
    const shared = { input: {}, run };
    await executeOnce(store, {
      ...shared,
      organizationId: "org",
      operation: "a",
      key: 'b","c',
    });
    await executeOnce(store, {
      ...shared,
      organizationId: "org",
      operation: 'a","b',
      key: "c",
    });
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("webhook retries", () => {
  it.each(["timeout", "unavailable"] as const)(
    "%s before processing: the same key can be retried",
    async (fault) => {
      const store = createMemoryIdempotencyStore();
      const webhook = new FakeWebhook();
      webhook.faults.push(fault);

      await expect(deliver(store, webhook)).rejects.toEqual(
        new ConnectorError(fault),
      );
      expect(webhook.processedFor(orgA)).toEqual([]);
      expect((await deliver(store, webhook)).status).toBe("executed");
      expect(webhook.processedFor(orgA)).toHaveLength(1);
    },
  );

  it("lost response: the retry carries the same key, so it is processed once", async () => {
    const store = createMemoryIdempotencyStore();
    const webhook = new FakeWebhook();
    webhook.faults.push("lost_response");

    await expect(deliver(store, webhook)).rejects.toThrow("timeout");
    expect((await deliver(store, webhook)).status).toBe("executed");
    expect(webhook.attempts.map((item) => item.idempotencyKey)).toEqual([
      "evt-1",
      "evt-1",
    ]);
    expect(webhook.processedFor(orgA)).toHaveLength(1);
  });
});

describe("fake CRM", () => {
  const contact = (organizationId: string, email: string, key: string) => ({
    organizationId,
    email,
    idempotencyKey: key,
  });

  it("upserts by address within a tenant and never across tenants", async () => {
    const crm = new FakeCrm();
    const first = await crm.upsertContact(
      contact(orgA, "lead@example.test", "k1"),
    );
    const again = await crm.upsertContact(
      contact(orgA, " LEAD@example.test ", "k2"),
    );
    await crm.upsertContact(contact(orgB, "lead@example.test", "k1"));

    expect(again).toEqual(first);
    expect(crm.contactCount(orgA)).toBe(1);
    expect(crm.contactCount(orgB)).toBe(1);
  });

  it("creates one contact when a lost response is retried", async () => {
    const crm = new FakeCrm();
    crm.faults.push("lost_response");
    const write = contact(orgA, "lead@example.test", "k1");
    await expect(crm.upsertContact(write)).rejects.toThrow("timeout");
    await crm.upsertContact(write);
    expect(crm.contactCount(orgA)).toBe(1);
  });
});

describe("fake calendar", () => {
  const booking = (slotId: string, key: string, organizationId = orgA) => ({
    organizationId,
    slotId,
    idempotencyKey: key,
  });

  it("books a listed slot once and repeats the result for the same key", async () => {
    const calendar = new FakeCalendar(fixtureSlots);
    const first = await calendar.book(booking("slot-a-1", "k1"));
    expect(first).toEqual({ status: "booked", bookingId: "booking:slot-a-1" });
    expect(await calendar.book(booking("slot-a-1", "k1"))).toEqual(first);
    expect(await calendar.book(booking("slot-a-1", "k2"))).toEqual({
      status: "unavailable",
    });
    expect((await calendar.listSlots(orgA)).map((slot) => slot.id)).toEqual([
      "slot-a-2",
    ]);
  });

  it("refuses an invented slot and another tenant's slot", async () => {
    const calendar = new FakeCalendar(fixtureSlots);
    for (const slotId of ["tomorrow-at-nine", "slot-b-1"]) {
      expect(await calendar.book(booking(slotId, "k1"))).toEqual({
        status: "unavailable",
      });
    }
    expect((await calendar.listSlots(orgB)).map((slot) => slot.id)).toEqual([
      "slot-b-1",
    ]);
  });

  it("books once when a lost response is retried", async () => {
    const calendar = new FakeCalendar(fixtureSlots);
    calendar.faults.push("lost_response");
    await expect(calendar.book(booking("slot-a-1", "k1"))).rejects.toThrow();
    expect(await calendar.book(booking("slot-a-1", "k1"))).toEqual({
      status: "booked",
      bookingId: "booking:slot-a-1",
    });
  });
});
