import { beforeAll, describe, expect, it, vi } from "bun:test";
import { Hono } from "hono";

import { registerServiceTaskRoutes } from "./service-tasks";
import { AddServiceTask } from "../application/service-task/add-service-task";
import { ApproveServiceTask } from "../application/service-task/approve-service-task";
import { ApproveServiceTaskByPublicToken } from "../application/service-task/approve-service-task-by-public-token";
import { RejectServiceTask } from "../application/service-task/reject-service-task";
import { RejectServiceTaskByPublicToken } from "../application/service-task/reject-service-task-by-public-token";
import { StartServiceExecution } from "../application/service-task/start-service-execution";
import { CompleteServiceTask } from "../application/service-task/complete-service-task";
import { GetServiceTaskById } from "../application/service-task/get-service-task-by-id";
import { ListServiceTasks } from "../application/service-task/list-service-tasks";
import type { ServiceTaskRepository } from "../domain/service-task/repository/service-task-repository";
import type { ServiceRepository } from "../domain/service/repository/service-repository";
import type { StockItemRepository } from "../domain/stock-item/repository/stock-item-repository";
import type { StockItem } from "../domain/stock-item/aggregate/stock-item";
import { Service } from "../domain/service/aggregate/service";
import { ServiceName } from "../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../domain/service/value-object/service-estimated-time";
import { ServiceStockItemsRequired } from "../domain/service/value-object/service-stock-item-reference";
import { ServiceTask } from "../domain/service-task/aggregate/service-task";
import { ServiceTaskStatus } from "../domain/service-task/value-object/service-task-status";
import { StockItem as StockItemAggregate } from "../domain/stock-item/aggregate/stock-item";
import { StockItemName } from "../domain/stock-item/value-object/stock-item-name";
import { StockItemQuantity } from "../domain/stock-item/value-object/stock-item-quantity";
import { StockItemSku } from "../domain/stock-item/value-object/stock-item-sku";
import { adminAuthMiddleware } from "./middleware/auth";
import { signToken } from "../infrastructure/auth/jwt";
import { Money } from "../domain/shared/value-object/money";
import type { WorkOrderRepository } from "../domain/work-order/repository/work-order-repository";
import { WorkOrder } from "../domain/work-order/aggregate/work-order";
import { WorkOrderStatus } from "../domain/work-order/value-object/work-order-status";
import { WorkOrderNotFound } from "../domain/work-order/domain-error/work-order-not-found";
import { WorkOrderStatusTransitionNotAllowed } from "../domain/work-order/domain-error/work-order-status-transition-not-allowed";

class InMemoryServiceRepository implements ServiceRepository {
  public services = new Map<number, Service>();

  public async create(service: Service): Promise<Service> {
    this.services.set(service.toSnapshot().id ?? 0, service);
    return service;
  }

  public async findById(id: number): Promise<Service | null> {
    return this.services.get(id) ?? null;
  }

  public async findAll(): Promise<Service[]> {
    return [...this.services.values()];
  }

  public async save(service: Service): Promise<void> {
    this.services.set(service.toSnapshot().id ?? 0, service);
  }

  public async delete(id: number): Promise<void> {
    this.services.delete(id);
  }
}

class InMemoryServiceTaskRepository implements ServiceTaskRepository {
  private nextId = 1;
  public tasks = new Map<number, ServiceTask>();

  public async create(serviceTask: ServiceTask): Promise<ServiceTask> {
    const snapshot = serviceTask.toSnapshot();
    const id = this.nextId++;

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

class InMemoryWorkOrderRepository implements WorkOrderRepository {
  public items = new Map<number, WorkOrder>();

  public async create(workOrder: WorkOrder): Promise<WorkOrder> {
    const snapshot = workOrder.toSnapshot();
    const created = WorkOrder.rehydrate({
      id: snapshot.id ?? this.items.size + 1,
      vehicleId: snapshot.vehicleId,
      status: snapshot.status,
      totalAmount: Money.create(snapshot.totalAmount),
      publicToken: snapshot.publicToken,
      publicTokenExpiresAt: new Date(snapshot.publicTokenExpiresAt),
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      serviceTasks: snapshot.serviceTasks.map((task) => ({
        serviceTaskId: task.serviceTaskId,
        status: task.status,
        amount: Money.create(task.amount),
      })),
    });

    this.items.set(created.toSnapshot().id ?? 0, created);
    return created;
  }

  public async findById(id: number): Promise<WorkOrder | null> {
    return this.items.get(id) ?? null;
  }

  public async findByPublicToken(token: string): Promise<WorkOrder | null> {
    for (const workOrder of this.items.values()) {
      if (workOrder.toSnapshot().publicToken === token) {
        return workOrder;
      }
    }
    return null;
  }

  public async findAll(): Promise<WorkOrder[]> {
    return [...this.items.values()];
  }

  public async listOperationalQueue(): Promise<WorkOrder[]> {
    return this.findAll();
  }

  public async save(workOrder: WorkOrder): Promise<void> {
    const snapshot = workOrder.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Work order must have an id to be saved");
    }
    this.items.set(snapshot.id, workOrder);
  }
}

class InMemoryStockItemRepository implements StockItemRepository {
  public items = new Map<number, StockItem>();

  public async create(): Promise<StockItem> {
    throw new Error("Not implemented");
  }

  public async findById(id: number): Promise<StockItem | null> {
    return this.items.get(id) ?? null;
  }

  public async save(stockItem: StockItem): Promise<void> {
    const snapshot = stockItem.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Stock item must have an id to be saved");
    }
    this.items.set(snapshot.id, stockItem);
  }

  public async findAll(): Promise<StockItem[]> {
    return [...this.items.values()];
  }

  public async delete(id: number): Promise<void> {
    this.items.delete(id);
  }
}

function buildService(): Service {
  return Service.rehydrate({
    id: 1,
    name: ServiceName.create("Inspection"),
    estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
    price: Money.create(200),
    requiredItems: [
      ServiceStockItemsRequired.create({
        stockItemId: 1,
        quantity: 2,
      }),
    ],
  });
}

function buildStockItem(quantity: number): StockItemAggregate {
  return StockItemAggregate.rehydrate({
    id: 1,
    sku: StockItemSku.create("SKU-1"),
    name: StockItemName.create("Brake Pad"),
    description: null,
    unitOfMeasure: null,
    quantity: StockItemQuantity.create(quantity),
    price: Money.create(25),
  });
}

function createApp(params?: { stockQuantity?: number }) {
  const serviceRepository = new InMemoryServiceRepository();
  const serviceTaskRepository = new InMemoryServiceTaskRepository();
  const stockItemRepository = new InMemoryStockItemRepository();
  const workOrderRepository = new InMemoryWorkOrderRepository();

  serviceRepository.services.set(1, buildService());
  stockItemRepository.items.set(1, buildStockItem(params?.stockQuantity ?? 10));

  const workOrder = WorkOrder.rehydrate({
    id: 1,
    vehicleId: 1,
    status: WorkOrderStatus.DIAGNOSIS,
    totalAmount: Money.create(0),
    publicToken: "token-1",
    publicTokenExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    serviceTasks: [],
  });

  void workOrderRepository.create(workOrder);

  const addServiceTask = new AddServiceTask(
    serviceTaskRepository,
    serviceRepository,
    workOrderRepository,
    stockItemRepository,
  );
  const approveServiceTask = new ApproveServiceTask(serviceTaskRepository);
  const rejectServiceTask = new RejectServiceTask(serviceTaskRepository);
  const startServiceExecution = new StartServiceExecution(
    serviceTaskRepository,
    serviceRepository,
    stockItemRepository,
  );
  const completeServiceTask = new CompleteServiceTask(serviceTaskRepository, workOrderRepository);
  const getServiceTaskById = new GetServiceTaskById(serviceTaskRepository);
  const listServiceTasks = new ListServiceTasks(serviceTaskRepository);

  const app = new Hono();
  registerServiceTaskRoutes(app, {
    addServiceTask,
    approveServiceTask,
    rejectServiceTask,
    startServiceExecution,
    completeServiceTask,
    getServiceTaskById,
    listServiceTasks,
  });

  return app;
}

function createAppWithAuth() {
  const serviceRepository = new InMemoryServiceRepository();
  const serviceTaskRepository = new InMemoryServiceTaskRepository();
  const stockItemRepository = new InMemoryStockItemRepository();
  const workOrderRepository = new InMemoryWorkOrderRepository();

  serviceRepository.services.set(1, buildService());
  stockItemRepository.items.set(1, buildStockItem(10));

  const workOrder = WorkOrder.rehydrate({
    id: 1,
    vehicleId: 1,
    status: WorkOrderStatus.RECEIVED,
    totalAmount: Money.create(0),
    publicToken: "token-1",
    publicTokenExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    serviceTasks: [],
  });

  void workOrderRepository.create(workOrder);

  const addServiceTask = new AddServiceTask(
    serviceTaskRepository,
    serviceRepository,
    workOrderRepository,
    stockItemRepository,
  );
  const approveServiceTask = new ApproveServiceTask(serviceTaskRepository);
  const rejectServiceTask = new RejectServiceTask(serviceTaskRepository);
  const startServiceExecution = new StartServiceExecution(
    serviceTaskRepository,
    serviceRepository,
    stockItemRepository,
  );
  const completeServiceTask = new CompleteServiceTask(serviceTaskRepository, workOrderRepository);
  const getServiceTaskById = new GetServiceTaskById(serviceTaskRepository);
  const listServiceTasks = new ListServiceTasks(serviceTaskRepository);

  const app = new Hono();
  app.use("/service-tasks/*", adminAuthMiddleware);

  registerServiceTaskRoutes(app, {
    addServiceTask,
    approveServiceTask,
    rejectServiceTask,
    startServiceExecution,
    completeServiceTask,
    getServiceTaskById,
    listServiceTasks,
  });

  return app;
}

function createAppWithWorkOrderStatus(
  status: WorkOrderStatus,
  params?: { serviceTaskStatus?: ServiceTaskStatus; stockQuantity?: number },
) {
  const serviceRepository = new InMemoryServiceRepository();
  const serviceTaskRepository = new InMemoryServiceTaskRepository();
  const stockItemRepository = new InMemoryStockItemRepository();
  const workOrderRepository = new InMemoryWorkOrderRepository();

  serviceRepository.services.set(1, buildService());
  const serviceTaskStatus = params?.serviceTaskStatus ?? ServiceTaskStatus.PENDING_APPROVAL;
  const stockQuantity = params?.stockQuantity ?? 10;
  stockItemRepository.items.set(1, buildStockItem(stockQuantity));

  const workOrderId = 1;
  const serviceTaskId = 1;

  const startedAt =
    serviceTaskStatus === ServiceTaskStatus.IN_EXECUTION ||
    serviceTaskStatus === ServiceTaskStatus.COMPLETED
      ? new Date("2024-01-10T09:00:00.000Z")
      : null;
  const completedAt =
    serviceTaskStatus === ServiceTaskStatus.COMPLETED ? new Date("2024-01-10T10:00:00.000Z") : null;

  const serviceTask = ServiceTask.rehydrate({
    id: serviceTaskId,
    serviceId: 1,
    workOrderId,
    status: serviceTaskStatus,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
    price: Money.create(200),
    startedAt,
    completedAt,
  });

  serviceTaskRepository.tasks.set(serviceTaskId, serviceTask);

  const workOrder = WorkOrder.rehydrate({
    id: workOrderId,
    vehicleId: 10,
    status,
    totalAmount: Money.create(200),
    publicToken: "public-token",
    publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
    createdAt: new Date("2024-01-10T08:00:00.000Z"),
    updatedAt: new Date("2024-01-10T08:00:00.000Z"),
    serviceTasks: [
      {
        serviceTaskId,
        status: serviceTaskStatus,
        amount: Money.create(200),
      },
    ],
  });

  workOrderRepository.items.set(workOrderId, workOrder);

  const addServiceTask = new AddServiceTask(
    serviceTaskRepository,
    serviceRepository,
    workOrderRepository,
    stockItemRepository,
  );
  const approveServiceTask = new ApproveServiceTask(serviceTaskRepository, workOrderRepository);
  const rejectServiceTask = new RejectServiceTask(serviceTaskRepository, workOrderRepository);
  const startServiceExecution = new StartServiceExecution(
    serviceTaskRepository,
    serviceRepository,
    stockItemRepository,
    workOrderRepository,
  );
  const completeServiceTask = new CompleteServiceTask(serviceTaskRepository, workOrderRepository);
  const getServiceTaskById = new GetServiceTaskById(serviceTaskRepository);
  const listServiceTasks = new ListServiceTasks(serviceTaskRepository);

  const app = new Hono();
  registerServiceTaskRoutes(app, {
    addServiceTask,
    approveServiceTask,
    rejectServiceTask,
    startServiceExecution,
    completeServiceTask,
    getServiceTaskById,
    listServiceTasks,
  });

  return { app, serviceTaskId, workOrderRepository };
}

function createPublicApp(params?: { expiresAt?: Date }) {
  const serviceRepository = new InMemoryServiceRepository();
  const serviceTaskRepository = new InMemoryServiceTaskRepository();
  const stockItemRepository = new InMemoryStockItemRepository();
  const workOrderRepository = new InMemoryWorkOrderRepository();

  serviceRepository.services.set(1, buildService());
  stockItemRepository.items.set(1, buildStockItem(10));

  const workOrderId = 1;
  const serviceTaskId = 1;
  const token = "public-token";

  const serviceTask = ServiceTask.rehydrate({
    id: serviceTaskId,
    serviceId: 1,
    workOrderId,
    status: ServiceTaskStatus.PENDING_APPROVAL,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
    price: Money.create(200),
    startedAt: null,
    completedAt: null,
  });

  serviceTaskRepository.tasks.set(serviceTaskId, serviceTask);

  const workOrder = WorkOrder.rehydrate({
    id: workOrderId,
    vehicleId: 10,
    status: WorkOrderStatus.WAITING_APPROVAL,
    totalAmount: Money.create(200),
    publicToken: token,
    publicTokenExpiresAt: params?.expiresAt ?? new Date("2099-01-10T12:00:00.000Z"),
    createdAt: new Date("2024-01-10T08:00:00.000Z"),
    updatedAt: new Date("2024-01-10T08:00:00.000Z"),
    serviceTasks: [
      {
        serviceTaskId,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: Money.create(200),
      },
    ],
  });

  workOrderRepository.items.set(workOrderId, workOrder);

  const addServiceTask = new AddServiceTask(
    serviceTaskRepository,
    serviceRepository,
    workOrderRepository,
    stockItemRepository,
  );
  const approveServiceTask = new ApproveServiceTask(serviceTaskRepository);
  const rejectServiceTask = new RejectServiceTask(serviceTaskRepository);
  const startServiceExecution = new StartServiceExecution(
    serviceTaskRepository,
    serviceRepository,
    stockItemRepository,
  );
  const completeServiceTask = new CompleteServiceTask(serviceTaskRepository, workOrderRepository);
  const getServiceTaskById = new GetServiceTaskById(serviceTaskRepository);
  const listServiceTasks = new ListServiceTasks(serviceTaskRepository);
  const approveServiceTaskByPublicToken = new ApproveServiceTaskByPublicToken(
    serviceTaskRepository,
    workOrderRepository,
  );
  const rejectServiceTaskByPublicToken = new RejectServiceTaskByPublicToken(
    serviceTaskRepository,
    workOrderRepository,
  );

  const app = new Hono();
  registerServiceTaskRoutes(app, {
    addServiceTask,
    approveServiceTask,
    approveServiceTaskByPublicToken,
    rejectServiceTask,
    rejectServiceTaskByPublicToken,
    startServiceExecution,
    completeServiceTask,
    getServiceTaskById,
    listServiceTasks,
  });

  return { app, serviceTaskId, token };
}

describe("Service Task routes", () => {
  it("creates a service task", async () => {
    const app = createApp();

    const response = await app.request("/service-tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: 1,
        workOrderId: 1,
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body).toMatchObject({
      serviceId: 1,
      status: ServiceTaskStatus.PENDING_APPROVAL,
      // 200 (service) + 2 * 25 (stock item) = 250
      price: 250,
    });
  });

  it("returns 409 when creating a service task for work order not in diagnosis", async () => {
    const { app } = createAppWithWorkOrderStatus(WorkOrderStatus.RECEIVED);

    const response = await app.request("/service-tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: 1,
        workOrderId: 1,
      }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    // eslint-disable-next-line no-secrets/no-secrets
    expect(body.error).toBe("WorkOrderServiceTaskCreationNotAllowed");
  });

  it("returns 404 when the service does not exist", async () => {
    const app = createApp();

    const response = await app.request("/service-tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: 999,
        workOrderId: 1,
      }),
    });

    expect(response.status).toBe(404);
  });

  it("lists service tasks", async () => {
    const app = createApp();

    await app.request("/service-tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: 1,
        workOrderId: 1,
      }),
    });

    const response = await app.request("/service-tasks", { method: "GET" });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
  });

  it("approves a service task", async () => {
    const app = createApp();

    const created = await app.request("/service-tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: 1,
        workOrderId: 1,
      }),
    });

    const createdBody = await created.json();

    const response = await app.request(`/service-tasks/${createdBody.id}/approve`, {
      method: "POST",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe(ServiceTaskStatus.APPROVED);
  });

  it("returns 409 when approving before work order is waiting approval", async () => {
    const { app, serviceTaskId } = createAppWithWorkOrderStatus(WorkOrderStatus.DIAGNOSIS);

    const response = await app.request(`/service-tasks/${serviceTaskId}/approve`, {
      method: "POST",
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    // eslint-disable-next-line no-secrets/no-secrets
    expect(body.error).toBe("WorkOrderStatusTransitionNotAllowed");
  });

  it("returns 409 when rejecting before work order is waiting approval", async () => {
    const { app, serviceTaskId } = createAppWithWorkOrderStatus(WorkOrderStatus.RECEIVED);

    const response = await app.request(`/service-tasks/${serviceTaskId}/reject`, {
      method: "POST",
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    // eslint-disable-next-line no-secrets/no-secrets
    expect(body.error).toBe("WorkOrderStatusTransitionNotAllowed");
  });

  it("approves a service task via public token", async () => {
    const { app, serviceTaskId, token } = createPublicApp();

    const response = await app.request(
      `/public/work-orders/${token}/service-tasks/${serviceTaskId}/approve`,
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe(ServiceTaskStatus.APPROVED);
  });

  it("rejects a service task via public token", async () => {
    const { app, serviceTaskId, token } = createPublicApp();

    const response = await app.request(
      `/public/work-orders/${token}/service-tasks/${serviceTaskId}/reject`,
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe(ServiceTaskStatus.REJECTED);
  });

  it("returns 401 when the public token is expired", async () => {
    const { app, serviceTaskId, token } = createPublicApp({
      expiresAt: new Date("2020-01-10T12:00:00.000Z"),
    });

    const response = await app.request(
      `/public/work-orders/${token}/service-tasks/${serviceTaskId}/approve`,
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(401);
  });

  it("starts execution and consumes stock", async () => {
    const { app, serviceTaskId } = createAppWithWorkOrderStatus(WorkOrderStatus.READY, {
      serviceTaskStatus: ServiceTaskStatus.APPROVED,
      stockQuantity: 5,
    });

    const response = await app.request(`/service-tasks/${serviceTaskId}/start-execution`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe(ServiceTaskStatus.IN_EXECUTION);
  });

  it("returns 409 when work order is not READY", async () => {
    const { app, serviceTaskId } = createAppWithWorkOrderStatus(WorkOrderStatus.RECEIVED, {
      serviceTaskStatus: ServiceTaskStatus.APPROVED,
    });

    const response = await app.request(`/service-tasks/${serviceTaskId}/start-execution`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    // eslint-disable-next-line no-secrets/no-secrets
    expect(body.error).toBe("WorkOrderStatusTransitionNotAllowed");
  });

  it("returns 409 when stock is insufficient", async () => {
    const { app, serviceTaskId } = createAppWithWorkOrderStatus(WorkOrderStatus.READY, {
      serviceTaskStatus: ServiceTaskStatus.APPROVED,
      stockQuantity: 1,
    });

    const response = await app.request(`/service-tasks/${serviceTaskId}/start-execution`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(409);
  });

  it("completes a service task and auto-finalizes the work order", async () => {
    const { app, serviceTaskId, workOrderRepository } = createAppWithWorkOrderStatus(
      WorkOrderStatus.IN_EXECUTION,
      { serviceTaskStatus: ServiceTaskStatus.IN_EXECUTION },
    );

    const response = await app.request(`/service-tasks/${serviceTaskId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe(ServiceTaskStatus.COMPLETED);
    expect(workOrderRepository.items.get(1)?.toSnapshot().status).toBe(WorkOrderStatus.FINALIZED);
  });

  it("returns 404 when the owning work order cannot be loaded", async () => {
    const app = new Hono();

    registerServiceTaskRoutes(app, {
      addServiceTask: {} as AddServiceTask,
      approveServiceTask: {} as ApproveServiceTask,
      rejectServiceTask: {} as RejectServiceTask,
      startServiceExecution: {} as StartServiceExecution,
      completeServiceTask: {
        async execute() {
          throw new WorkOrderNotFound(1);
        },
      } as unknown as CompleteServiceTask,
      getServiceTaskById: {} as GetServiceTaskById,
      listServiceTasks: {} as ListServiceTasks,
    });

    const response = await app.request("/service-tasks/1/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("WorkOrderNotFound");
  });

  it("returns 409 when the work order transition is not allowed", async () => {
    const app = new Hono();

    registerServiceTaskRoutes(app, {
      addServiceTask: {} as AddServiceTask,
      approveServiceTask: {} as ApproveServiceTask,
      rejectServiceTask: {} as RejectServiceTask,
      startServiceExecution: {} as StartServiceExecution,
      completeServiceTask: {
        async execute() {
          throw new WorkOrderStatusTransitionNotAllowed({
            from: WorkOrderStatus.IN_EXECUTION,
            to: WorkOrderStatus.FINALIZED,
          });
        },
      } as unknown as CompleteServiceTask,
      getServiceTaskById: {} as GetServiceTaskById,
      listServiceTasks: {} as ListServiceTasks,
    });

    const response = await app.request("/service-tasks/1/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    // eslint-disable-next-line no-secrets/no-secrets
    expect(body.error).toBe("WorkOrderStatusTransitionNotAllowed");
  });

  it("returns 400 when id param is invalid", async () => {
    const app = createApp();

    const response = await app.request("/service-tasks/invalid", {
      method: "GET",
    });

    expect(response.status).toBe(400);
  });

  it("returns 500 when an unexpected error is thrown", async () => {
    const app = new Hono();

    registerServiceTaskRoutes(app, {
      addServiceTask: {
        async execute() {
          throw new Error("boom");
        },
      } as unknown as AddServiceTask,
      approveServiceTask: {} as ApproveServiceTask,
      rejectServiceTask: {} as RejectServiceTask,
      startServiceExecution: {} as StartServiceExecution,
      completeServiceTask: {} as unknown as CompleteServiceTask,
      getServiceTaskById: {} as GetServiceTaskById,
      listServiceTasks: {} as ListServiceTasks,
    });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await app.request("/service-tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: 1,
        workOrderId: 1,
      }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: "UnexpectedError",
      message: "boom",
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  describe("authentication", () => {
    beforeAll(() => {
      process.env.JWT_SECRET = "test-secret";
    });

    it("returns 401 when Authorization header is missing", async () => {
      const app = createAppWithAuth();

      const response = await app.request("/service-tasks", {
        method: "GET",
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 when token is invalid", async () => {
      const app = createAppWithAuth();

      const response = await app.request("/service-tasks", {
        method: "GET",
        headers: { Authorization: "Bearer invalid-token" },
      });

      expect(response.status).toBe(401);
    });
    it("allows access with a valid token", async () => {
      const app = createAppWithAuth();
      const token = signToken({ sub: "admin" });

      const response = await app.request("/service-tasks", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
    });
  });
});
