import type { Logger } from "./logger";
import { REDACTED, redactFields } from "./redaction";
import type { RequestContext } from "./request-context";

export type AuditOutcome = "success" | "denied" | "failure";

export type AuditMetadata = Readonly<
  Record<string, string | number | boolean | null>
>;

export interface AuditEvent {
  organizationId: string;
  siteId?: string;
  actor:
    { type: "user"; userId: string } | { type: "system" } | { type: "agent" };
  action: string;
  entityType: string;
  entityId?: string;
  outcome: AuditOutcome;
  context: RequestContext;
  metadata?: AuditMetadata;
}

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

export class AuditValidationError extends Error {
  readonly code = "AUDIT_EVENT_INVALID";
}

const actionPattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const entityPattern = /^[a-z][a-z0-9_]{0,39}$/;
const metadataKeyPattern = /^[a-z][a-z0-9_]{0,39}$/;
const metadataValuePattern = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Mirrors the database constraint so a bad event fails before the round trip. */
export function assertAuditEvent(event: AuditEvent) {
  if (!actionPattern.test(event.action) || event.action.length > 80) {
    throw new AuditValidationError("action");
  }
  if (!entityPattern.test(event.entityType)) {
    throw new AuditValidationError("entity_type");
  }
  const metadata = event.metadata ?? {};
  const redacted = redactFields(metadata);
  for (const [key, value] of Object.entries(metadata)) {
    const codeLike =
      typeof value !== "string" ||
      metadataValuePattern.test(value) ||
      uuidPattern.test(value);
    if (
      !metadataKeyPattern.test(key) ||
      !codeLike ||
      redacted[key] === REDACTED
    ) {
      throw new AuditValidationError("metadata");
    }
  }
}

/**
 * For events about a request that is already decided, such as a denial. The
 * decision stands even when the audit store is down; the failure is logged.
 */
export async function recordAudit(
  sink: AuditSink,
  event: AuditEvent,
  logger: Logger,
): Promise<boolean> {
  try {
    assertAuditEvent(event);
    await sink.record(event);
    return true;
  } catch (error) {
    logger.error("audit.write_failed", error, { action: event.action });
    return false;
  }
}
