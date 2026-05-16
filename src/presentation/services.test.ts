import { beforeAll, describe, expect, it, vi } from "bun:test";
import { Hono } from "hono";

import { registerServiceRoutes } from "./services";
import { CreateService } from "../application/service/create-service";
import { GetServiceById } from "../application/service/get-service-by-id";
import { GetServiceAverageDuration } from "../application/service/get-service-average-duration";
import { ListServices } from "../application/service/list-services";
import { UpdateService } from "../application/service/update-service";
import { DeleteService } from "../application/service/delete-service";
import type { ServiceRepository } from "../domain/service/repository/service-repository";
import { Service } from "../domain/service/aggregate/service";
import { ServiceName } from "../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../domain/service/value-object/service-estimated-time";
import { ServiceStockItemsRequired } from "../domain/service/value-object/service-stock-item-reference";
import type { StockItemRepository } from "../domain/stock-item/repository/stock-item-repository";
import type { StockItem } from "../domain/stock-item/aggregate/stock-item";
import { adminAuthMiddleware } from "./middleware/auth";
import { signToken } from "../infrastructure/auth/jwt";
import { Money } from "../domain/shared/value-object/money";
import type { ServiceTaskRepository } from "../domain/service-task/repository/service-task-repository";
import { ServiceTask } from "../domain/service-task/aggregate/service-task";
import { ServiceTaskStatus } from "../domain/service-task/value-object/service-task-status";

class InMemoryServiceRepository implements ServiceRepository {
  private readonly services = new Map<number, Service>();
  private nextId = 1;

  public async create(service: Service): Promise<Service> {
    const snapshot = service.toSnapshot();
    const id = snapshot.id ?? this.nextId++;

    const created = Service.rehydrate({
      id,
      name: ServiceName.create(snapshot.name),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(snapshot.estimatedTime),
      price: Money.create(snapshot.price),
      requiredItems: (snapshot.requiredItems ?? []).map((item) =>
        ServiceStockItemsRequired.create({
          stockItemId: item.stockItemId,
          quantity: item.quantity,
        }),
      ),
    });

    this.services.set(id, created);

    return created;
  }

  public async findById(id: number): Promise<Service | null> {
    return this.services.get(id) ?? null;
  }

  public async findAll(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  public async save(service: Service): Promise<void> {
    const snapshot = service.toSnapshot();
    if (!snapshot.id) {
      throw new Error("Cannot save Service without an id");
    }

    this.services.set(snapshot.id, service);
  }

  public async delete(id: number): Promise<void> {
    this.services.delete(id);
  }
}

class InMemoryServiceTaskRepository implements ServiceTaskRepository {
  public tasks = new Map<number, ServiceTask>();
  private nextId = 1;

  public async create(serviceTask: ServiceTask): Promise<ServiceTask> {
    const snapshot = serviceTask.toSnapshot();
    const id = snapshot.id ?? this.nextId++;

    const created = ServiceTask.rehydrate({
      id,
      serviceId: snapshot.serviceId,
      workOrderId: snapshot.workOrderId,
      status: snapshot.status,
      estimatedTime: ServiceEstimatedTime.createFromMinutes(snapshot.estimatedTime),
      price: Money.create(snapshot.price),
      startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : null,
      completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : null,
    });

    this.tasks.set(id, created);

    return created;
  }

  public async findById(id: number): Promise<ServiceTask | null> {
    return this.tasks.get(id) ?? null;
  }

  public async findByServiceId(serviceId: number): Promise<ServiceTask[]> {
    return [...this.tasks.values()].filter((task) => task.toSnapshot().serviceId === serviceId);
  }

  public async findAll(): Promise<ServiceTask[]> {
    return [...this.tasks.values()];
  }

  public async save(serviceTask: ServiceTask): Promise<void> {
    const snapshot = serviceTask.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Service task must have an id to be saved");
    }
    this.tasks.set(snapshot.id, serviceTask);
  }
}

class FakeStockItemRepository implements StockItemRepository {
  public existingIds = new Set<number>();

  public async create(): Promise<StockItem> {
    throw new Error("Not implemented");
  }

  public async findById(id: number): Promise<StockItem | null> {
    if (this.existingIds.has(id)) {
      return {} as StockItem;
    }

    return null;
  }

  public async save(): Promise<void> {}

  public async findAll(): Promise<StockItem[]> {
    return [];
  }

  public async delete(id: number): Promise<void> {
    void id;
  }
}

function createApp() {
  const repository = new InMemoryServiceRepository();
  const serviceTaskRepository = new InMemoryServiceTaskRepository();
  const stockItemRepository = new FakeStockItemRepository();
  stockItemRepository.existingIds.add(1);
  const createService = new CreateService(repository, stockItemRepository);
  const getServiceById = new GetServiceById(repository);
  const getServiceAverageDuration = new GetServiceAverageDuration(
    repository,
    serviceTaskRepository,
  );
  const listServices = new ListServices(repository);
  const updateService = new UpdateService(repository, stockItemRepository);
  const deleteService = new DeleteService(repository);
  const app = new Hono();

  registerServiceRoutes(app, {
    createService,
    getServiceById,
    getServiceAverageDuration,
    listServices,
    updateService,
    deleteService,
  });

  return app;
}

function createAppWithAuth() {
  const repository = new InMemoryServiceRepository();
  const serviceTaskRepository = new InMemoryServiceTaskRepository();
  const stockItemRepository = new FakeStockItemRepository();
  stockItemRepository.existingIds.add(1);
  const createService = new CreateService(repository, stockItemRepository);
  const getServiceById = new GetServiceById(repository);
  const getServiceAverageDuration = new GetServiceAverageDuration(
    repository,
    serviceTaskRepository,
  );
  const listServices = new ListServices(repository);
  const updateService = new UpdateService(repository, stockItemRepository);
  const deleteService = new DeleteService(repository);
  const app = new Hono();

  app.use("/services/*", adminAuthMiddleware);

  registerServiceRoutes(app, {
    createService,
    getServiceById,
    getServiceAverageDuration,
    listServices,
    updateService,
    deleteService,
  });

  return app;
}

describe("Service routes", () => {
  it("creates a service and returns 201", async () => {
    const app = createApp();

    const response = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Brake Inspection",
        estimatedTime: 90,
        price: 120.5,
        requiredItems: [
          {
            stockItemId: 1,
            quantity: 2,
          },
        ],
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(typeof body.id).toBe("number");
    expect(body).toMatchObject({
      name: "Brake Inspection",
      estimatedTime: 90,
      price: 120.5,
      requiredItems: [
        {
          stockItemId: 1,
          quantity: 2,
        },
      ],
    });
  });

  it("returns 404 when a required stock item does not exist", async () => {
    const app = createApp();

    const response = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Brake Inspection",
        estimatedTime: 90,
        price: 100,
        requiredItems: [
          {
            stockItemId: "999",
            quantity: 2,
          },
        ],
      }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();

    expect(body.error).toBe("StockItemNotFound");
  });

  it("returns 400 when create body is invalid", async () => {
    const app = createApp();

    const response = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "",
        estimatedTime: -1,
        price: -10,
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.error).toBe("ValidationError");
    expect(Array.isArray(body.details)).toBe(true);
  });

  it("returns 400 when price has more than two decimal places", async () => {
    const app = createApp();

    const response = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Invalid decimal price",
        estimatedTime: 30,
        price: 10.999,
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.error).toBe("ValidationError");
  });

  it("lists services and returns 200", async () => {
    const app = createApp();

    const createResponse = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Oil Change",
        estimatedTime: 45,
        price: 80,
      }),
    });

    expect(createResponse.status).toBe(201);

    const listResponse = await app.request("/services", {
      method: "GET",
    });

    expect(listResponse.status).toBe(200);
    const body = await listResponse.json();

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].name).toBe("Oil Change");
  });

  it("gets a service by id and returns 200", async () => {
    const app = createApp();

    const createResponse = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Alignment",
        estimatedTime: 60,
        price: 90,
      }),
    });

    const created = await createResponse.json();

    const response = await app.request(`/services/${created.id}`, {
      method: "GET",
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.id).toBe(created.id);
    expect(body.name).toBe("Alignment");
  });

  it("returns 400 when id param is invalid on GET", async () => {
    const app = createApp();

    const response = await app.request("/services/not-a-number", {
      method: "GET",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("ValidationError");
  });

  it("returns 404 when service is not found on GET", async () => {
    const app = createApp();

    const response = await app.request("/services/999", {
      method: "GET",
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("ServiceNotFound");
  });

  it("calculates average service duration from completed tasks", async () => {
    const repository = new InMemoryServiceRepository();
    const serviceTaskRepository = new InMemoryServiceTaskRepository();

    const app = new Hono();

    const stockItemRepository = new FakeStockItemRepository();
    stockItemRepository.existingIds.add(1);

    const createService = new CreateService(repository, stockItemRepository);
    const getServiceById = new GetServiceById(repository);
    const getServiceAverageDuration = new GetServiceAverageDuration(
      repository,
      serviceTaskRepository,
    );
    const listServices = new ListServices(repository);
    const updateService = new UpdateService(repository, stockItemRepository);
    const deleteService = new DeleteService(repository);

    registerServiceRoutes(app, {
      createService,
      getServiceById,
      getServiceAverageDuration,
      listServices,
      updateService,
      deleteService,
    });

    const createResponse = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Inspection",
        estimatedTime: 60,
        price: 100,
      }),
    });

    expect(createResponse.status).toBe(201);
    const createdService = await createResponse.json();

    const serviceId = createdService.id as number;

    const baseStart = new Date("2024-01-01T10:00:00.000Z");

    await serviceTaskRepository.create(
      ServiceTask.rehydrate({
        id: 1,
        serviceId,
        workOrderId: 1,
        status: ServiceTaskStatus.COMPLETED,
        estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
        price: Money.create(100),
        startedAt: baseStart,
        completedAt: new Date(baseStart.getTime() + 30 * 60 * 1000),
      }),
    );

    await serviceTaskRepository.create(
      ServiceTask.rehydrate({
        id: 2,
        serviceId,
        workOrderId: 2,
        status: ServiceTaskStatus.COMPLETED,
        estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
        price: Money.create(150),
        startedAt: baseStart,
        completedAt: new Date(baseStart.getTime() + 90 * 60 * 1000),
      }),
    );

    const response = await app.request(`/services/${serviceId}/average-duration`, {
      method: "GET",
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toMatchObject({
      serviceId,
      averageDurationSeconds: 3600,
      taskCount: 2,
      hasData: true,
    });
  });

  it("returns hasData=false when service has no completed tasks", async () => {
    const repository = new InMemoryServiceRepository();
    const serviceTaskRepository = new InMemoryServiceTaskRepository();

    const app = new Hono();

    const stockItemRepository = new FakeStockItemRepository();
    stockItemRepository.existingIds.add(1);

    const createService = new CreateService(repository, stockItemRepository);
    const getServiceById = new GetServiceById(repository);
    const getServiceAverageDuration = new GetServiceAverageDuration(
      repository,
      serviceTaskRepository,
    );
    const listServices = new ListServices(repository);
    const updateService = new UpdateService(repository, stockItemRepository);
    const deleteService = new DeleteService(repository);

    registerServiceRoutes(app, {
      createService,
      getServiceById,
      getServiceAverageDuration,
      listServices,
      updateService,
      deleteService,
    });

    const createResponse = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Inspection",
        estimatedTime: 60,
        price: 100,
      }),
    });

    expect(createResponse.status).toBe(201);
    const createdService = await createResponse.json();

    const serviceId = createdService.id as number;

    const response = await app.request(`/services/${serviceId}/average-duration`, {
      method: "GET",
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toMatchObject({
      serviceId,
      averageDurationSeconds: null,
      taskCount: 0,
      hasData: false,
    });
  });

  it("returns 500 when an unexpected Error is thrown on GET /services/:id", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const app = new Hono();

    registerServiceRoutes(app, {
      createService: {} as unknown as CreateService,
      getServiceById: {
        async execute() {
          throw new Error("boom");
        },
      } as unknown as GetServiceById,
      listServices: {} as unknown as ListServices,
      updateService: {} as unknown as UpdateService,
      deleteService: {} as unknown as DeleteService,
    });

    const response = await app.request("/services/123", {
      method: "GET",
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

  it("returns 500 when an unknown non-Error is thrown on GET /services/:id", async () => {
    const app = new Hono();

    registerServiceRoutes(app, {
      createService: {} as unknown as CreateService,
      getServiceById: {
        async execute() {
          throw { reason: "unknown" };
        },
      } as unknown as GetServiceById,
      listServices: {} as unknown as ListServices,
      updateService: {} as unknown as UpdateService,
      deleteService: {} as unknown as DeleteService,
    });

    const response = await app.request("/services/123", {
      method: "GET",
    });

    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body).toMatchObject({
      error: "UnknownError",
    });
  });

  it("updates a service and returns 200", async () => {
    const app = createApp();

    const createResponse = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Basic Wash",
        estimatedTime: 30,
        price: 50,
      }),
    });

    const created = await createResponse.json();

    const response = await app.request(`/services/${created.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Premium Wash",
        estimatedTime: 45,
        price: 70,
        requiredItems: [],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.name).toBe("Premium Wash");
    expect(body.estimatedTime).toBe(45);
    expect(body.price).toBe(70);
  });

  it("returns 400 when body is invalid on PUT", async () => {
    const app = createApp();

    const response = await app.request("/services/123", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "",
        estimatedTime: 0,
        price: -10,
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("ValidationError");
  });

  it("returns 404 when service is not found on PUT", async () => {
    const app = createApp();

    const response = await app.request("/services/999", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Does Not Exist",
        estimatedTime: 30,
        price: 40,
      }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("ServiceNotFound");
  });

  it("deletes a service and returns 204", async () => {
    const app = createApp();

    const createResponse = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Tire Rotation",
        estimatedTime: 20,
        price: 60,
      }),
    });

    const created = await createResponse.json();

    const response = await app.request(`/services/${created.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(204);
  });

  it("returns 400 when id param is invalid on DELETE", async () => {
    const app = createApp();

    const response = await app.request("/services/not-a-number", {
      method: "DELETE",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("ValidationError");
  });

  it("returns 404 when service is not found on DELETE", async () => {
    const app = createApp();

    const response = await app.request("/services/999", {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("ServiceNotFound");
  });

  it("returns 500 when an unexpected Error is thrown on GET /services", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const app = new Hono();

    registerServiceRoutes(app, {
      createService: {} as unknown as CreateService,
      getServiceById: {} as unknown as GetServiceById,
      listServices: {
        async execute() {
          throw new Error("boom");
        },
      } as unknown as ListServices,
      updateService: {} as unknown as UpdateService,
      deleteService: {} as unknown as DeleteService,
    });

    const response = await app.request("/services", {
      method: "GET",
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

  it("returns 500 when an unknown non-Error is thrown on GET /services", async () => {
    const app = new Hono();

    registerServiceRoutes(app, {
      createService: {} as unknown as CreateService,
      getServiceById: {} as unknown as GetServiceById,
      listServices: {
        async execute() {
          throw { reason: "unknown" };
        },
      } as unknown as ListServices,
      updateService: {} as unknown as UpdateService,
      deleteService: {} as unknown as DeleteService,
    });

    const response = await app.request("/services", {
      method: "GET",
    });

    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body).toMatchObject({
      error: "UnknownError",
    });
  });

  it("returns 500 when an unexpected Error is thrown on PUT", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const app = new Hono();

    registerServiceRoutes(app, {
      createService: {} as unknown as CreateService,
      getServiceById: {} as unknown as GetServiceById,
      listServices: {} as unknown as ListServices,
      updateService: {
        async execute() {
          throw new Error("boom");
        },
      } as unknown as UpdateService,
      deleteService: {} as unknown as DeleteService,
    });

    const response = await app.request("/services/123", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Any",
        estimatedTime: 10,
        price: 30,
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

  it("returns 500 when an unknown non-Error is thrown on PUT", async () => {
    const app = new Hono();

    registerServiceRoutes(app, {
      createService: {} as unknown as CreateService,
      getServiceById: {} as unknown as GetServiceById,
      listServices: {} as unknown as ListServices,
      updateService: {
        async execute() {
          throw { reason: "unknown" };
        },
      } as unknown as UpdateService,
      deleteService: {} as unknown as DeleteService,
    });

    const response = await app.request("/services/123", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Any",
        estimatedTime: 10,
        price: 30,
      }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body).toMatchObject({
      error: "UnknownError",
    });
  });

  it("returns 500 when an unexpected Error is thrown on DELETE", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const app = new Hono();

    registerServiceRoutes(app, {
      createService: {} as unknown as CreateService,
      getServiceById: {} as unknown as GetServiceById,
      listServices: {} as unknown as ListServices,
      updateService: {} as unknown as UpdateService,
      deleteService: {
        async execute() {
          throw new Error("boom");
        },
      } as unknown as DeleteService,
    });

    const response = await app.request("/services/123", {
      method: "DELETE",
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

  it("returns 500 when an unknown non-Error is thrown on DELETE", async () => {
    const app = new Hono();

    registerServiceRoutes(app, {
      createService: {} as unknown as CreateService,
      getServiceById: {} as unknown as GetServiceById,
      listServices: {} as unknown as ListServices,
      updateService: {} as unknown as UpdateService,
      deleteService: {
        async execute() {
          throw { reason: "unknown" };
        },
      } as unknown as DeleteService,
    });

    const response = await app.request("/services/123", {
      method: "DELETE",
    });

    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body).toMatchObject({
      error: "UnknownError",
    });
  });

  it("returns 500 when an unexpected Error is thrown on POST", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const app = new Hono();

    registerServiceRoutes(app, {
      createService: {
        async execute() {
          throw new Error("boom");
        },
      } as unknown as CreateService,
      getServiceById: {} as unknown as GetServiceById,
      listServices: {} as unknown as ListServices,
      updateService: {} as unknown as UpdateService,
      deleteService: {} as unknown as DeleteService,
    });

    const response = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Any",
        estimatedTime: 10,
        price: 30,
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

  it("returns 500 when an unknown non-Error is thrown on POST", async () => {
    const app = new Hono();

    registerServiceRoutes(app, {
      createService: {
        async execute() {
          throw { reason: "unknown" };
        },
      } as unknown as CreateService,
      getServiceById: {} as unknown as GetServiceById,
      listServices: {} as unknown as ListServices,
      updateService: {} as unknown as UpdateService,
      deleteService: {} as unknown as DeleteService,
    });

    const response = await app.request("/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Any",
        estimatedTime: 10,
        price: 30,
      }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body).toMatchObject({
      error: "UnknownError",
    });
  });

  describe("authentication", () => {
    beforeAll(() => {
      process.env.JWT_SECRET = "test-secret";
    });

    it("returns 401 when Authorization header is missing", async () => {
      const app = createAppWithAuth();

      const response = await app.request("/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Auth Test",
          estimatedTime: 30,
          price: 40,
          requiredItems: [
            {
              stockItemId: "1",
              quantity: 1,
            },
          ],
        }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 when token is invalid", async () => {
      const app = createAppWithAuth();

      const response = await app.request("/services", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer invalid-token",
        },
        body: JSON.stringify({
          name: "Auth Test",
          estimatedTime: 30,
          price: 50,
          requiredItems: [
            {
              stockItemId: "1",
              quantity: 1,
            },
          ],
        }),
      });

      expect(response.status).toBe(401);
    });

    it("allows access with a valid token", async () => {
      const app = createAppWithAuth();

      const token = signToken({ sub: "admin" });

      const response = await app.request("/services", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: "Auth Test",
          estimatedTime: 30,
          price: 60,
          requiredItems: [
            {
              stockItemId: "1",
              quantity: 1,
            },
          ],
        }),
      });

      expect(response.status).toBe(201);
    });
  });
});
