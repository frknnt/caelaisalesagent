/**
 * Daily LLM spend per organization. Read before every turn; a read failure
 * blocks the call (fail closed). Simulated calls never count as spend.
 */
export interface BudgetLedger {
  spentMicrosSince(organizationId: string, since: Date): Promise<number>;
}

export function startOfUtcDay(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function createMemoryBudgetLedger(initial: Record<string, number> = {}) {
  const spent = new Map(Object.entries(initial));
  return {
    ledger: {
      async spentMicrosSince(organizationId: string) {
        return spent.get(organizationId) ?? 0;
      },
    } satisfies BudgetLedger,
    add(organizationId: string, micros: number) {
      spent.set(organizationId, (spent.get(organizationId) ?? 0) + micros);
    },
  };
}
