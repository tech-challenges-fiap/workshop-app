import type { Hono } from "hono";

import {
  mapCreateWorkOrderError,
  mapMissingDependency,
  mapUnexpectedError,
  mapWorkOrderLookupError,
  mapWorkOrderTransitionError,
} from "./error-mapping";
import { createWorkOrderBodySchema, workOrderIdParamSchema } from "./schemas";
import type { WorkOrderRouteDependencies } from "./index";

export function registerAdminWorkOrderRoutes(app: Hono, deps: WorkOrderRouteDependencies): void {
  app.post("/work-orders", async (c) => {
    try {
      const parsed = createWorkOrderBodySchema.parse(await c.req.json());
      const result = await deps.createWorkOrder.execute({
        customer: parsed.customer,
        vehicle: parsed.vehicle,
        parts: parsed.parts,
        services: parsed.services,
      });

      return c.json(result, 201);
    } catch (error) {
      return mapCreateWorkOrderError(c, error);
    }
  });

  app.get("/work-orders/:id", async (c) => {
    try {
      const params = workOrderIdParamSchema.parse({ id: c.req.param("id") });
      const result = await deps.getWorkOrderById.execute({ id: params.id });

      return c.json(result, 200);
    } catch (error) {
      return mapWorkOrderLookupError(c, error);
    }
  });

  app.get("/work-orders", async (c) => {
    try {
      const result = await deps.listWorkOrders.execute();

      return c.json(result, 200);
    } catch (error) {
      return mapUnexpectedError(c, error);
    }
  });

  app.get("/work-orders/metrics/status-duration", async (c) => {
    try {
      if (!deps.getStatusDurationMetrics) {
        return mapMissingDependency(c, "GetWorkOrderStatusDurationMetrics is not configured");
      }

      const result = await deps.getStatusDurationMetrics.execute();

      return c.json({ metrics: result }, 200);
    } catch (error) {
      return mapUnexpectedError(c, error);
    }
  });

  app.post("/work-orders/:id/cancel", async (c) => {
    try {
      const params = workOrderIdParamSchema.parse({ id: c.req.param("id") });
      const result = await deps.cancelWorkOrder.execute({ id: params.id });

      return c.json(result, 200);
    } catch (error) {
      return mapWorkOrderTransitionError(c, error);
    }
  });

  app.post("/work-orders/:id/deliver", async (c) => {
    try {
      const params = workOrderIdParamSchema.parse({ id: c.req.param("id") });
      const result = await deps.deliverVehicle.execute({ id: params.id });

      return c.json(result, 200);
    } catch (error) {
      return mapWorkOrderTransitionError(c, error);
    }
  });

  app.post("/work-orders/:id/diagnosis/start", async (c) => {
    try {
      if (!deps.startDiagnosis) {
        return mapMissingDependency(c, "StartDiagnosis is not configured");
      }

      const params = workOrderIdParamSchema.parse({ id: c.req.param("id") });
      const result = await deps.startDiagnosis.execute({ id: params.id });

      return c.json(result, 200);
    } catch (error) {
      return mapWorkOrderTransitionError(c, error);
    }
  });

  app.post("/work-orders/:id/diagnosis/complete", async (c) => {
    try {
      if (!deps.completeDiagnosis) {
        return mapMissingDependency(c, "CompleteDiagnosis is not configured");
      }

      const params = workOrderIdParamSchema.parse({ id: c.req.param("id") });
      const result = await deps.completeDiagnosis.execute({ id: params.id });

      return c.json(result, 200);
    } catch (error) {
      return mapWorkOrderTransitionError(c, error);
    }
  });
}
