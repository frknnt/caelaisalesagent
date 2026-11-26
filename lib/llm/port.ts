import type { LlmTokenUsage } from "@/lib/observability/llm-metrics";

/**
 * Provider-neutral boundary. Business logic (the agent loop, tools, budget)
 * depends only on these types; a provider adapter translates them.
 */
export interface LlmToolCall {
  id: string;
  name: string;
  /** Parsed JSON arguments. Untrusted until the tool registry validates them. */
  arguments: unknown;
}

export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string;
      toolCalls?: readonly LlmToolCall[];
    }
  | { role: "tool"; toolCallId: string; name: string; content: string };

/** JSON Schema subset that every adapter can express. */
export interface LlmToolSpec {
  name: string;
  description: string;
  parameters: Readonly<Record<string, unknown>>;
}

export interface LlmRequest {
  /** Code such as `agent_reply`. Stored in metrics. */
  purpose: string;
  messages: readonly LlmMessage[];
  maxOutputTokens: number;
  tools?: readonly LlmToolSpec[];
  /**
   * Streaming: called with each piece of answer text as it arrives. For
   * display only; the returned completion is the authoritative text, and the
   * guarded call stops forwarding pieces once the attempt has settled.
   */
  onTextDelta?: ((delta: string) => void) | undefined;
}

export interface LlmCompletion {
  finish: "stop" | "refusal" | "length" | "tool_calls";
  text: string;
  toolCalls?: readonly LlmToolCall[];
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
