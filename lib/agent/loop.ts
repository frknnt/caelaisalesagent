import { createHash } from "node:crypto";

import {
  executeOnce,
  type IdempotencyStore,
} from "@/lib/connectors/idempotency";
import type { LlmConfig } from "@/lib/llm/config";
import type { LlmFailure } from "@/lib/llm/guarded-call";
import type { LlmMessage, LlmPort, LlmToolCall } from "@/lib/llm/port";
import { callLlmResilient, type CircuitBreaker } from "@/lib/llm/resilience";
import type { LlmMetricsSink } from "@/lib/observability/llm-metrics";
import type { Logger } from "@/lib/observability/logger";
import type { RequestContext } from "@/lib/observability/request-context";

import { startOfUtcDay, type BudgetLedger } from "./budget";
import {
  buildConversationWindow,
  buildSystemPrompt,
  SYSTEM_PROMPT_VERSION,
  type ConversationTurn,
} from "./prompt";
import type { ToolContext, ToolRegistry } from "./tools";

export type AgentHandoffReason =
  | LlmFailure
  | "emergency_stop"
  | "budget_unavailable"
  | "circuit_open"
  | "invalid_tool_call"
  | "tool_loop_limit"
  | "tool_failed";

export type AgentTurnResult =
  | {
      status: "answered";
      text: string;
      promptVersion: string;
      steps: number;
      costMicros: number;
      /** Side-effecting tools that ran after the answer was accepted. */
      effects: { tool: string; status: "executed" | "duplicate" }[];
      /** Outputs of read-only tools, e.g. the citations behind the answer. */
      toolOutputs: { tool: string; output: unknown }[];
    }
  | {
      status: "handoff";
      reason: AgentHandoffReason;
      /** Fixed, safe text. Never model output. */
      text: string;
      promptVersion: string;
      steps: number;
      costMicros: number;
    };

export const HANDOFF_TEXT =
  "Su anda size guvenilir bir yanit veremiyorum. Isterseniz sizi bir temsilciye aktarabilirim.";

export interface AgentTurnInput {
  port: LlmPort;
  config: LlmConfig;
  breaker: CircuitBreaker;
  budget: BudgetLedger;
  tools: ToolRegistry;
  idempotency: IdempotencyStore;
  metrics: LlmMetricsSink;
  logger: Logger;
  context: RequestContext;
  turn: ToolContext & { agentName: string; siteName: string };
  history: readonly ConversationTurn[];
  summary: string | null;
  limits?: {
    maxSteps?: number;
    maxInvalidToolCalls?: number;
    maxOutputTokens?: number;
    windowTurns?: number;
    windowChars?: number;
  };
  /** Streaming answer text (display only; the result text is authoritative). */
  onTextDelta?: ((delta: string) => void) | undefined;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

function argsKey(call: LlmToolCall) {
  return createHash("sha256")
    .update(JSON.stringify(call.arguments ?? null))
    .digest("hex")
    .slice(0, 32);
}

/**
 * One visitor turn. Order of gates: emergency stop, then the daily budget,
 * both before any provider call. Each LLM step runs through the guarded,
 * retried call; tool calls are validated server-side and side effects are
 * deferred until the turn ends with an accepted answer.
 */
export async function runAgentTurn(
  input: AgentTurnInput,
): Promise<AgentTurnResult> {
  const maxSteps = input.limits?.maxSteps ?? 4;
  const maxInvalid = input.limits?.maxInvalidToolCalls ?? 1;
  const now = input.now ?? (() => new Date());
  let steps = 0;
  let costMicros = 0;

  const handoff = (reason: AgentHandoffReason): AgentTurnResult => {
    input.logger.warn("agent.handoff", {
      reason,
      steps,
      provider: input.port.provider,
      model: input.port.model,
    });
    return {
      status: "handoff",
      reason,
      text: HANDOFF_TEXT,
      promptVersion: SYSTEM_PROMPT_VERSION,
      steps,
      costMicros,
    };
  };

  if (input.config.emergencyStop) return handoff("emergency_stop");

  let spentToday: number;
  try {
    spentToday = await input.budget.spentMicrosSince(
      input.turn.organizationId,
      startOfUtcDay(now()),
    );
  } catch {
    return handoff("budget_unavailable");
  }

  const toolNames = input.tools.names();
  const window = buildConversationWindow({
    history: input.history,
    summary: input.summary,
    maxTurns: input.limits?.windowTurns ?? 12,
    maxChars: input.limits?.windowChars ?? 12_000,
  });
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt({
        agentName: input.turn.agentName,
        siteName: input.turn.siteName,
        toolNames,
      }),
    },
    ...window.messages,
  ];
  const deferred: {
    name: string;
    args: Record<string, unknown>;
    key: string;
  }[] = [];
  let invalidCalls = 0;
  const toolOutputs: { tool: string; output: unknown }[] = [];

  while (steps < maxSteps) {
    steps += 1;
    const remaining = input.config.dailyBudgetMicros - spentToday - costMicros;
    const result = await callLlmResilient(
      {
        port: input.port,
        request: {
          purpose: "agent_reply",
          // Snapshot: later steps must not change what a call was sent.
          messages: [...messages],
          maxOutputTokens: input.limits?.maxOutputTokens ?? 800,
          tools: input.tools.specs(),
          onTextDelta: input.onTextDelta,
        },
        tenant: {
          organizationId: input.turn.organizationId,
          siteId: input.turn.siteId,
        },
        context: input.context,
        limits: {
          timeoutMs: input.config.timeoutMs,
          // A spent budget gives a negative ceiling: the guarded call then
          // records `budget_exceeded` without reaching the provider.
          maxCostMicros: Math.min(input.config.perCallMaxCostMicros, remaining),
        },
        pricing: input.config.pricing,
        metrics: input.metrics,
        logger: input.logger,
      },
      {
        maxAttempts: input.config.maxAttempts,
        breaker: input.breaker,
        sleep: input.sleep,
      },
    );
    if ("metric" in result) costMicros += result.metric.costMicros ?? 0;
    if (result.status === "handoff") return handoff(result.reason);

    const completion = result.completion;
    if (completion.finish !== "tool_calls") {
      const effects: { tool: string; status: "executed" | "duplicate" }[] = [];
      for (const item of deferred) {
        const tool = input.tools.get(item.name);
        if (!tool) continue;
        try {
          const outcome = await executeOnce(input.idempotency, {
            organizationId: input.turn.organizationId,
            operation: `tool.${item.name}`,
            key: item.key,
            input: item.args,
            run: () => tool.execute(item.args, input.turn),
          });
          if (outcome.status === "executed" || outcome.status === "duplicate")
            effects.push({ tool: item.name, status: outcome.status });
          else return handoff("tool_failed");
        } catch {
          return handoff("tool_failed");
        }
      }
      return {
        status: "answered",
        text: completion.text,
        promptVersion: SYSTEM_PROMPT_VERSION,
        steps,
        costMicros,
        effects,
        toolOutputs,
      };
    }

    const calls = completion.toolCalls ?? [];
    messages.push({
      role: "assistant",
      content: completion.text,
      toolCalls: calls,
    });
    for (const call of calls) {
      const validation = input.tools.validate(call.name, call.arguments);
      if (!validation.ok) {
        invalidCalls += 1;
        input.logger.warn("agent.tool_rejected", {
          error: validation.error,
          detail: validation.detail,
        });
        if (invalidCalls > maxInvalid) return handoff("invalid_tool_call");
        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify({ error: validation.error }),
        });
        continue;
      }
      const tool = input.tools.get(call.name);
      if (!tool) return handoff("invalid_tool_call");
      if (tool.sideEffect) {
        deferred.push({
          name: call.name,
          args: validation.args,
          key: `${input.turn.turnId}:${argsKey(call)}`,
        });
        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify({ status: "queued_until_turn_completes" }),
        });
        continue;
      }
      let output: unknown;
      try {
        output = await tool.execute(validation.args, input.turn);
      } catch {
        return handoff("tool_failed");
      }
      toolOutputs.push({ tool: call.name, output });
      messages.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(output),
      });
    }
  }
  return handoff("tool_loop_limit");
}
