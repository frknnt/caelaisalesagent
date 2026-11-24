import type { AuditEvent, AuditSink } from "@/lib/observability/audit";
import type {
  LlmCallMetric,
  LlmMetricsSink,
} from "@/lib/observability/llm-metrics";
import { createLogger, type LogLevel } from "@/lib/observability/logger";

import { fixtureContext, fixtureTime } from "./fixtures";

export function createMemoryMetricsSink() {
  const records: LlmCallMetric[] = [];
  const sink: LlmMetricsSink = {
    async record(metric) {
      records.push(metric);
    },
  };
  return { sink, records };
}

export function createMemoryAuditSink() {
  const records: AuditEvent[] = [];
  const sink: AuditSink = {
    async record(event) {
      records.push(event);
    },
  };
  return { sink, records };
}

export interface LogRecord {
  ts: string;
  level: LogLevel;
  event: string;
  service: string;
  requestId?: string;
  traceId?: string;
  fields: Record<string, unknown>;
}

export function createMemoryLogger() {
  const lines: string[] = [];
  const logger = createLogger({
    context: fixtureContext,
    now: () => new Date(fixtureTime),
    sink: (line) => lines.push(line),
  });
  return {
    logger,
    lines,
    records: () => lines.map((line) => JSON.parse(line) as LogRecord),
  };
}
