import type { Hono } from "hono";

import type { ApplicationDeps } from "./build-use-cases";
import { registerStockItemRoutes } from "../presentation/stock-items";
import { registerServiceRoutes } from "../presentation/services";
import { registerServiceTaskRoutes } from "../presentation/service-tasks";
import { registerVehicleRoutes } from "../presentation/vehicles";
import { adminAuthMiddleware, mechanicAuthMiddleware } from "../presentation/middleware/auth";
import { registerOpenApiRoutes } from "../presentation/openapi";
import { registerPersonRoutes } from "../presentation/person";
import { registerWorkOrderRoutes } from "../presentation/work-orders";
import { registerWebhookWorkOrderEventRoutes } from "../presentation/webhooks/work-order-events";
import { ensureDatabaseConnection } from "../infrastructure/db";
import { requestLoggingMiddleware } from "../infrastructure/observability/logger";
import { tracingMiddleware } from "../infrastructure/observability/tracing-middleware";

export function registerRoutes(app: Hono, appDeps: ApplicationDeps): void {
  app.use("*", tracingMiddleware);
  app.use("*", requestLoggingMiddleware);

  registerOpenApiRoutes(app);

  app.get("/health", (c) => {
    return c.json({ status: "ok" });
  });

  app.get("/ready", async (c) => {
    try {
      await ensureDatabaseConnection();
      return c.json({ status: "ready" }, 200);
    } catch {
      return c.json({ status: "not-ready" }, 503);
    }
  });

  app.use("/stock-items/*", adminAuthMiddleware);
  app.use("/services/*", adminAuthMiddleware);
  app.use("/service-tasks/*", mechanicAuthMiddleware);
  app.use("/vehicles/*", adminAuthMiddleware);
  app.use("/person/*", adminAuthMiddleware);
  app.use("/work-orders/*", adminAuthMiddleware);

  registerStockItemRoutes(app, appDeps.stockItems);
  registerServiceRoutes(app, appDeps.services);
  registerServiceTaskRoutes(app, appDeps.serviceTasks);
  registerVehicleRoutes(app, appDeps.vehicles);
  registerPersonRoutes(app, appDeps.person);
  registerWorkOrderRoutes(app, appDeps.workOrders);
  registerWebhookWorkOrderEventRoutes(app, appDeps.webhooks);
}
