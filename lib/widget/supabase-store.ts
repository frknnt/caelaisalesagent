import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { Refusal, WidgetStore } from "./store";

/** Carries the Postgres error code only. Messages can quote row values. */
class WidgetStoreError extends Error {
  constructor(readonly code: string) {
    super("WIDGET_STORE_FAILED");
    this.name = "WidgetStoreError";
  }
}

interface OutcomeRow {
  outcome: string;
  retry_after: number;
}

function readRow<Row extends OutcomeRow>(result: {
  data: Row[] | null;
  error: { code: string } | null;
}): Row {
  if (result.error) throw new WidgetStoreError(result.error.code);
  const row = result.data?.[0];
  if (!row) throw new WidgetStoreError("NO_ROW");
  return row;
}

/** Anything that is not a known answer is a refusal. */
function refusal(row: OutcomeRow): Refusal {
  return row.outcome === "rate_limited"
    ? { outcome: "rate_limited", retryAfter: Math.max(1, row.retry_after) }
    : { outcome: "denied" };
}

/**
 * The generated types mark function parameters and columns as non-null; null is
 * a real value for the client hash and the handoff address.
 */
const nullable = (value: string | null) => value as string;

export const supabaseWidgetStore: WidgetStore = {
  async bootstrap({ publicKey, hostname, clientHash }) {
    const row = readRow(
      await createAdminClient().rpc("widget_bootstrap", {
        p_public_key: publicKey,
        p_hostname: hostname,
        p_client_hash: nullable(clientHash),
      }),
    );
    if (row.outcome !== "allowed") return refusal(row);
    return {
      outcome: "allowed",
      site: {
        organizationId: row.organization_id,
        siteId: row.site_id,
        siteKeyId: row.site_key_id,
        environment: row.environment === "preview" ? "preview" : "production",
        siteName: row.site_name,
        widgetTitle: row.widget_title,
        locale: row.locale,
        accentColor: row.accent_color,
        position:
          row.widget_position === "bottom-left"
            ? "bottom-left"
            : "bottom-right",
        handoffUrl: row.handoff_url ?? null,
      },
    };
  },

  async frame({ siteKeyId, hostname, clientHash }) {
    const row = readRow(
      await createAdminClient().rpc("widget_frame", {
        p_site_key_id: siteKeyId,
        p_hostname: hostname,
        p_client_hash: nullable(clientHash),
      }),
    );
    if (row.outcome !== "allowed") return refusal(row);
    return {
      outcome: "allowed",
      site: {
        siteId: row.site_id,
        siteName: row.site_name,
        widgetTitle: row.widget_title,
        locale: row.locale,
        accentColor: row.accent_color,
        handoffUrl: row.handoff_url ?? null,
      },
    };
  },

  async createSession(input) {
    const row = readRow(
      await createAdminClient().rpc("create_widget_session", {
        p_site_key_id: input.siteKeyId,
        p_hostname: input.hostname,
        p_origin: input.origin,
        p_bootstrap_id: input.bootstrapId,
        p_client_hash: nullable(input.clientHash),
        p_ttl_seconds: input.ttlSeconds,
      }),
    );
    if (row.outcome === "replayed") return { outcome: "replayed" };
    if (row.outcome !== "allowed") return refusal(row);
    return {
      outcome: "allowed",
      sessionId: row.session_id,
      expiresAt: new Date(row.expires_at),
    };
  },

  async checkSession(input) {
    const row = readRow(
      await createAdminClient().rpc("check_widget_session", {
        p_session_id: input.sessionId,
        p_site_key_id: input.siteKeyId,
        p_origin: input.origin,
        p_hostname: input.hostname,
      }),
    );
    if (row.outcome !== "allowed") return refusal(row);
    return {
      outcome: "allowed",
      organizationId: row.organization_id,
      siteId: row.site_id,
      expiresAt: new Date(row.expires_at),
    };
  },
};
