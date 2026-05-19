import { metrics } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const serviceName = process.env.OTEL_SERVICE_NAME ?? process.env.DD_SERVICE ?? "workshop-app";
const serviceVersion = process.env.DD_VERSION ?? process.env.npm_package_version ?? "0.1.0";

let sdk: NodeSDK | null = null;

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

  if (!endpoint || sdk) {
    return;
  }

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      "deployment.environment": process.env.APP_ENV ?? process.env.DD_ENV ?? "local",
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 30_000,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;
}
