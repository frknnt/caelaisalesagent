import { errorFields, redactFields } from "./redaction";
import type { RequestContext } from "./request-context";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Readonly<Record<string, unknown>>;
export type LogSink = (line: string, level: LogLevel) => void;

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, error: unknown, fields?: LogFields): void;
}

interface LoggerOptions {
  context?: RequestContext;
  sink?: LogSink;
  now?: () => Date;
  minLevel?: LogLevel;
}

const levels: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const eventPattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;

// One stream for every level: console.error and console.warn are guarded in
// production (console-guard.ts).
const consoleSink: LogSink = (line) => console.log(line);

/** One JSON object per line. Logging never throws into the calling code. */
export function createLogger({
  context,
  sink = consoleSink,
  now = () => new Date(),
  minLevel = "info",
}: LoggerOptions = {}): Logger {
  const write = (level: LogLevel, event: string, fields: LogFields = {}) => {
    if (levels[level] < levels[minLevel]) return;
    try {
      sink(
        JSON.stringify({
          ts: now().toISOString(),
          level,
          event: eventPattern.test(event) ? event : "log.invalid_event_name",
          service: "cael-web",
          ...(context
            ? { requestId: context.requestId, traceId: context.traceId }
            : {}),
          fields: redactFields(fields),
        }),
        level,
      );
    } catch {
      // A broken sink or value must not change the request outcome.
    }
  };
  return {
    debug: (event, fields) => write("debug", event, fields),
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, error, fields) =>
      write("error", event, { ...fields, ...errorFields(error) }),
  };
}
