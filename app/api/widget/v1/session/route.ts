import { handleCreateSession, handleReadSession } from "@/lib/widget/handlers";
import { widgetRoute } from "@/lib/widget/route";

export const dynamic = "force-dynamic";

export const GET = widgetRoute("/api/widget/v1/session", handleReadSession);
export const POST = widgetRoute("/api/widget/v1/session", handleCreateSession);
