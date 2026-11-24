import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { AuditSink } from "./audit";
import type { LlmMetricsSink } from "./llm-metrics";

/** Carries the Postgres error code only. Messages can quote row values. */
class SinkWriteError extends Error {
  constructor(readonly code: string) {
    super("SINK_WRITE_FAILED");
    this.name = "SinkWriteError";
  }
}

/**
 * Both tables accept inserts from the service role only, so these sinks are
 * the single write path from application code. No role may change a row.
 */
export const supabaseAuditSink: AuditSink = {
  async record(event) {
    const { error } = await createAdminClient()
      .from("audit_events")
      .insert({
        organization_id: event.organizationId,
        site_id: event.siteId ?? null,
        actor_type: event.actor.type,
        actor_user_id: event.actor.type === "user" ? event.actor.userId : null,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId ?? null,
        outcome: event.outcome,
        request_id: event.context.requestId,
        trace_id: event.context.traceId,
        metadata: event.metadata ?? {},
      });
    if (error) throw new SinkWriteError(error.code);
  },
};

export const supabaseLlmMetricsSink: LlmMetricsSink = {
  async record(metric) {
    const { error } = await createAdminClient()
      .from("llm_call_metrics")
      .insert({
        id: metric.id,
        organization_id: metric.organizationId,
        site_id: metric.siteId,
        request_id: metric.requestId,
        trace_id: metric.traceId,
        provider: metric.provider,
        model: metric.model,
        purpose: metric.purpose,
        attempt: metric.attempt,
        outcome: metric.outcome,
        input_tokens: metric.usage?.inputTokens ?? null,
        output_tokens: metric.usage?.outputTokens ?? null,
        cached_input_tokens: metric.usage?.cachedInputTokens ?? null,
        latency_ms: metric.latencyMs,
        cost_micros: metric.costMicros,
        pricing_version: metric.pricingVersion,
        is_simulated: metric.isSimulated,
      });
    // The same metric written twice is one call, not two.
    if (error && error.code !== "23505") throw new SinkWriteError(error.code);
  },
};
