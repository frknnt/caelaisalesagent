import { handleFrame } from "@/lib/widget/handlers";
import { widgetRoute } from "@/lib/widget/route";

export const dynamic = "force-dynamic";

export const GET = widgetRoute("/widget/v1/frame", handleFrame);
