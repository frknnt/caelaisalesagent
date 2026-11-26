import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { BudgetLedger } from "./budget";

/**
 * Sums today's real (non-simulated) cost from `llm_call_metrics`, which the
 * guarded call writes for every attempt. Uses the
 * `(organization_id, occurred_at)` index. Errors throw so the turn fails closed.
 */
export const supabaseBudgetLedger: BudgetLedger = {
  async spentMicrosSince(organizationId, since) {
    const { data, error } = await createAdminClient()
      .from("llm_call_metrics")
      .select("cost_micros")
      .eq("organization_id", organizationId)
      .eq("is_simulated", false)
      .gte("occurred_at", since.toISOString())
      .not("cost_micros", "is", null);
    if (error) throw new Error("BUDGET_LEDGER_UNAVAILABLE");
    return (data ?? []).reduce(
      (total, row) => total + Number(row.cost_micros ?? 0),
      0,
    );
  },
};
