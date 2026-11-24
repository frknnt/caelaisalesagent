import { handleBootstrap } from "@/lib/widget/handlers";
import { widgetRoute } from "@/lib/widget/route";

export const dynamic = "force-dynamic";

export const POST = widgetRoute("/api/widget/v1/bootstrap", handleBootstrap);
