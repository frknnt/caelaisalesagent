import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function enqueueDueKnowledgeRecrawls(limit = 25) {
  const { data, error } = await createAdminClient().rpc(
    "enqueue_due_knowledge_recrawls",
    { p_limit: limit },
  );
  if (error) throw new Error("RECRAWL_ENQUEUE_FAILED");
  return { queued: data ?? 0 };
}
