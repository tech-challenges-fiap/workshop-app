import type { Hono } from "hono";
import { z } from "zod";

import type { CreateStockItem } from "../application/stock-item/create-stock-item";
import type { IncreaseStockItemQuantity } from "../application/stock-item/increase-stock-item-quantity";
import type { ConsumeStockItemQuantity } from "../application/stock-item/consume-stock-item-quantity";
import type { GetStockItemById } from "../application/stock-item/get-stock-item-by-id";
import type { ListStockItems } from "../application/stock-item/list-stock-items";
import type { UpdateStockItem } from "../application/stock-item/update-stock-item";
import type { DeleteStockItem } from "../application/stock-item/delete-stock-item";
import { SkuAlreadyExists } from "../domain/stock-item/domain-error/sku-already-exists";
import { StockItemNotFound } from "../domain/stock-item/domain-error/stock-item-not-found";
import { InsufficientStock } from "../domain/stock-item/domain-error/insufficient-stock";
import { InvalidStockItemPrice } from "../domain/stock-item/domain-error/invalid-stock-item-price";
import { PresentationError } from "./presentation-error";

const createStockItemBodySchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  quantity: z.number().int().nonnegative(),
  unitOfMeasure: z.string().nullable().optional(),
  price: z
    .number()
    .nonnegative()
    .refine(Number.isFinite, { message: "price must be a finite number" })
    .refine((value) => Number.isInteger(value * 100), {
      message: "price must have at most two decimal places",
    }),
});

const increaseStockItemQuantityBodySchema = z.object({
  quantity: z.number().int().positive(),
});

const consumeStockItemQuantityBodySchema = z.object({
  quantity: z.number().int().positive(),
});

const updateStockItemBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  unitOfMeasure: z.string().nullable().optional(),
  price: z
    .number()
    .nonnegative()
    .refine(Number.isFinite, { message: "price must be a finite number" })
    .refine((value) => Number.isInteger(value * 100), {
      message: "price must have at most two decimal places",
    })
    .optional(),
});

const stockItemIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const HTTP_STATUS_NOT_FOUND = 404;
const STOCK_ITEMS_ROUTE = "/stock-items";
const STOCK_ITEM_ID_ROUTE = "/stock-items/:id";
const STOCK_ITEM_ID_INCREASE_ROUTE = "/stock-items/:id/increase";
const STOCK_ITEM_ID_CONSUME_ROUTE = "/stock-items/:id/consume";

export function registerStockItemRoutes(
  app: Hono,
  deps: {
    createStockItem: CreateStockItem;
    increaseStockItemQuantity: IncreaseStockItemQuantity;
    consumeStockItemQuantity: ConsumeStockItemQuantity;
    getStockItemById: GetStockItemById;
    listStockItems: ListStockItems;
    updateStockItem: UpdateStockItem;
    deleteStockItem: DeleteStockItem;
  },
): void {
  app.get(STOCK_ITEMS_ROUTE, async (c) => {
    try {
      const result = await deps.listStockItems.execute();

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });

  app.get(STOCK_ITEM_ID_ROUTE, async (c) => {
    try {
      const params = stockItemIdParamSchema.parse({ id: c.req.param("id") });

      const result = await deps.getStockItemById.execute({ id: params.id });

      return c.json(result, 200);
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

      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });

  app.post(STOCK_ITEMS_ROUTE, async (c) => {
    try {
      const parsed = createStockItemBodySchema.parse(await c.req.json());

      const result = await deps.createStockItem.execute({
        sku: parsed.sku,
        name: parsed.name,
        description: parsed.description ?? null,
        quantity: parsed.quantity,
        unitOfMeasure: parsed.unitOfMeasure ?? null,
        price: parsed.price,
      });

      return c.json(result, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validation(c, error);
      }

      if (error instanceof SkuAlreadyExists) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          409,
        );
      }

      if (error instanceof InvalidStockItemPrice) {
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

  app.put(STOCK_ITEM_ID_ROUTE, async (c) => {
    try {
      const params = stockItemIdParamSchema.parse({ id: c.req.param("id") });
      const parsed = updateStockItemBodySchema.parse(await c.req.json());

      const result = await deps.updateStockItem.execute({
        id: params.id,
        name: parsed.name,
        description: parsed.description ?? undefined,
        unitOfMeasure: parsed.unitOfMeasure ?? undefined,
        price: parsed.price,
      });

      return c.json(result, 200);
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

      if (error instanceof InvalidStockItemPrice) {
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

  app.post(STOCK_ITEM_ID_INCREASE_ROUTE, async (c) => {
    try {
      const params = stockItemIdParamSchema.parse({ id: c.req.param("id") });
      const parsed = increaseStockItemQuantityBodySchema.parse(await c.req.json());

      const result = await deps.increaseStockItemQuantity.execute({
        id: params.id,
        quantity: parsed.quantity,
      });

      return c.json(result, 200);
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

      if (error instanceof Error) {
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

  app.post(STOCK_ITEM_ID_CONSUME_ROUTE, async (c) => {
    try {
      const params = stockItemIdParamSchema.parse({ id: c.req.param("id") });
      const parsed = consumeStockItemQuantityBodySchema.parse(await c.req.json());

      const result = await deps.consumeStockItemQuantity.execute({
        id: params.id,
        quantity: parsed.quantity,
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

      if (error instanceof StockItemNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          HTTP_STATUS_NOT_FOUND,
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

      if (error instanceof Error) {
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

  app.delete(STOCK_ITEM_ID_ROUTE, async (c) => {
    try {
      const params = stockItemIdParamSchema.parse({ id: c.req.param("id") });

      await deps.deleteStockItem.execute({ id: params.id });

      return c.body(null, 204);
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

      if (error instanceof StockItemNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          404,
        );
      }

      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });
}
