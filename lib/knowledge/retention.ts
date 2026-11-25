import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function purgeExpiredKnowledgeFiles(limit = 100) {
  const client = createAdminClient();
  const { data, error } = await client.rpc("claim_expired_knowledge_files", {
    p_limit: limit,
  });
  if (error) throw new Error("KNOWLEDGE_RETENTION_CLAIM_FAILED");
  let deleted = 0;
  for (const document of data ?? []) {
    if (!document.storage_bucket || !document.storage_path) continue;
    const removed = await client.storage
      .from(document.storage_bucket)
      .remove([document.storage_path]);
    if (removed.error) continue;
    const marked = await client.rpc("mark_knowledge_file_deleted", {
      p_document_id: document.document_id,
    });
    if (!marked.error) deleted += 1;
  }
  return { claimed: data?.length ?? 0, deleted };
}
