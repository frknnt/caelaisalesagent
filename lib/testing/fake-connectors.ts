import {
  ConnectorError,
  type CalendarBooking,
  type CalendarBookingResult,
  type CalendarPort,
  type CalendarSlot,
  type CrmContact,
  type CrmPort,
  type TenantWrite,
  type WebhookDelivery,
  type WebhookPort,
} from "@/lib/connectors/ports";

/** `lost_response` applies the write, then fails as a dropped reply would. */
export type FakeConnectorFault = "timeout" | "unavailable" | "lost_response";

const tenantKey = (write: TenantWrite) =>
  JSON.stringify([write.organizationId, write.idempotencyKey]);

/** Fails one call for every queued fault. */
class FaultQueue {
  private readonly faults: FakeConnectorFault[] = [];

  push(...faults: FakeConnectorFault[]) {
    this.faults.push(...faults);
  }

  async run<Result>(apply: () => Result): Promise<Result> {
    const fault = this.faults.shift();
    if (fault === "timeout" || fault === "unavailable") {
      throw new ConnectorError(fault);
    }
    const result = apply();
    if (fault === "lost_response") throw new ConnectorError("timeout");
    return result;
  }
}

/** Receiver that deduplicates by tenant and idempotency key. */
export class FakeWebhook implements WebhookPort {
  readonly faults = new FaultQueue();
  readonly attempts: WebhookDelivery[] = [];
  private readonly processed = new Map<string, WebhookDelivery>();

  deliver(delivery: WebhookDelivery) {
    this.attempts.push(delivery);
    return this.faults.run(() => {
      const key = tenantKey(delivery);
      if (!this.processed.has(key)) this.processed.set(key, delivery);
      return { deliveryId: `delivery:${delivery.idempotencyKey}` };
    });
  }

  processedFor(organizationId: string) {
    return [...this.processed.values()].filter(
      (delivery) => delivery.organizationId === organizationId,
    );
  }
}

/** Upserts by tenant and e-mail address, as a CRM contact API does. */
export class FakeCrm implements CrmPort {
  readonly faults = new FaultQueue();
  readonly attempts: CrmContact[] = [];
  private readonly contacts = new Map<string, Map<string, string>>();

  upsertContact(contact: CrmContact) {
    this.attempts.push(contact);
    return this.faults.run(() => {
      const tenant =
        this.contacts.get(contact.organizationId) ?? new Map<string, string>();
      this.contacts.set(contact.organizationId, tenant);
      const email = contact.email.trim().toLowerCase();
      const externalId = tenant.get(email) ?? `crm-${tenant.size + 1}`;
      tenant.set(email, externalId);
      return { externalId };
    });
  }

  contactCount(organizationId: string) {
    return this.contacts.get(organizationId)?.size ?? 0;
  }
}

/** Books only slots it listed, and each slot once. */
export class FakeCalendar implements CalendarPort {
  readonly faults = new FaultQueue();
  private readonly bookings = new Map<
    string,
    { key: string; bookingId: string }
  >();

  constructor(
    private readonly slots: Readonly<Record<string, readonly CalendarSlot[]>>,
  ) {}

  listSlots(organizationId: string) {
    return this.faults.run(() =>
      (this.slots[organizationId] ?? []).filter(
        (slot) => !this.bookings.has(this.slotKey(organizationId, slot.id)),
      ),
    );
  }

  book(booking: CalendarBooking) {
    return this.faults.run((): CalendarBookingResult => {
      const { organizationId, slotId } = booking;
      const listed = (this.slots[organizationId] ?? []).some(
        (slot) => slot.id === slotId,
      );
      if (!listed) return { status: "unavailable" };

      const slotKey = this.slotKey(organizationId, slotId);
      const key = tenantKey(booking);
      const current = this.bookings.get(slotKey);
      if (current && current.key !== key) return { status: "unavailable" };

      const bookingId = current?.bookingId ?? `booking:${slotId}`;
      this.bookings.set(slotKey, { key, bookingId });
      return { status: "booked", bookingId };
    });
  }

  private slotKey(organizationId: string, slotId: string) {
    return JSON.stringify([organizationId, slotId]);
  }
}
