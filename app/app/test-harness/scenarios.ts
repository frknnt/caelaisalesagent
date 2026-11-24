/** Fixed scripts for the fake model. The visitor's text never selects one. */
export const harnessScenarios = [
  { id: "answer", label: "Answer" },
  { id: "timeout", label: "Model timeout" },
  { id: "refusal", label: "Model refusal" },
  { id: "rate_limited", label: "Rate limit" },
  { id: "unavailable", label: "Model outage" },
  { id: "budget", label: "Budget limit" },
  { id: "duplicate", label: "Duplicate webhook" },
  { id: "crash", label: "Server error" },
] as const;

export type HarnessScenario = (typeof harnessScenarios)[number]["id"];
