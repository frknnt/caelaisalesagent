import type { LlmConfig } from "@/lib/llm/config";
import type { LlmCompletion, LlmPort, LlmRequest } from "@/lib/llm/port";

/**
 * Demo adapter (`LLM_PROVIDER=demo`). Not a language model: it asks the
 * knowledge tool for the visitor's question and streams back exactly what the
 * tool returned, so every answer is the approved source text or the tool's own
 * safe "I don't know" text. It costs nothing and is marked simulated, so it
 * never counts as spend. A real provider adapter replaces it without touching
 * the agent loop (ADR-20261126-llm-provider-ve-agent-dongusu).
 */

const KNOWLEDGE_TOOL = "search_knowledge";
const VISITOR_WRAPPER = /^<visitor_message>\n([\s\S]*)\n<\/visitor_message>$/;
const countTokens = (text: string) => Math.ceil(text.length / 4);

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted)
      return reject(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

function toolAnswer(content: string): string | null {
  try {
    const value: unknown = JSON.parse(content);
    const answer = (value as { answer?: unknown } | null)?.answer;
    return typeof answer === "string" && answer.trim() ? answer : null;
  } catch {
    return null;
  }
}

export class DemoLlm implements LlmPort {
  readonly provider = "demo";
  readonly isSimulated = true;

  constructor(
    readonly model: string,
    private readonly chunkDelayMs = 12,
  ) {}

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
    const usage = (text: string) => ({
      inputTokens: this.estimateInputTokens(request),
      outputTokens: countTokens(text),
      cachedInputTokens: 0,
    });
    const last = request.messages.at(-1);

    if (last?.role === "tool") {
      const firstAnswer = !request.messages.some(
        (message) => message.role === "assistant" && !message.toolCalls?.length,
      );
      const found =
        toolAnswer(last.content) ??
        "Bu konuda onaylı bir kaynağım yok. Bilgi uydurmayacağım; isterseniz sizi bir temsilciye yönlendirebilirim.";
      const text = firstAnswer
        ? `Ben bir yapay zekâ asistanıyım. ${found}`
        : found;
      for (const piece of text.match(/\S+\s*/g) ?? [text]) {
        await wait(this.chunkDelayMs, signal);
        request.onTextDelta?.(piece);
      }
      return { finish: "stop", text, usage: usage(text) };
    }

    const offered = request.tools?.some((tool) => tool.name === KNOWLEDGE_TOOL);
    const question =
      last?.role === "user"
        ? (VISITOR_WRAPPER.exec(last.content)?.[1] ?? "").trim()
        : "";
    if (!offered || !question) {
      const text =
        "Ben bir yapay zekâ asistanıyım. Bu soruyu şu anda yanıtlayamıyorum; isterseniz sizi bir temsilciye yönlendirebilirim.";
      return { finish: "stop", text, usage: usage(text) };
    }
    return {
      finish: "tool_calls",
      text: "",
      toolCalls: [
        {
          id: "demo-search-1",
          name: KNOWLEDGE_TOOL,
          arguments: { query: question.slice(0, 500) },
        },
      ],
      usage: usage(""),
    };
  }
}

export const demoLlmAdapter = (config: LlmConfig) => new DemoLlm(config.model);
