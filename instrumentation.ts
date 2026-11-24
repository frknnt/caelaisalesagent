import type { Instrumentation } from "next";

import { installConsoleGuard } from "@/lib/observability/console-guard";
import { createLogger } from "@/lib/observability/logger";
import { readRequestContext } from "@/lib/observability/request-context";

export function register() {
  // Development keeps full messages in the local terminal.
  if (process.env.NODE_ENV === "production") installConsoleGuard();
}

/** Every uncaught server error: render, route handler, action and proxy. */
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const headers = {
    get: (name: string) => {
      const value = request.headers[name];
      return (Array.isArray(value) ? value[0] : value) ?? null;
    },
  };
  createLogger({ context: readRequestContext(headers) }).error(
    "request.error",
    error,
    {
      method: request.method,
      route: context.routePath,
      routeType: context.routeType,
    },
  );
};
