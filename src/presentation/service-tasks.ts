import type { Hono } from "hono";
import { z } from "zod";

import type { AddServiceTask } from "../application/service-task/add-service-task";
import type { ApproveServiceTask } from "../application/service-task/approve-service-task";
import type { ApproveServiceTaskByPublicToken } from "../application/service-task/approve-service-task-by-public-token";
import type { RejectServiceTask } from "../application/service-task/reject-service-task";
import type { RejectServiceTaskByPublicToken } from "../application/service-task/reject-service-task-by-public-token";
import type { StartServiceExecution } from "../application/service-task/start-service-execution";
import type { CompleteServiceTask } from "../application/service-task/complete-service-task";
import type { GetServiceTaskById } from "../application/service-task/get-service-task-by-id";
import type { ListServiceTasks } from "../application/service-task/list-service-tasks";
import { ServiceNotFound } from "../domain/service/domain-error/service-not-found";
import { ServiceTaskNotFound } from "../domain/service-task/domain-error/service-task-not-found";
import { ServiceTaskStatusTransitionNotAllowed } from "../domain/service-task/domain-error/service-task-status-transition-not-allowed";
import { WorkOrderStatusTransitionNotAllowed } from "../domain/work-order/domain-error/work-order-status-transition-not-allowed";
import { StockItemNotFound } from "../domain/stock-item/domain-error/stock-item-not-found";
import { InsufficientStock } from "../domain/stock-item/domain-error/insufficient-stock";
import { WorkOrderPublicTokenNotFound } from "../domain/work-order/domain-error/work-order-public-token-not-found";
import { WorkOrderPublicTokenExpired } from "../domain/work-order/domain-error/work-order-public-token-expired";
import { WorkOrderServiceTaskNotFound } from "../domain/work-order/domain-error/work-order-service-task-not-found";
import { WorkOrderServiceTaskCreationNotAllowed } from "../domain/work-order/domain-error/work-order-service-task-creation-not-allowed";
import { WorkOrderNotFound } from "../domain/work-order/domain-error/work-order-not-found";

const serviceTaskIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const publicTokenParamSchema = z.object({
  token: z.string().min(1),
});

const createServiceTaskBodySchema = z.object({
  serviceId: z.number().int().positive(),
  workOrderId: z.number().int().positive(),
});

const startExecutionBodySchema = z.object({
  startedAt: z.string().datetime().optional(),
});

const completeServiceTaskBodySchema = z.object({
  completedAt: z.string().datetime().optional(),
});

export function registerServiceTaskRoutes(
  app: Hono,
  deps: {
    addServiceTask: AddServiceTask;
    approveServiceTask: ApproveServiceTask;
    approveServiceTaskByPublicToken?: ApproveServiceTaskByPublicToken;
    rejectServiceTask: RejectServiceTask;
    rejectServiceTaskByPublicToken?: RejectServiceTaskByPublicToken;
    startServiceExecution: StartServiceExecution;
    completeServiceTask: CompleteServiceTask;
    getServiceTaskById: GetServiceTaskById;
    listServiceTasks: ListServiceTasks;
  },
): void {
  app.get("/service-tasks", async (c) => {
    try {
      const result = await deps.listServiceTasks.execute();

      return c.json(result, 200);
    } catch (error) {
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

  app.get("/service-tasks/:id", async (c) => {
    try {
      const params = serviceTaskIdParamSchema.parse({ id: c.req.param("id") });
      const result = await deps.getServiceTaskById.execute({ id: params.id });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "ValidationError",
            details: error.issues,
          },
          400,
        );
      }

      if (error instanceof ServiceTaskNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          404,
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

  app.post("/service-tasks", async (c) => {
    try {
      const parsed = createServiceTaskBodySchema.parse(await c.req.json());

      const result = await deps.addServiceTask.execute({
        serviceId: parsed.serviceId,
        workOrderId: parsed.workOrderId,
      });

      return c.json(result, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "ValidationError",
            details: error.issues,
          },
          400,
        );
      }

      if (error instanceof ServiceNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          404,
        );
      }

      if (error instanceof WorkOrderServiceTaskCreationNotAllowed) {
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

  app.post("/public/work-orders/:token/service-tasks/:id/approve", async (c) => {
    try {
      if (!deps.approveServiceTaskByPublicToken) {
        return c.json(
          {
            error: "UnexpectedError",
            // eslint-disable-next-line no-secrets/no-secrets
            message: "ApproveServiceTaskByPublicToken is not configured",
          },
          500,
        );
      }

      const params = serviceTaskIdParamSchema.parse({ id: c.req.param("id") });
      const tokenParams = publicTokenParamSchema.parse({ token: c.req.param("token") });

      const result = await deps.approveServiceTaskByPublicToken.execute({
        publicToken: tokenParams.token,
        serviceTaskId: params.id,
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "ValidationError",
            details: error.issues,
          },
          400,
        );
      }

      if (
        error instanceof WorkOrderPublicTokenNotFound ||
        error instanceof WorkOrderServiceTaskNotFound ||
        error instanceof ServiceTaskNotFound
      ) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          404,
        );
      }

      if (error instanceof WorkOrderPublicTokenExpired) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          401,
        );
      }

      if (
        error instanceof ServiceTaskStatusTransitionNotAllowed ||
        error instanceof WorkOrderStatusTransitionNotAllowed
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

  app.post("/public/work-orders/:token/service-tasks/:id/reject", async (c) => {
    try {
      if (!deps.rejectServiceTaskByPublicToken) {
        return c.json(
          {
            error: "UnexpectedError",
            // eslint-disable-next-line no-secrets/no-secrets
            message: "RejectServiceTaskByPublicToken is not configured",
          },
          500,
        );
      }

      const params = serviceTaskIdParamSchema.parse({ id: c.req.param("id") });
      const tokenParams = publicTokenParamSchema.parse({ token: c.req.param("token") });

      const result = await deps.rejectServiceTaskByPublicToken.execute({
        publicToken: tokenParams.token,
        serviceTaskId: params.id,
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "ValidationError",
            details: error.issues,
          },
          400,
        );
      }

      if (
        error instanceof WorkOrderPublicTokenNotFound ||
        error instanceof WorkOrderServiceTaskNotFound ||
        error instanceof ServiceTaskNotFound
      ) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          404,
        );
      }

      if (error instanceof WorkOrderPublicTokenExpired) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          401,
        );
      }

      if (
        error instanceof ServiceTaskStatusTransitionNotAllowed ||
        error instanceof WorkOrderStatusTransitionNotAllowed
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

  app.post("/service-tasks/:id/approve", async (c) => {
    try {
      const params = serviceTaskIdParamSchema.parse({ id: c.req.param("id") });

      const result = await deps.approveServiceTask.execute({ id: params.id });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "ValidationError",
            details: error.issues,
          },
          400,
        );
      }

      if (error instanceof ServiceTaskNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          404,
        );
      }

      if (
        error instanceof ServiceTaskStatusTransitionNotAllowed ||
        error instanceof WorkOrderStatusTransitionNotAllowed
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

  app.post("/service-tasks/:id/reject", async (c) => {
    try {
      const params = serviceTaskIdParamSchema.parse({ id: c.req.param("id") });

      const result = await deps.rejectServiceTask.execute({ id: params.id });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "ValidationError",
            details: error.issues,
          },
          400,
        );
      }

      if (error instanceof ServiceTaskNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          404,
        );
      }

      if (
        error instanceof ServiceTaskStatusTransitionNotAllowed ||
        error instanceof WorkOrderStatusTransitionNotAllowed
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

  app.post("/service-tasks/:id/start-execution", async (c) => {
    try {
      const params = serviceTaskIdParamSchema.parse({ id: c.req.param("id") });
      const parsed = startExecutionBodySchema.parse(await c.req.json());
      const startedAt = parsed.startedAt ? new Date(parsed.startedAt) : undefined;

      const result = await deps.startServiceExecution.execute({
        id: params.id,
        startedAt,
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "ValidationError",
            details: error.issues,
          },
          400,
        );
      }

      if (
        error instanceof ServiceTaskNotFound ||
        error instanceof StockItemNotFound ||
        error instanceof WorkOrderNotFound ||
        error instanceof WorkOrderServiceTaskNotFound
      ) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          404,
        );
      }

      if (error instanceof InsufficientStock) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          409,
        );
      }

      if (
        error instanceof ServiceTaskStatusTransitionNotAllowed ||
        error instanceof WorkOrderStatusTransitionNotAllowed
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

  app.post("/service-tasks/:id/complete", async (c) => {
    try {
      const params = serviceTaskIdParamSchema.parse({ id: c.req.param("id") });
      const parsed = completeServiceTaskBodySchema.parse(await c.req.json());
      const completedAt = parsed.completedAt ? new Date(parsed.completedAt) : undefined;

      const result = await deps.completeServiceTask.execute({
        id: params.id,
        completedAt,
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "ValidationError",
            details: error.issues,
          },
          400,
        );
      }

      if (error instanceof ServiceTaskNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          404,
        );
      }

      if (error instanceof WorkOrderNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          404,
        );
      }

      if (error instanceof ServiceTaskStatusTransitionNotAllowed) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          409,
        );
      }

      if (error instanceof WorkOrderStatusTransitionNotAllowed) {
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
