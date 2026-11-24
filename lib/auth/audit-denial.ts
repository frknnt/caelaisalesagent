import "server-only";

import type { ApiRequest } from "@/lib/observability/api-route";
import { recordAudit } from "@/lib/observability/audit";
import { supabaseAuditSink } from "@/lib/observability/supabase-sinks";

import type { AuthorizedContext } from "./guard";

/**
 * Recorded in the caller's own tenant. The requested id is untrusted text, so
 * only the place it came from is stored.
 */
export async function auditTenantDenial(
  { context, logger }: ApiRequest,
  { user, activeMembership }: AuthorizedContext,
  source: string,
) {
  await recordAudit(
    supabaseAuditSink,
    {
      organizationId: activeMembership.organization_id,
      actor: { type: "user", userId: user.id },
      action: "tenant.access_denied",
      entityType: "organization",
      outcome: "denied",
      context,
      metadata: { source },
    },
    logger,
  );
}
