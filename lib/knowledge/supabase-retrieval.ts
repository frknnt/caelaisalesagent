import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";

import type { RetrievalHit, RetrievalRepository } from "./retrieval";

export class SupabaseRetrievalRepository implements RetrievalRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async search(input: Parameters<RetrievalRepository["search"]>[0]) {
    const { data, error } = await this.client.rpc(
      "retrieve_approved_knowledge",
      {
        p_organization_id: input.organizationId,
        p_site_id: input.siteId,
        p_query_text: input.query,
        p_query_embedding: `[${input.embedding.join(",")}]`,
        p_match_count: input.limit,
        p_rrf_k: 50,
      },
    );
    if (error) throw new Error("RETRIEVAL_FAILED");
    return (data ?? []).map((row): RetrievalHit => ({
      chunkId: row.chunk_id,
      sourceId: row.source_id,
      title: row.source_title,
      url: row.source_url,
      page: row.page_reference,
      snippet: row.snippet,
      freshUntil: row.fresh_until,
      lexicalRank: row.lexical_rank,
      semanticRank: row.semantic_rank,
      score: row.fused_score,
    }));
  }
}
