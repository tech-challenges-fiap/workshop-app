import { randomUUID } from "node:crypto";

import { trace } from "@opentelemetry/api";
import type { MiddlewareHandler } from "hono";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, string | number | boolean | null | undefined>;

function baseFields(level: LogLevel, message: string): Record<string, unknown> {
  const activeSpan = trace.getActiveSpan();
  const spanContext = activeSpan?.spanContext();

  const traceId = spanContext?.traceId;
  const spanId = spanContext?.spanId;

  return {
    timestamp: new Date().toISOString(),
    service: process.env.OTEL_SERVICE_NAME ?? process.env.DD_SERVICE ?? "workshop-app",
    env: process.env.APP_ENV ?? process.env.DD_ENV ?? process.env.NODE_ENV ?? "local",
    level,
    message,
    trace_id: traceId,
    span_id: spanId,
    "dd.trace_id": traceId ? BigInt(`0x${traceId.slice(16)}`).toString() : undefined,
    "dd.span_id": spanId ? BigInt(`0x${spanId}`).toString() : undefined,
  };
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  const payload = {
    ...baseFields(level, message),
    ...fields,
  };

  const serialized = JSON.stringify(payload);

  if (level === "error" || level === "warn") {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};

export const requestLoggingMiddleware: MiddlewareHandler = async (c, next) => {
  const startedAt = performance.now();
  const requestId =
    c.req.header("x-request-id") ?? c.req.header("x-correlation-id") ?? randomUUID();

  c.header("x-request-id", requestId);
  c.set("requestId", requestId);

  await next();

  logger.info("HTTP request completed", {
    request_id: requestId,
    route: c.req.routePath || new URL(c.req.url).pathname,
    method: c.req.method,
    status_code: c.res.status,
    duration_ms: Number((performance.now() - startedAt).toFixed(2)),
  });
};
