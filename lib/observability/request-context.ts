export const REQUEST_ID_HEADER = "x-request-id";
export const TRACEPARENT_HEADER = "traceparent";

export interface RequestContext {
  requestId: string;
  traceId: string;
  spanId: string;
}

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const traceparentPattern =
  /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

type HeaderReader = Pick<Headers, "get">;

function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Trace and parent span of a W3C traceparent header, or null if malformed. */
export function parseTraceparent(value: string | null) {
  const match = traceparentPattern.exec(value?.trim() ?? "");
  const [, version, traceId, spanId] = match ?? [];
  if (!version || !traceId || !spanId || version === "ff") return null;
  if (/^0+$/.test(traceId) || /^0+$/.test(spanId)) return null;
  return { traceId, spanId };
}

export function formatTraceparent(context: RequestContext) {
  return `00-${context.traceId}-${context.spanId}-01`;
}

/**
 * New context at the edge of the app. The request id is always ours; a
 * well-formed incoming trace is continued with a new span.
 */
export function createRequestContext(headers: HeaderReader): RequestContext {
  const parent = parseTraceparent(headers.get(TRACEPARENT_HEADER));
  return {
    requestId: crypto.randomUUID(),
    traceId: parent?.traceId ?? randomHex(16),
    spanId: randomHex(8),
  };
}

/** Context set by the proxy, or a new one where the proxy did not run. */
export function readRequestContext(headers: HeaderReader): RequestContext {
  const requestId = headers.get(REQUEST_ID_HEADER);
  const trace = parseTraceparent(headers.get(TRACEPARENT_HEADER));
  if (!requestId || !requestIdPattern.test(requestId) || !trace) {
    return createRequestContext(headers);
  }
  return { requestId, ...trace };
}

/** Replaces whatever the client sent, so later readers can trust the values. */
export function applyRequestContext(headers: Headers): RequestContext {
  const context = createRequestContext(headers);
  headers.set(REQUEST_ID_HEADER, context.requestId);
  headers.set(TRACEPARENT_HEADER, formatTraceparent(context));
  return context;
}
