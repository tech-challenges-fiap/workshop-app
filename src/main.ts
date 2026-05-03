import { bootstrapServer } from "./bootstrap/bootstrap-server";
import { loadRuntimeConfig } from "./bootstrap/config";
import { createApp } from "./bootstrap/create-app";
import { startTelemetry } from "./infrastructure/observability/telemetry";

startTelemetry();
export const startupConfig = loadRuntimeConfig();
export const app = createApp(startupConfig);

if (process.env.NODE_ENV !== "test") {
  bootstrapServer(app, startupConfig).catch((error) => {
    console.error("[bootstrap] Failed to start application", error);
    process.exit(1);
  });
}
