import type { Hono } from "hono";
import { z } from "zod";

import type { HandleExternalWorkOrderEvent } from "../../application/work-order/handle-external-work-order-event";
import { WorkOrderWebhookEventInvalid } from "../../domain/work-order/domain-error/work-order-webhook-event-invalid";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import { WorkOrderServiceTaskNotFound } from "../../domain/work-order/domain-error/work-order-service-task-not-found";
import { WorkOrderStatusTransitionNotAllowed } from "../../domain/work-order/domain-error/work-order-status-transition-not-allowed";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";
import { ServiceTaskStatusTransitionNotAllowed } from "../../domain/service-task/domain-error/service-task-status-transition-not-allowed";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";
import { InsufficientStock } from "../../domain/stock-item/domain-error/insufficient-stock";

const webhookEventBaseSchema = z.object({
  eventId: z.string().min(1),
  occurredAt: z.string().datetime().optional(),
});

const workOrderStatusUpdateTargetStatusSchema = z.union([
  z.literal(WorkOrderStatus.DIAGNOSIS),
  z.literal(WorkOrderStatus.WAITING_APPROVAL),
  z.literal(WorkOrderStatus.IN_EXECUTION),
  z.literal(WorkOrderStatus.FINALIZED),
  z.literal(WorkOrderStatus.CANCELED),
  z.literal(WorkOrderStatus.DELIVERED),
]);

const workOrderStatusUpdateSchema = webhookEventBaseSchema.extend({
  eventType: z.literal("WORK_ORDER_STATUS_UPDATED"),
  workOrderId: z.coerce.number().int().positive(),
  targetStatus: workOrderStatusUpdateTargetStatusSchema,
  serviceTaskId: z.coerce.number().int().positive().optional(),
});

const webhookEventSchema = z.discriminatedUnion("eventType", [
  webhookEventBaseSchema.extend({
    eventType: z.literal("SERVICE_TASK_APPROVED"),
    workOrderId: z.coerce.number().int().positive(),
    serviceTaskId: z.coerce.number().int().positive(),
  }),
  webhookEventBaseSchema.extend({
    eventType: z.literal("SERVICE_TASK_REJECTED"),
    workOrderId: z.coerce.number().int().positive(),
    serviceTaskId: z.coerce.number().int().positive(),
  }),
  workOrderStatusUpdateSchema,
]);

export function registerWebhookWorkOrderEventRoutes(
  app: Hono,
  deps: {
    handleExternalWorkOrderEvent: HandleExternalWorkOrderEvent;
  },
): void {
  app.post("/webhooks/work-orders/events", async (c) => {
    try {
      const parsed = webhookEventSchema.parse(await c.req.json());

      const result = await deps.handleExternalWorkOrderEvent.execute({
        ...parsed,
        occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "ValidationError",
            message: error.message,
            details: error.issues,
          },
          400,
        );
      }

      if (error instanceof WorkOrderWebhookEventInvalid) {
        return c.json(
          {
            error: "ValidationError",
            message: error.message,
            details: [],
          },
          400,
        );
      }

      if (
        error instanceof WorkOrderNotFound ||
        error instanceof WorkOrderServiceTaskNotFound ||
        error instanceof ServiceTaskNotFound ||
        error instanceof StockItemNotFound
      ) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          404,
        );
      }

      if (
        error instanceof WorkOrderStatusTransitionNotAllowed ||
        error instanceof ServiceTaskStatusTransitionNotAllowed ||
        error instanceof InsufficientStock
      ) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          409,
        );
      }

      if (error instanceof Error) {
        console.error(error);
        return c.json(
          {
            error: "UnexpectedError",
            message: error.message,
          },
          500,
        );
      }

      return c.json({ error: "UnknownError" }, 500);
    }
  });
}
