import { metrics, trace } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const serviceName = process.env.OTEL_SERVICE_NAME ?? process.env.DD_SERVICE ?? "workshop-app";
const serviceVersion = process.env.DD_VERSION ?? process.env.npm_package_version ?? "0.1.0";

let tracerProvider: BasicTracerProvider | null = null;
let meterProvider: MeterProvider | null = null;

export const businessMeter = metrics.getMeter("workshop-app-business");
export const authFailureCounter = businessMeter.createCounter("workshop_app_auth_failures_total");
export const workOrderCreatedCounter = businessMeter.createCounter(
  "workshop_app_work_orders_created_total",
);
export const workOrderStatusChangeCounter = businessMeter.createCounter(
  "workshop_app_work_order_status_changes_total",
);
export const workOrderDurationHistogram = businessMeter.createHistogram(
  "workshop_app_work_order_duration_seconds",
  { description: "Time spent in each work order status", unit: "s" },
);
export const integrationErrorCounter = businessMeter.createCounter(
  "workshop_app_integration_errors_total",
);

export function startTelemetry(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!endpoint || tracerProvider) {
    return;
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    "deployment.environment": process.env.APP_ENV ?? process.env.DD_ENV ?? "local",
  });

  tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  });
  trace.setGlobalTracerProvider(tracerProvider);

  meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: 30_000,
      }),
    ],
  });
  metrics.setGlobalMeterProvider(meterProvider);
}

export async function shutdownTelemetry(): Promise<void> {
  if (!tracerProvider) {
    return;
  }

  await tracerProvider.shutdown();
  tracerProvider = null;

  if (meterProvider) {
    await meterProvider.shutdown();
    meterProvider = null;
  }
}

export function getTracer() {
  return trace.getTracer(serviceName, serviceVersion);
}
