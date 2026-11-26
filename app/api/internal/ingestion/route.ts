import { timingSafeEqual } from "node:crypto";

import { IngestionWorker, WebhookMalwareScanner } from "@/lib/knowledge/worker";
import { SupabaseWorkerRepository } from "@/lib/knowledge/supabase-repository";
import { createEmbeddingProvider } from "@/lib/knowledge/embeddings";
import { withApiObservability } from "@/lib/observability/api-route";

export const dynamic = "force-dynamic";

const matches = (provided: string, expected: string) => {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return (
    right.length >= 32 &&
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
};

export const POST = withApiObservability(
  "/api/internal/ingestion",
  async ({ request }) => {
    const token = process.env.INGESTION_WORKER_TOKEN ?? "";
    const provided =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token || !provided || !matches(provided, token))
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });

    const worker = new IngestionWorker(
      new SupabaseWorkerRepository(),
      new WebhookMalwareScanner(
        process.env.INGESTION_MALWARE_SCANNER_URL,
        process.env.INGESTION_MALWARE_SCANNER_TOKEN,
      ),
      undefined,
      createEmbeddingProvider(),
    );
    return Response.json({ processed: await worker.processNext() });
  },
);
