import "server-only";

import { createMemoryIdempotencyStore } from "@/lib/connectors/idempotency";
import { createKnowledgeSearchTool } from "@/lib/agent/knowledge-tool";
import {
  HANDOFF_TEXT,
  runAgentTurn,
  type AgentTurnResult,
} from "@/lib/agent/loop";
import { SYSTEM_PROMPT_VERSION } from "@/lib/agent/prompt";
import { supabaseBudgetLedger } from "@/lib/agent/supabase-budget";
import { ToolRegistry } from "@/lib/agent/tools";
import { createEmbeddingProvider } from "@/lib/knowledge/embeddings";
import { SupabaseRetrievalRepository } from "@/lib/knowledge/supabase-retrieval";
import type { EmbeddingProvider } from "@/lib/knowledge/types";
import { demoLlmAdapter } from "@/lib/llm/adapters/demo";
import { createLlmPort, readLlmConfig } from "@/lib/llm/config";
import { CircuitBreaker } from "@/lib/llm/resilience";
import type { RequestContext } from "@/lib/observability/request-context";
import { supabaseLlmMetricsSink } from "@/lib/observability/supabase-sinks";
import { createAdminClient } from "@/lib/supabase/admin";

import type { AgentRunner } from "./conversation";

/** Registered adapters. A real provider is added here, nothing else changes. */
const adapters = { demo: demoLlmAdapter };

// Process-local, like the breaker in the ADR: one per server instance.
const breaker = new CircuitBreaker();
// The widget offers no side-effecting tool yet; durable store is P2.7.
const idempotency = createMemoryIdempotencyStore();

/** Embeddings resolved per call, so a missing provider is a safe tool answer. */
const lazyEmbeddings: EmbeddingProvider = {
  model: "configured",
  async embed(inputs) {
    return createEmbeddingProvider().embed(inputs);
  },
};

const refuse = (): AgentTurnResult => ({
  status: "handoff",
  reason: "unavailable",
  text: HANDOFF_TEXT,
  promptVersion: SYSTEM_PROMPT_VERSION,
  steps: 0,
  costMicros: 0,
});

export function createWidgetAgentRunner(context: RequestContext): AgentRunner {
  return async ({
    session,
    turnId,
    siteName,
    agentName,
    history,
    summary,
    logger,
    onTextDelta,
  }) => {
    const config = readLlmConfig(process.env);
    if (!config.ok) {
      logger.error("agent.misconfigured", null, { field: config.field });
      return refuse();
    }
    let port;
    try {
      port = createLlmPort(config.value, adapters);
    } catch {
      logger.error("agent.provider_unavailable", null, {
        provider: config.value.provider,
      });
      return refuse();
    }
    const tools = new ToolRegistry([
      createKnowledgeSearchTool(
        new SupabaseRetrievalRepository(createAdminClient()),
        lazyEmbeddings,
      ),
    ]);
    return runAgentTurn({
      port,
      config: config.value,
      breaker,
      budget: supabaseBudgetLedger,
      tools,
      idempotency,
      metrics: supabaseLlmMetricsSink,
      logger,
      context,
      turn: {
        organizationId: session.organizationId,
        siteId: session.siteId,
        turnId,
        agentName,
        siteName,
      },
      history,
      summary,
      onTextDelta,
    });
  };
}
