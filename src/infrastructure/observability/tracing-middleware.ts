import { SpanKind, SpanStatusCode, context, propagation } from "@opentelemetry/api";
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_URL_PATH,
} from "@opentelemetry/semantic-conventions";
import type { MiddlewareHandler } from "hono";

import { getTracer } from "./telemetry";

export const tracingMiddleware: MiddlewareHandler = async (c, next) => {
  const tracer = getTracer();
  const method = c.req.method;
  const path = c.req.path;

  const parentContext = propagation.extract(context.active(), c.req.raw.headers, {
    get(carrier, key) {
      return (carrier as unknown as Headers).get(key) ?? undefined;
    },
    keys(carrier) {
      return [...(carrier as unknown as Headers).keys()];
    },
  });

  const span = tracer.startSpan(
    `${method} ${path}`,
    {
      kind: SpanKind.SERVER,
      attributes: {
        [ATTR_HTTP_REQUEST_METHOD]: method,
        [ATTR_URL_PATH]: path,
      },
    },
    parentContext,
  );

  const ctx = context.active().setValue(Symbol.for("OpenTelemetry Context Key SPAN"), span);

  try {
    await context.with(ctx, () => next());
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
    throw err;
  } finally {
    const status = c.res.status;
    span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status);

    const matched = c.req.routePath;
    if (matched) {
      span.setAttribute(ATTR_HTTP_ROUTE, matched);
      span.updateName(`${method} ${matched}`);
    }

    if (status >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  }
};
