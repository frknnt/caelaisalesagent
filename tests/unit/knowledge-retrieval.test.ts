import { describe, expect, it, vi } from "vitest";

import { DeterministicTestEmbeddingProvider } from "@/lib/knowledge/embeddings";
import {
  answerKnowledgeQuestion,
  hasConflictingEvidence,
  type RetrievalHit,
  type RetrievalRepository,
} from "@/lib/knowledge/retrieval";

const hit = (overrides: Partial<RetrievalHit> = {}): RetrievalHit => ({
  chunkId: "chunk-a",
  sourceId: "source-a",
  title: "Refund policy",
  url: "https://example.test/refunds",
  page: null,
  snippet: "İade süresi 14 gündür.",
  freshUntil: "2026-12-01T00:00:00.000Z",
  lexicalRank: 1,
  semanticRank: 1,
  score: 0.04,
  ...overrides,
});

const repository = (hits: RetrievalHit[]): RetrievalRepository => ({
  search: vi.fn(async () => hits),
});

describe("grounded retrieval answer contract", () => {
  it("returns bilmiyorum/handoff without inventing a source", async () => {
    const result = await answerKnowledgeQuestion(
      repository([]),
      new DeterministicTestEmbeddingProvider(),
      { organizationId: "org", siteId: "site", query: "İade süresi nedir?" },
    );
    expect(result).toMatchObject({
      status: "insufficient",
      citations: [],
      handoff: true,
    });
    expect(result.answer).toContain("uydurmayacağım");
  });

  it("carries source id, title, URL/page, snippet and freshness", async () => {
    const result = await answerKnowledgeQuestion(
      repository([hit({ page: "Page 3" })]),
      new DeterministicTestEmbeddingProvider(),
      { organizationId: "org", siteId: "site", query: "İade süresi nedir?" },
    );
    expect(result).toMatchObject({
      status: "supported",
      handoff: false,
      citations: [
        {
          sourceId: "source-a",
          title: "Refund policy",
          url: "https://example.test/refunds",
          page: "Page 3",
          snippet: "İade süresi 14 gündür.",
          freshUntil: "2026-12-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("does not choose between conflicting approved sources", async () => {
    const hits = [
      hit(),
      hit({
        chunkId: "chunk-b",
        sourceId: "source-b",
        title: "Updated refunds",
        snippet: "İade süresi 30 gündür.",
      }),
    ];
    expect(hasConflictingEvidence(hits)).toBe(true);
    const result = await answerKnowledgeQuestion(
      repository(hits),
      new DeterministicTestEmbeddingProvider(),
      { organizationId: "org", siteId: "site", query: "İade süresi nedir?" },
    );
    expect(result).toMatchObject({
      status: "conflicting",
      handoff: true,
    });
    expect(result.citations).toHaveLength(2);
  });

  it("fails closed when embedding retrieval is unavailable", async () => {
    const unavailable = {
      model: "broken",
      embed: vi.fn(async () => {
        throw new Error("timeout");
      }),
    };
    const result = await answerKnowledgeQuestion(
      repository([hit()]),
      unavailable,
      {
        organizationId: "org",
        siteId: "site",
        query: "İade süresi nedir?",
      },
    );
    expect(result.status).toBe("insufficient");
    expect(result.citations).toEqual([]);
    expect(result.handoff).toBe(true);
  });
});
