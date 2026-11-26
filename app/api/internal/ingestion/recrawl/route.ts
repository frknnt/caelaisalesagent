import { timingSafeEqual } from "node:crypto";

import { enqueueDueKnowledgeRecrawls } from "@/lib/knowledge/recrawl";
import { withApiObservability } from "@/lib/observability/api-route";

export const dynamic = "force-dynamic";

const validWorkerToken = (authorization: string | null) => {
  const expected = Buffer.from(process.env.INGESTION_WORKER_TOKEN ?? "");
  const provided = Buffer.from(authorization?.replace(/^Bearer\s+/i, "") ?? "");
  return (
    expected.length >= 32 &&
    expected.length === provided.length &&
    timingSafeEqual(expected, provided)
  );
};

export const POST = withApiObservability(
  "/api/internal/ingestion/recrawl",
  async ({ request }) => {
    if (!validWorkerToken(request.headers.get("authorization")))
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    return Response.json(await enqueueDueKnowledgeRecrawls());
  },
);
