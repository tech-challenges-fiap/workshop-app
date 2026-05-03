import { beforeAll, describe, expect, it, vi } from "bun:test";
import { Hono } from "hono";

import { registerStockItemRoutes } from "./stock-items";
import { CreateStockItem } from "../application/stock-item/create-stock-item";
import type { StockItemRepository } from "../domain/stock-item/repository/stock-item-repository";
import { SkuAlreadyExists } from "../domain/stock-item/domain-error/sku-already-exists";
import { StockItem } from "../domain/stock-item/aggregate/stock-item";
import { IncreaseStockItemQuantity } from "../application/stock-item/increase-stock-item-quantity";
import { ConsumeStockItemQuantity } from "../application/stock-item/consume-stock-item-quantity";
import { GetStockItemById } from "../application/stock-item/get-stock-item-by-id";
import { ListStockItems } from "../application/stock-item/list-stock-items";
import { UpdateStockItem } from "../application/stock-item/update-stock-item";
import { DeleteStockItem } from "../application/stock-item/delete-stock-item";
import { StockItemSku } from "../domain/stock-item/value-object/stock-item-sku";
import { StockItemName } from "../domain/stock-item/value-object/stock-item-name";
import { StockItemQuantity } from "../domain/stock-item/value-object/stock-item-quantity";
import { Money } from "../domain/shared/value-object/money";
import { adminAuthMiddleware } from "./middleware/auth";
import { signToken } from "../infrastructure/auth/jwt";

class InMemoryStockItemRepository implements StockItemRepository {
  private readonly items = new Map<string, StockItem>();
  private nextId = 1;

  public async create(stockItem: StockItem): Promise<StockItem> {
    const snapshot = stockItem.toSnapshot();

    if (this.items.has(snapshot.sku)) {
      throw new SkuAlreadyExists(snapshot.sku);
    }

    const id = this.nextId++;
    const sku = StockItemSku.create(snapshot.sku);
    const name = StockItemName.create(snapshot.name);
    const quantity = StockItemQuantity.create(snapshot.quantity);
    const price = Money.create(snapshot.price);

    const created = StockItem.rehydrate({
      id,
      sku,
      name,
      description: snapshot.description,
      unitOfMeasure: snapshot.unitOfMeasure,
      quantity,
      price,
    });

    this.items.set(snapshot.sku, created);

    return created;
  }

  public async findById(id: number): Promise<StockItem | null> {
    const found = Array.from(this.items.values()).find((item) => {
      const snapshot = item.toSnapshot();
      return snapshot.id === id;
    });

    return found ?? null;
  }

  public async save(stockItem: StockItem): Promise<void> {
    const snapshot = stockItem.toSnapshot();
    this.items.set(snapshot.sku, stockItem);
  }

  public async findAll(): Promise<StockItem[]> {
    return Array.from(this.items.values());
  }

  public async delete(id: number): Promise<void> {
    for (const [sku, item] of this.items.entries()) {
      if (item.toSnapshot().id === id) {
        this.items.delete(sku);
        break;
      }
    }
  }
}

function createApp() {
  const repository = new InMemoryStockItemRepository();
  const useCase = new CreateStockItem(repository);
  const increaseStockItemQuantity = new IncreaseStockItemQuantity(repository);
  const consumeStockItemQuantity = new ConsumeStockItemQuantity(repository);
  const getStockItemById = new GetStockItemById(repository);
  const listStockItems = new ListStockItems(repository);
  const updateStockItem = new UpdateStockItem(repository);
  const deleteStockItem = new DeleteStockItem(repository);
  const app = new Hono();

  registerStockItemRoutes(app, {
    createStockItem: useCase,
    increaseStockItemQuantity,
    consumeStockItemQuantity,
    getStockItemById,
    listStockItems,
    updateStockItem,
    deleteStockItem,
  });

  return app;
}

function createAppWithAuth() {
  const repository = new InMemoryStockItemRepository();
  const useCase = new CreateStockItem(repository);
  const increaseStockItemQuantity = new IncreaseStockItemQuantity(repository);
  const consumeStockItemQuantity = new ConsumeStockItemQuantity(repository);
  const getStockItemById = new GetStockItemById(repository);
  const listStockItems = new ListStockItems(repository);
  const updateStockItem = new UpdateStockItem(repository);
  const deleteStockItem = new DeleteStockItem(repository);
  const app = new Hono();

  app.use("/stock-items/*", adminAuthMiddleware);

  registerStockItemRoutes(app, {
    createStockItem: useCase,
    increaseStockItemQuantity,
    consumeStockItemQuantity,
    getStockItemById,
    listStockItems,
    updateStockItem,
    deleteStockItem,
  });

  return app;
}

describe("POST /stock-items", () => {
  it("creates a stock item and returns 201", async () => {
    const app = createApp();

    const response = await app.request("/stock-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "BRAKE_PAD_001",
        name: "Brake Pad",
        description: "Some",
        quantity: 10,
        unitOfMeasure: "UNIT",
        price: 199.9,
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(typeof body.id).toBe("number");
    expect(body).toMatchObject({
      sku: "BRAKE_PAD_001",
      name: "Brake Pad",
      description: "Some",
      unitOfMeasure: "UNIT",
      quantity: 10,
      price: 199.9,
    });
  });

  it("returns 400 when body is invalid", async () => {
    const app = createApp();

    const response = await app.request("/stock-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "",
        name: "",
        quantity: -1,
        price: -10,
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.error).toBe("ValidationError");
    expect(Array.isArray(body.details)).toBe(true);
  });

  it("returns 409 when SKU already exists", async () => {
    const app = createApp();

    const payload = {
      sku: "BRAKE_PAD_002",
      name: "Brake Pad",
      description: "Some",
      quantity: 5,
      unitOfMeasure: "UNIT",
      price: 10,
    };

    const first = await app.request("/stock-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(first.status).toBe(201);

    const second = await app.request("/stock-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error).toBe("SkuAlreadyExists");
  });

  it("creates a stock item when optional fields are omitted", async () => {
    const app = createApp();

    const response = await app.request("/stock-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "BRAKE_PAD_005",
        name: "Brake Pad",
        quantity: 3,
        price: 50,
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(typeof body.id).toBe("number");
    expect(body).toMatchObject({
      sku: "BRAKE_PAD_005",
      name: "Brake Pad",
      description: null,
      unitOfMeasure: null,
      quantity: 3,
    });
  });

  it("returns 500 when an unexpected Error is thrown", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const app = new Hono();

    registerStockItemRoutes(app, {
      createStockItem: {
        async execute() {
          throw new Error("boom");
        },
      } as unknown as CreateStockItem,
      increaseStockItemQuantity: {} as unknown as IncreaseStockItemQuantity,
      consumeStockItemQuantity: {} as unknown as ConsumeStockItemQuantity,
      getStockItemById: {} as unknown as GetStockItemById,
      listStockItems: {} as unknown as ListStockItems,
      updateStockItem: {} as unknown as UpdateStockItem,
      deleteStockItem: {} as unknown as DeleteStockItem,
    });

    const response = await app.request("/stock-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "BRAKE_PAD_003",
        name: "Brake Pad",
        description: "Some",
        quantity: 1,
        price: 10,
        unitOfMeasure: "UNIT",
      }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body).toMatchObject({
      error: "UnexpectedError",
      message: "boom",
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("returns 500 when an unknown non-Error is thrown", async () => {
    const app = new Hono();

    registerStockItemRoutes(app, {
      createStockItem: {
        async execute() {
          throw { reason: "unknown" };
        },
      } as unknown as CreateStockItem,
      increaseStockItemQuantity: {} as unknown as IncreaseStockItemQuantity,
      consumeStockItemQuantity: {} as unknown as ConsumeStockItemQuantity,
      getStockItemById: {} as unknown as GetStockItemById,
      listStockItems: {} as unknown as ListStockItems,
      updateStockItem: {} as unknown as UpdateStockItem,
      deleteStockItem: {} as unknown as DeleteStockItem,
    });

    const response = await app.request("/stock-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "BRAKE_PAD_004",
        name: "Brake Pad",
        description: "Some",
        quantity: 1,
        price: 10,
        unitOfMeasure: "UNIT",
      }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body).toMatchObject({
      error: "UnknownError",
    });
  });

  describe("POST /stock-items/:id/increase", () => {
    it("increases the stock item quantity and returns 200", async () => {
      const app = createApp();

      const createResponse = await app.request("/stock-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: "BRAKE_PAD_010",
          name: "Brake Pad",
          description: "Some",
          quantity: 10,
          price: 10,
          unitOfMeasure: "UNIT",
        }),
      });

      expect(createResponse.status).toBe(201);
      const createdBody = await createResponse.json();

      const increaseResponse = await app.request(`/stock-items/${createdBody.id}/increase`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: 5,
        }),
      });

      expect(increaseResponse.status).toBe(200);
      const body = await increaseResponse.json();

      expect(body.id).toBe(createdBody.id);
      expect(body).toMatchObject({
        sku: "BRAKE_PAD_010",
        name: "Brake Pad",
        description: "Some",
        unitOfMeasure: "UNIT",
        quantity: 15,
      });
    });

    it("returns 404 when the stock item does not exist", async () => {
      const app = createApp();

      const response = await app.request("/stock-items/999/increase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: 5,
        }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();

      expect(body.error).toBe("StockItemNotFound");
    });

    it("returns 400 when body is invalid", async () => {
      const app = createApp();

      const createResponse = await app.request("/stock-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: "BRAKE_PAD_011",
          name: "Brake Pad",
          description: "Some",
          quantity: 10,
          price: 10,
          unitOfMeasure: "UNIT",
        }),
      });

      expect(createResponse.status).toBe(201);

      const createdBody = await createResponse.json();

      const response = await app.request(`/stock-items/${createdBody.id}/increase`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: -1,
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();

      expect(body.error).toBe("ValidationError");
    });

    it("returns 500 when an unexpected Error is thrown", async () => {
      const app = new Hono();

      registerStockItemRoutes(app, {
        createStockItem: {} as unknown as CreateStockItem,
        increaseStockItemQuantity: {
          async execute() {
            throw new Error("boom");
          },
        } as unknown as IncreaseStockItemQuantity,
        consumeStockItemQuantity: {} as unknown as ConsumeStockItemQuantity,
        getStockItemById: {} as unknown as GetStockItemById,
        listStockItems: {} as unknown as ListStockItems,
        updateStockItem: {} as unknown as UpdateStockItem,
        deleteStockItem: {} as unknown as DeleteStockItem,
      });

      const response = await app.request("/stock-items/1/increase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: 5,
        }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();

      expect(body).toMatchObject({
        error: "UnexpectedError",
        message: "boom",
      });
    });

    it("returns 500 when an unknown non-Error is thrown", async () => {
      const app = new Hono();

      registerStockItemRoutes(app, {
        createStockItem: {} as unknown as CreateStockItem,
        increaseStockItemQuantity: {
          async execute() {
            throw { reason: "unknown" };
          },
        } as unknown as IncreaseStockItemQuantity,
        consumeStockItemQuantity: {} as unknown as ConsumeStockItemQuantity,
        getStockItemById: {} as unknown as GetStockItemById,
        listStockItems: {} as unknown as ListStockItems,
        updateStockItem: {} as unknown as UpdateStockItem,
        deleteStockItem: {} as unknown as DeleteStockItem,
      });

      const response = await app.request("/stock-items/1/increase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: 5,
        }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();

      expect(body).toMatchObject({
        error: "UnknownError",
      });
    });
  });

  describe("POST /stock-items/:id/consume", () => {
    it("consumes stock item quantity and returns 200", async () => {
      const app = createApp();

      const createResponse = await app.request("/stock-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: "BRAKE_PAD_020",
          name: "Brake Pad",
          description: "Some",
          quantity: 10,
          price: 10,
          unitOfMeasure: "UNIT",
        }),
      });

      expect(createResponse.status).toBe(201);
      const createdBody = await createResponse.json();

      const consumeResponse = await app.request(`/stock-items/${createdBody.id}/consume`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: 3,
        }),
      });

      expect(consumeResponse.status).toBe(200);
      const body = await consumeResponse.json();

      expect(body.id).toBe(createdBody.id);
      expect(body).toMatchObject({
        sku: "BRAKE_PAD_020",
        name: "Brake Pad",
        description: "Some",
        unitOfMeasure: "UNIT",
        quantity: 7,
      });
    });

    it("returns 404 when the stock item does not exist", async () => {
      const app = createApp();

      const response = await app.request("/stock-items/999/consume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: 5,
        }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();

      expect(body.error).toBe("StockItemNotFound");
    });

    it("returns 400 when body is invalid", async () => {
      const app = createApp();

      const createResponse = await app.request("/stock-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: "BRAKE_PAD_021",
          name: "Brake Pad",
          description: "Some",
          quantity: 10,
          price: 10,
          unitOfMeasure: "UNIT",
        }),
      });

      expect(createResponse.status).toBe(201);

      const createdBody = await createResponse.json();

      const response = await app.request(`/stock-items/${createdBody.id}/consume`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: -1,
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();

      expect(body.error).toBe("ValidationError");
    });

    it("returns 409 when there is insufficient stock", async () => {
      const app = createApp();

      const createResponse = await app.request("/stock-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: "BRAKE_PAD_022",
          name: "Brake Pad",
          description: "Some",
          quantity: 2,
          price: 10,
          unitOfMeasure: "UNIT",
        }),
      });

      expect(createResponse.status).toBe(201);

      const createdBody = await createResponse.json();

      const response = await app.request(`/stock-items/${createdBody.id}/consume`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: 5,
        }),
      });

      expect(response.status).toBe(409);
      const body = await response.json();

      expect(body.error).toBe("InsufficientStock");
    });

    it("returns 500 when an unexpected Error is thrown", async () => {
      const app = new Hono();

      registerStockItemRoutes(app, {
        createStockItem: {} as unknown as CreateStockItem,
        increaseStockItemQuantity: {} as unknown as IncreaseStockItemQuantity,
        consumeStockItemQuantity: {
          async execute() {
            throw new Error("boom");
          },
        } as unknown as ConsumeStockItemQuantity,
        getStockItemById: {} as unknown as GetStockItemById,
        listStockItems: {} as unknown as ListStockItems,
        updateStockItem: {} as unknown as UpdateStockItem,
        deleteStockItem: {} as unknown as DeleteStockItem,
      });

      const response = await app.request("/stock-items/1/consume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: 5,
        }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();

      expect(body).toMatchObject({
        error: "UnexpectedError",
        message: "boom",
      });
    });

    it("returns 500 when an unknown non-Error is thrown", async () => {
      const app = new Hono();

      registerStockItemRoutes(app, {
        createStockItem: {} as unknown as CreateStockItem,
        increaseStockItemQuantity: {} as unknown as IncreaseStockItemQuantity,
        consumeStockItemQuantity: {
          async execute() {
            throw { reason: "unknown" };
          },
        } as unknown as ConsumeStockItemQuantity,
        getStockItemById: {} as unknown as GetStockItemById,
        listStockItems: {} as unknown as ListStockItems,
        updateStockItem: {} as unknown as UpdateStockItem,
        deleteStockItem: {} as unknown as DeleteStockItem,
      });

      const response = await app.request("/stock-items/1/consume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: 5,
        }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();

      expect(body).toMatchObject({
        error: "UnknownError",
      });
    });
  });
  describe("authentication", () => {
    beforeAll(() => {
      process.env.JWT_SECRET = "test-secret";
    });

    it("returns 401 when Authorization header is missing", async () => {
      const app = createAppWithAuth();

      const response = await app.request("/stock-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: "AUTH_001",
          name: "Auth Item",
          description: null,
          quantity: 1,
          unitOfMeasure: null,
        }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 when token is invalid", async () => {
      const app = createAppWithAuth();

      const response = await app.request("/stock-items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer invalid-token",
        },
        body: JSON.stringify({
          sku: "AUTH_002",
          name: "Auth Item",
          description: null,
          quantity: 1,
          unitOfMeasure: null,
        }),
      });

      expect(response.status).toBe(401);
    });

    it("allows access with a valid token", async () => {
      const app = createAppWithAuth();

      const token = signToken({ sub: "admin" });

      const response = await app.request("/stock-items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sku: "AUTH_003",
          name: "Auth Item",
          description: null,
          quantity: 1,
          price: 10,
          unitOfMeasure: null,
        }),
      });

      expect(response.status).toBe(201);
    });
  });
});
