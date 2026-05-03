import { Hono } from "hono";

import { buildInfrastructureDeps } from "./build-infrastructure";
import { buildApplicationDeps } from "./build-use-cases";
import type { AppRuntimeConfig } from "./config";
import { loadRuntimeConfig } from "./config";
import { registerRoutes } from "./register-routes";

export function createApp(runtimeConfig: AppRuntimeConfig = loadRuntimeConfig()): Hono {
  const app = new Hono();
  const infrastructureDeps = buildInfrastructureDeps(runtimeConfig);
  const applicationDeps = buildApplicationDeps(infrastructureDeps, runtimeConfig);

  registerRoutes(app, applicationDeps);

  return app;
}
