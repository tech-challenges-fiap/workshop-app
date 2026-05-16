import { describe, expect, it } from "bun:test";

import { StartServiceExecution } from "./start-service-execution";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import { Service } from "../../domain/service/aggregate/service";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceStockItemsRequired } from "../../domain/service/value-object/service-stock-item-reference";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemSku } from "../../domain/stock-item/value-object/stock-item-sku";
import { StockItemName } from "../../domain/stock-item/value-object/stock-item-name";
import { StockItemQuantity } from "../../domain/stock-item/value-object/stock-item-quantity";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { Money } from "../../domain/shared/value-object/money";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";
import { WorkOrderStatusTransitionNotAllowed } from "../../domain/work-order/domain-error/work-order-status-transition-not-allowed";

class InMemoryServiceTaskRepository implements ServiceTaskRepository {
  private nextId = 1;
  public items = new Map<number, ServiceTask>();

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

    this.items.set(id, created);
    return created;
  }

  public async findById(id: number): Promise<ServiceTask | null> {
    return this.items.get(id) ?? null;
  }

  public async findByServiceId(serviceId: number): Promise<ServiceTask[]> {
    return [...this.items.values()].filter((task) => task.toSnapshot().serviceId === serviceId);
  }

  public async findAll(): Promise<ServiceTask[]> {
    return [...this.items.values()];
  }

  public async save(serviceTask: ServiceTask): Promise<void> {
    const snapshot = serviceTask.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Service task must have an id to be saved");
    }
    this.items.set(snapshot.id, serviceTask);
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
    void id;
  }
}

class InMemoryServiceRepository implements ServiceRepository {
  public items = new Map<number, Service>();

  public async create(service: Service): Promise<Service> {
    const snapshot = service.toSnapshot();
    const id = snapshot.id ?? this.items.size + 1;
    const created = Service.rehydrate({
      id,
      name: ServiceName.create(snapshot.name),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(snapshot.estimatedTime),
      price: Money.create(snapshot.price),
      requiredItems: snapshot.requiredItems.map((item) =>
        ServiceStockItemsRequired.create({
          stockItemId: item.stockItemId,
          quantity: item.quantity,
        }),
      ),
    });
    this.items.set(id, created);
    return created;
  }

  public async findById(id: number): Promise<Service | null> {
    return this.items.get(id) ?? null;
  }

  public async findAll(): Promise<Service[]> {
    return [...this.items.values()];
  }

  public async save(service: Service): Promise<void> {
    const snapshot = service.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Service must have an id to be saved");
    }
    this.items.set(snapshot.id, service);
  }

  public async delete(id: number): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryWorkOrderRepository implements WorkOrderRepository {
  private nextId = 1;
  public items = new Map<number, WorkOrder>();

  public async create(workOrder: WorkOrder): Promise<WorkOrder> {
    const snapshot = workOrder.toSnapshot();
    const id = snapshot.id ?? this.nextId++;
    if (snapshot.id !== null && snapshot.id >= this.nextId) {
      this.nextId = snapshot.id + 1;
    }
    const created = WorkOrder.rehydrate({
      id,
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
    this.items.set(id, created);
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

function buildServiceTask(): ServiceTask {
  const task = ServiceTask.create({
    serviceId: 1,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(45),
    price: Money.create(150),
    workOrderId: 1,
  });

  task.approve();

  return task;
}

function buildStockItem(params: {
  id: number;
  sku: string;
  name: string;
  quantity: number;
}): StockItem {
  return StockItem.rehydrate({
    id: params.id,
    sku: StockItemSku.create(params.sku),
    name: StockItemName.create(params.name),
    description: null,
    unitOfMeasure: null,
    quantity: StockItemQuantity.create(params.quantity),
    price: Money.create(25),
  });
}

describe("StartServiceExecution", () => {
  it("starts execution and consumes stock items", async () => {
    const taskRepository = new InMemoryServiceTaskRepository();
    const stockRepository = new InMemoryStockItemRepository();
    const serviceRepository = new InMemoryServiceRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    stockRepository.items.set(
      1,
      buildStockItem({ id: 1, sku: "SKU-1", name: "Brake Pad", quantity: 5 }),
    );

    const created = await taskRepository.create(buildServiceTask());
    const workOrderSnapshotId = created.toSnapshot().id ?? 0;
    const workOrder = WorkOrder.rehydrate({
      id: 1,
      vehicleId: 1,
      status: WorkOrderStatus.READY,
      totalAmount: Money.create(150),
      publicToken: "token-1",
      publicTokenExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      serviceTasks: [
        {
          serviceTaskId: workOrderSnapshotId,
          status: ServiceTaskStatus.APPROVED,
          amount: Money.create(150),
        },
      ],
    });
    await workOrderRepository.create(workOrder);
    await serviceRepository.create(
      Service.rehydrate({
        id: 1,
        name: ServiceName.create("Brake Service"),
        estimatedTime: ServiceEstimatedTime.createFromMinutes(45),
        price: Money.create(150),
        requiredItems: [ServiceStockItemsRequired.create({ stockItemId: 1, quantity: 2 })],
      }),
    );
    const id = created.toSnapshot().id ?? 0;

    const useCase = new StartServiceExecution(
      taskRepository,
      serviceRepository,
      stockRepository,
      workOrderRepository,
    );
    const startedAt = new Date("2024-02-01T10:00:00.000Z");

    const result = await useCase.execute({ id, startedAt });

    expect(result.status).toBe(ServiceTaskStatus.IN_EXECUTION);
    expect(result.startedAt).toBe(startedAt.toISOString());

    const updatedStock = stockRepository.items.get(1);
    expect(updatedStock?.toSnapshot().quantity).toBe(3);

    const updatedWorkOrder = await workOrderRepository.findById(1);
    expect(updatedWorkOrder?.toSnapshot().status).toBe(WorkOrderStatus.IN_EXECUTION);
  });

  it("throws when a required stock item does not exist", async () => {
    const taskRepository = new InMemoryServiceTaskRepository();
    const stockRepository = new InMemoryStockItemRepository();
    const serviceRepository = new InMemoryServiceRepository();
    const created = await taskRepository.create(buildServiceTask());
    const id = created.toSnapshot().id ?? 0;

    await serviceRepository.create(
      Service.rehydrate({
        id: 1,
        name: ServiceName.create("Brake Service"),
        estimatedTime: ServiceEstimatedTime.createFromMinutes(45),
        price: Money.create(150),
        requiredItems: [ServiceStockItemsRequired.create({ stockItemId: 1, quantity: 2 })],
      }),
    );

    const useCase = new StartServiceExecution(taskRepository, serviceRepository, stockRepository);

    expect(useCase.execute({ id })).rejects.toBeInstanceOf(StockItemNotFound);
  });

  it("throws when the task does not exist", async () => {
    const taskRepository = new InMemoryServiceTaskRepository();
    const stockRepository = new InMemoryStockItemRepository();
    const serviceRepository = new InMemoryServiceRepository();
    const useCase = new StartServiceExecution(taskRepository, serviceRepository, stockRepository);

    expect(useCase.execute({ id: 999 })).rejects.toBeInstanceOf(ServiceTaskNotFound);
  });

  it("throws when work order is not READY", async () => {
    const taskRepository = new InMemoryServiceTaskRepository();
    const stockRepository = new InMemoryStockItemRepository();
    const serviceRepository = new InMemoryServiceRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();

    stockRepository.items.set(
      1,
      buildStockItem({ id: 1, sku: "SKU-1", name: "Brake Pad", quantity: 5 }),
    );

    const created = await taskRepository.create(buildServiceTask());
    const taskId = created.toSnapshot().id ?? 0;

    await workOrderRepository.create(
      WorkOrder.rehydrate({
        id: 1,
        vehicleId: 1,
        status: WorkOrderStatus.WAITING_APPROVAL,
        totalAmount: Money.create(150),
        publicToken: "token-1",
        publicTokenExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        serviceTasks: [
          {
            serviceTaskId: taskId,
            status: ServiceTaskStatus.APPROVED,
            amount: Money.create(150),
          },
        ],
      }),
    );

    await serviceRepository.create(
      Service.rehydrate({
        id: 1,
        name: ServiceName.create("Brake Service"),
        estimatedTime: ServiceEstimatedTime.createFromMinutes(45),
        price: Money.create(150),
        requiredItems: [ServiceStockItemsRequired.create({ stockItemId: 1, quantity: 2 })],
      }),
    );

    const useCase = new StartServiceExecution(
      taskRepository,
      serviceRepository,
      stockRepository,
      workOrderRepository,
    );

    expect(useCase.execute({ id: taskId })).rejects.toBeInstanceOf(
      WorkOrderStatusTransitionNotAllowed,
    );
  });
});
