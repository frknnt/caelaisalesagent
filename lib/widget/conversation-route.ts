import "server-only";

import {
  withApiObservability,
  type ApiRequest,
} from "@/lib/observability/api-route";

import { createWidgetAgentRunner } from "./agent-runtime";
import { readWidgetConfig } from "./config";
import type { ConversationDeps } from "./conversation";
import { supabaseConversationStore } from "./supabase-conversation-store";
import { supabaseWidgetStore } from "./supabase-store";

/** Binds a conversation handler to this process: environment, database, agent. */
export function conversationRoute(
  route: string,
  handler: (request: Request, deps: ConversationDeps) => Promise<Response>,
) {
  return withApiObservability(
    route,
    ({ request, logger, context }: ApiRequest) =>
      handler(request, {
        config: readWidgetConfig(process.env, process.env.NODE_ENV),
        store: supabaseWidgetStore,
        conversations: supabaseConversationStore,
        runAgent: createWidgetAgentRunner(context),
        logger,
        now: () => new Date(),
      }),
  );
}
