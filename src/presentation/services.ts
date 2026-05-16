import type { Hono } from "hono";
import { z } from "zod";

import type { CreateService } from "../application/service/create-service";
import type { GetServiceById } from "../application/service/get-service-by-id";
import type { ListServices } from "../application/service/list-services";
import type { GetServiceAverageDuration } from "../application/service/get-service-average-duration";
import type { UpdateService } from "../application/service/update-service";
import type { DeleteService } from "../application/service/delete-service";
import { ServiceNotFound } from "../domain/service/domain-error/service-not-found";
import { StockItemNotFound } from "../domain/stock-item/domain-error/stock-item-not-found";
import { InvalidServicePrice } from "../domain/service/domain-error/invalid-service-price";
import { PresentationError } from "./presentation-error";

const serviceRequiredItemSchema = z.object({
  stockItemId: z.coerce.number().int().positive(),
  quantity: z.number().int().positive(),
});

const createOrUpdateServiceBodySchema = z.object({
  name: z.string().min(1),
  estimatedTime: z.number().int().positive(),
  price: z
    .number()
    .nonnegative()
    .refine((value) => Number.isFinite(value), {
      message: "price must be a finite number",
    })
    .refine((value) => Number.isInteger(value * 100), {
      message: "price must have at most two decimal places",
    }),
  requiredItems: z.array(serviceRequiredItemSchema).optional().default([]),
});

const serviceIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const HTTP_STATUS_NOT_FOUND = 404;
const SERVICES_ROUTE = "/services";
const SERVICE_ID_ROUTE = "/services/:id";
const SERVICE_AVERAGE_DURATION_ROUTE = "/services/:id/average-duration";

export function registerServiceRoutes(
  app: Hono,
  deps: {
    createService: CreateService;
    getServiceById: GetServiceById;
    getServiceAverageDuration: GetServiceAverageDuration;
    listServices: ListServices;
    updateService: UpdateService;
    deleteService: DeleteService;
  },
): void {
  app.post(SERVICES_ROUTE, async (c) => {
    try {
      const parsed = createOrUpdateServiceBodySchema.parse(await c.req.json());

      const result = await deps.createService.execute({
        name: parsed.name,
        estimatedTime: parsed.estimatedTime,
        price: parsed.price,
        requiredItems: parsed.requiredItems,
      });

      return c.json(result, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validation(c, error);
      }

      if (error instanceof StockItemNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          HTTP_STATUS_NOT_FOUND,
        );
      }

      if (error instanceof InvalidServicePrice) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          400,
        );
      }

      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });

  app.get(SERVICE_ID_ROUTE, async (c) => {
    try {
      const params = serviceIdParamSchema.parse({ id: c.req.param("id") });

      const result = await deps.getServiceById.execute({ id: params.id });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validation(c, error);
      }

      if (error instanceof ServiceNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          HTTP_STATUS_NOT_FOUND,
        );
      }

      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });

  app.get(SERVICE_AVERAGE_DURATION_ROUTE, async (c) => {
    try {
      const params = serviceIdParamSchema.parse({ id: c.req.param("id") });

      const result = await deps.getServiceAverageDuration.execute({ id: params.id });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validation(c, error);
      }

      if (error instanceof ServiceNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          HTTP_STATUS_NOT_FOUND,
        );
      }

      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });

  app.get(SERVICES_ROUTE, async (c) => {
    try {
      const result = await deps.listServices.execute();

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });

  app.put(SERVICE_ID_ROUTE, async (c) => {
    try {
      const params = serviceIdParamSchema.parse({ id: c.req.param("id") });
      const parsed = createOrUpdateServiceBodySchema.parse(await c.req.json());

      const result = await deps.updateService.execute({
        id: params.id,
        name: parsed.name,
        estimatedTime: parsed.estimatedTime,
        price: parsed.price,
        requiredItems: parsed.requiredItems,
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validation(c, error);
      }

      if (error instanceof ServiceNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          HTTP_STATUS_NOT_FOUND,
        );
      }

      if (error instanceof InvalidServicePrice) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          400,
        );
      }

      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });

  app.delete(SERVICE_ID_ROUTE, async (c) => {
    try {
      const params = serviceIdParamSchema.parse({ id: c.req.param("id") });

      await deps.deleteService.execute({ id: params.id });

      return c.body(null, 204);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validation(c, error);
      }

      if (error instanceof ServiceNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          HTTP_STATUS_NOT_FOUND,
        );
      }

      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });
}
