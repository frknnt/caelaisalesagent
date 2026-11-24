import "server-only";

import {
  withApiObservability,
  type ApiRequest,
} from "@/lib/observability/api-route";

import { readWidgetConfig } from "./config";
import type { WidgetDeps } from "./handlers";
import { supabaseWidgetStore } from "./supabase-store";

/** Binds a widget handler to this process: environment, database and clock. */
export function widgetRoute(
  route: string,
  handler: (request: Request, deps: WidgetDeps) => Promise<Response>,
) {
  return withApiObservability(route, ({ request, logger }: ApiRequest) =>
    handler(request, {
      config: readWidgetConfig(process.env, process.env.NODE_ENV),
      store: supabaseWidgetStore,
      logger,
      now: () => new Date(),
    }),
  );
}
