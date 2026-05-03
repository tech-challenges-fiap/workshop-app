import { serve } from "@hono/node-server";
import type { Hono } from "hono";

import type { AppRuntimeConfig } from "./config";
import { ensureDatabaseConnection } from "../infrastructure/db";

export async function bootstrapServer(app: Hono, config: AppRuntimeConfig): Promise<void> {
  const { appPort, jwtSecret } = config;

  if (!jwtSecret || jwtSecret.length === 0) {
    console.error(
      JSON.stringify({
        service: "workshop-app",
        level: "error",
        message: "Missing JWT_SECRET environment variable. Set it before starting the application.",
      }),
    );
    process.exit(1);
  }

  await ensureDatabaseConnection();

  console.log(
    JSON.stringify({
      service: "workshop-app",
      level: "info",
      message: "Starting HTTP server",
      port: appPort,
    }),
  );

  serve({
    fetch: app.fetch,
    port: appPort,
  });
}
