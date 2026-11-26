import {
  LlmProviderError,
  type LlmCompletion,
  type LlmPort,
  type LlmRequest,
} from "@/lib/llm/port";

export type FakeLlmStep =
  | {
      kind: "answer";
      text: string;
      delayMs?: number;
    }
  | { kind: "refusal" }
  | { kind: "rate_limited"; retryAfterMs: number }
  | { kind: "unavailable" }
  | { kind: "malformed" }
  | {
      kind: "tool_call";
      calls: readonly { id: string; name: string; arguments: unknown }[];
    }
  /** Waits for the abort. With `lateAnswerMs` it ignores it and answers. */
  | { kind: "hang"; lateAnswerMs?: number };

const NEVER_MS = 2 ** 31 - 1;

const countTokens = (text: string) => Math.ceil(text.length / 4);

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/** Plays its steps in order, without a network, a clock or randomness. */
export class FakeLlm implements LlmPort {
  readonly isSimulated = true;
  readonly calls: LlmRequest[] = [];
  private readonly steps: FakeLlmStep[];

  constructor(
    steps: readonly FakeLlmStep[],
    readonly provider = "fake",
    readonly model = "fake-model-1",
  ) {
    this.steps = [...steps];
  }

  estimateInputTokens(request: LlmRequest) {
    return request.messages.reduce(
      (total, message) => total + countTokens(message.content),
      0,
    );
  }

  async complete(
    request: LlmRequest,
    signal: AbortSignal,
  ): Promise<LlmCompletion> {
    this.calls.push(request);
    const step = this.steps.shift();
    if (!step) throw new Error("FAKE_LLM_SCRIPT_EXHAUSTED");

    const completion = (
      finish: LlmCompletion["finish"],
      text: string,
    ): LlmCompletion => ({
      finish,
      text,
      usage: {
        inputTokens: this.estimateInputTokens(request),
        outputTokens: countTokens(text),
        cachedInputTokens: 0,
      },
    });

    switch (step.kind) {
      case "answer":
        if (step.delayMs) await wait(step.delayMs, signal);
        return completion("stop", step.text);
      case "refusal":
        return completion("refusal", "");
      case "malformed":
        return completion("stop", "   ");
      case "tool_call":
        return { ...completion("tool_calls", ""), toolCalls: step.calls };
      case "rate_limited":
        throw new LlmProviderError("rate_limited", step.retryAfterMs);
      case "unavailable":
        throw new LlmProviderError("unavailable");
      case "hang":
        if (step.lateAnswerMs === undefined) await wait(NEVER_MS, signal);
        else await wait(step.lateAnswerMs);
        return completion("stop", "late answer");
    }
  }
}
