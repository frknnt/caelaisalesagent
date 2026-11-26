import {
  answerKnowledgeQuestion,
  type RetrievalRepository,
} from "@/lib/knowledge/retrieval";
import type { EmbeddingProvider } from "@/lib/knowledge/types";

import type { AgentTool } from "./tools";

/**
 * Read-only retrieval tool. The tenant and site come from the server-side turn
 * context, never from model arguments, so a model cannot search another site.
 */
export function createKnowledgeSearchTool(
  repository: RetrievalRepository,
  embeddings: EmbeddingProvider,
): AgentTool {
  return {
    name: "search_knowledge",
    description:
      "Sitenin onayli ve guncel bilgi kaynaklarinda arar. Sonuc kanit durumunu ve kaynaklari dondurur.",
    schema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1, maxLength: 500 } },
      required: ["query"],
      additionalProperties: false,
    },
    sideEffect: false,
    async execute(args, context) {
      const result = await answerKnowledgeQuestion(repository, embeddings, {
        organizationId: context.organizationId,
        siteId: context.siteId,
        query: String(args.query),
      });
      return {
        status: result.status,
        answer: result.answer,
        handoff: result.handoff,
        citations: result.citations.map((citation) => ({
          sourceId: citation.sourceId,
          title: citation.title,
          url: citation.url,
          snippet: citation.snippet,
        })),
      };
    },
  };
}
