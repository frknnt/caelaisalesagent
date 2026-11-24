import type { LlmTokenUsage } from "@/lib/observability/llm-metrics";

/**
 * Provider-neutral boundary. P1.3 adds the real adapter and the agent loop;
 * this file only fixes what callers may rely on.
 */
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  /** Code such as `agent_reply`. Stored in metrics. */
  purpose: string;
  messages: readonly LlmMessage[];
  maxOutputTokens: number;
}

export interface LlmCompletion {
  finish: "stop" | "refusal" | "length";
  text: string;
  usage: LlmTokenUsage;
}

export interface LlmPort {
  readonly provider: string;
  readonly model: string;
  /** True only for fakes. Keeps simulated calls out of real cost reports. */
  readonly isSimulated: boolean;
  /** Upper bound used for the budget check before any call is made. */
  estimateInputTokens(request: LlmRequest): number;
  complete(request: LlmRequest, signal: AbortSignal): Promise<LlmCompletion>;
}

export class LlmProviderError extends Error {
  constructor(
    public readonly code: "rate_limited" | "unavailable",
    public readonly retryAfterMs: number | null = null,
  ) {
    super(code);
    this.name = "LlmProviderError";
  }
}
