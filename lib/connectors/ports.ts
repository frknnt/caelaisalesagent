/**
 * Minimal outbound boundaries. P2.7 adds real connectors behind them. Every
 * write carries an idempotency key and the tenant it belongs to.
 */
export interface TenantWrite {
  organizationId: string;
  idempotencyKey: string;
}

export interface WebhookDelivery extends TenantWrite {
  event: string;
  payload: Readonly<Record<string, unknown>>;
}

export interface WebhookPort {
  deliver(delivery: WebhookDelivery): Promise<{ deliveryId: string }>;
}

export interface CrmContact extends TenantWrite {
  email: string;
}

export interface CrmPort {
  upsertContact(contact: CrmContact): Promise<{ externalId: string }>;
}

export interface CalendarSlot {
  id: string;
  startsAt: string;
}

export interface CalendarBooking extends TenantWrite {
  slotId: string;
}

export type CalendarBookingResult =
  { status: "booked"; bookingId: string } | { status: "unavailable" };

export interface CalendarPort {
  /** The only source of availability. A model never supplies a slot. */
  listSlots(organizationId: string): Promise<readonly CalendarSlot[]>;
  book(booking: CalendarBooking): Promise<CalendarBookingResult>;
}

export class ConnectorError extends Error {
  constructor(public readonly code: "timeout" | "unavailable") {
    super(code);
    this.name = "ConnectorError";
  }
}
