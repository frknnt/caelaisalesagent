import type { EmbeddingProvider } from "./types";

export type RetrievalHit = {
  chunkId: string;
  sourceId: string;
  title: string;
  url: string | null;
  page: string | null;
  snippet: string;
  freshUntil: string;
  lexicalRank: number | null;
  semanticRank: number | null;
  score: number;
};

export type Citation = Pick<
  RetrievalHit,
  "sourceId" | "title" | "url" | "page" | "snippet" | "freshUntil"
>;

export type GroundedAnswer = {
  status: "supported" | "insufficient" | "conflicting";
  answer: string;
  citations: Citation[];
  handoff: boolean;
};

export interface RetrievalRepository {
  search(input: {
    organizationId: string;
    siteId: string;
    query: string;
    embedding: number[];
    limit: number;
  }): Promise<RetrievalHit[]>;
}

const safeFallback = (answer: string): GroundedAnswer => ({
  status: "insufficient",
  answer,
  citations: [],
  handoff: true,
});

const atomicValues = (value: string) =>
  new Set(
    value
      .match(
        /\b\d+(?:[.,]\d+)?\s*(?:%|gün|gun|saat|ay|yıl|yil|TL|TRY|USD|EUR|₺|\$|€)?\b/giu,
      )
      ?.map((item) => item.replace(/\s+/g, " ").toLocaleLowerCase("tr")) ?? [],
  );

export function hasConflictingEvidence(hits: RetrievalHit[]) {
  const bySource = new Map<string, Set<string>>();
  for (const hit of hits) {
    const values = atomicValues(hit.snippet);
    if (values.size) bySource.set(hit.sourceId, values);
  }
  const entries = [...bySource.entries()];
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const leftValues = entries[left]?.[1] ?? new Set<string>();
      const rightValues = entries[right]?.[1] ?? new Set<string>();
      if (
        [...leftValues].some((value) => !rightValues.has(value)) &&
        [...rightValues].some((value) => !leftValues.has(value))
      )
        return true;
    }
  }
  return false;
}

export async function answerKnowledgeQuestion(
  repository: RetrievalRepository,
  embeddingProvider: EmbeddingProvider,
  input: {
    organizationId: string;
    siteId: string;
    query: string;
    limit?: number;
  },
): Promise<GroundedAnswer> {
  const query = input.query.trim();
  if (!query)
    return safeFallback(
      "Soruyu yanıtlamak için doğrulanabilir bir konu belirtmeniz gerekiyor.",
    );

  let hits: RetrievalHit[];
  try {
    const [embedding] = await embeddingProvider.embed([query]);
    if (!embedding) throw new Error("EMBEDDING_MISSING");
    hits = await repository.search({
      ...input,
      query,
      embedding,
      limit: Math.min(Math.max(input.limit ?? 8, 1), 20),
    });
  } catch {
    return safeFallback(
      "Şu anda doğrulanmış kaynaklara erişemiyorum. Bilgi uydurmayacağım; isterseniz sizi bir temsilciye yönlendirebilirim.",
    );
  }

  if (!hits.length)
    return safeFallback(
      "Bu konuda onaylı ve güncel bir kaynağım yok. Bilgi uydurmayacağım; isterseniz sizi bir temsilciye yönlendirebilirim.",
    );

  const citations = hits.map(
    ({ sourceId, title, url, page, snippet, freshUntil }) => ({
      sourceId,
      title,
      url,
      page,
      snippet,
      freshUntil,
    }),
  );
  if (hasConflictingEvidence(hits)) {
    return {
      status: "conflicting",
      answer:
        "Onaylı kaynaklar birbiriyle çelişiyor. Güvenilir olmayan bir seçim yapmayacağım; insan doğrulaması gerekiyor.",
      citations,
      handoff: true,
    };
  }

  return {
    status: "supported",
    answer: hits[0]!.snippet,
    citations,
    handoff: false,
  };
}
