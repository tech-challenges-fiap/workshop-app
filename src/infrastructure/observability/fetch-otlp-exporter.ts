import type { ExportResult } from "@opentelemetry/core";
import { ExportResultCode } from "@opentelemetry/core";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

/**
 * A Bun-compatible OTLP/HTTP span exporter using native fetch().
 * The standard @opentelemetry/exporter-trace-otlp-http uses Node.js http module
 * which doesn't work reliably under Bun. This exporter sends OTLP JSON via fetch().
 */
export class FetchOTLPTraceExporter implements SpanExporter {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;
  private _shutdown = false;

  constructor(opts?: { url?: string; headers?: Record<string, string> }) {
    const base = opts?.url ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
    this.endpoint = `${base}/v1/traces`;
    this.headers = { "Content-Type": "application/json", ...(opts?.headers ?? {}) };
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (this._shutdown) {
      resultCallback({ code: ExportResultCode.FAILED });
      return;
    }

    const payload = this.toOtlpJson(spans);

    fetch(this.endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res.ok) {
          resultCallback({ code: ExportResultCode.SUCCESS });
        } else {
          console.error(`[FetchOTLPTraceExporter] export failed: HTTP ${res.status}`);
          resultCallback({ code: ExportResultCode.FAILED });
        }
      })
      .catch((err: unknown) => {
        console.error(`[FetchOTLPTraceExporter] export error:`, err);
        resultCallback({ code: ExportResultCode.FAILED });
      });
  }

  async shutdown(): Promise<void> {
    this._shutdown = true;
  }

  async forceFlush(): Promise<void> {}

  private toOtlpJson(spans: ReadableSpan[]) {
    // Group spans by resource + instrumentation scope
    const resourceSpans = new Map<string, { resource: object; scopeSpans: Map<string, object[]> }>();

    for (const span of spans) {
      const resAttrs = span.resource.attributes;
      const resKey = JSON.stringify(resAttrs);

      if (!resourceSpans.has(resKey)) {
        resourceSpans.set(resKey, {
          resource: { attributes: this.toOtlpAttributes(resAttrs) },
          scopeSpans: new Map(),
        });
      }

      const entry = resourceSpans.get(resKey)!;
      const scopeName = span.instrumentationScope.name;
      if (!entry.scopeSpans.has(scopeName)) {
        entry.scopeSpans.set(scopeName, []);
      }
      entry.scopeSpans.get(scopeName)!.push(this.spanToOtlp(span));
    }

    return {
      resourceSpans: [...resourceSpans.values()].map((rs) => ({
        resource: rs.resource,
        scopeSpans: [...rs.scopeSpans.entries()].map(([name, spans]) => ({
          scope: { name },
          spans,
        })),
      })),
    };
  }

  private spanToOtlp(span: ReadableSpan) {
    return {
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      parentSpanId: span.parentSpanContext?.spanId || undefined,
      name: span.name,
      kind: span.kind + 1, // OTLP kind is 1-indexed
      startTimeUnixNano: this.hrTimeToNano(span.startTime),
      endTimeUnixNano: this.hrTimeToNano(span.endTime),
      attributes: this.toOtlpAttributes(span.attributes),
      status: {
        code: span.status.code,
        message: span.status.message,
      },
      events: span.events.map((e) => ({
        timeUnixNano: this.hrTimeToNano(e.time),
        name: e.name,
        attributes: this.toOtlpAttributes(e.attributes ?? {}),
      })),
    };
  }

  private toOtlpAttributes(attrs: Record<string, unknown> | object) {
    return Object.entries(attrs).map(([key, value]) => ({
      key,
      value: this.toOtlpValue(value),
    }));
  }

  private toOtlpValue(value: unknown): object {
    if (typeof value === "string") return { stringValue: value };
    if (typeof value === "number") {
      return Number.isInteger(value) ? { intValue: value } : { doubleValue: value };
    }
    if (typeof value === "boolean") return { boolValue: value };
    if (Array.isArray(value)) {
      return { arrayValue: { values: value.map((v) => this.toOtlpValue(v)) } };
    }
    return { stringValue: String(value) };
  }

  private hrTimeToNano(hrTime: [number, number]): string {
    return String(hrTime[0] * 1_000_000_000 + hrTime[1]);
  }
}
