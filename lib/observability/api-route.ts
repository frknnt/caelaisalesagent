import { NextResponse, type NextRequest } from "next/server";

import { AuthorizationError } from "@/lib/auth/authorization";

import { createLogger, type Logger } from "./logger";
import { readRequestContext, type RequestContext } from "./request-context";

export interface ApiRequest {
  request: NextRequest;
  context: RequestContext;
  logger: Logger;
}

type ApiHandler<Args extends unknown[]> = (
  api: ApiRequest,
  ...args: Args
) => Promise<Response>;

/**
 * Logs one line per request and gives every failure the same safe body. The
 * proxy adds the request id to the response headers.
 */
export function withApiObservability<Args extends unknown[]>(
  route: string,
  handler: ApiHandler<Args>,
  createApiLogger = (context: RequestContext) => createLogger({ context }),
) {
  return async (request: NextRequest, ...args: Args): Promise<Response> => {
    const context = readRequestContext(request.headers);
    const logger = createApiLogger(context);
    const startedAt = performance.now();
    const finish = (response: Response) => {
      logger.info("api.request", {
        route,
        method: request.method,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return response;
    };

    try {
      return finish(await handler({ request, context, logger }, ...args));
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return finish(
          NextResponse.json(
            { error: { code: error.code, requestId: context.requestId } },
            { status: error.status },
          ),
        );
      }
      logger.error("api.request_failed", error, {
        route,
        method: request.method,
      });
      return finish(
        NextResponse.json(
          { error: { code: "INTERNAL_ERROR", requestId: context.requestId } },
          { status: 500 },
        ),
      );
    }
  };
}
