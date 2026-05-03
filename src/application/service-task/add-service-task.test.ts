import { describe, expect, it } from "bun:test";

import { AddServiceTask } from "./add-service-task";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { Service } from "../../domain/service/aggregate/service";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceStockItemsRequired } from "../../domain/service/value-object/service-stock-item-reference";
import { ServiceNotFound } from "../../domain/service/domain-error/service-not-found";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { Money } from "../../domain/shared/value-object/money";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemSku } from "../../domain/stock-item/value-object/stock-item-sku";
import { StockItemName } from "../../domain/stock-item/value-object/stock-item-name";
import { StockItemQuantity } from "../../domain/stock-item/value-object/stock-item-quantity";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";
import { WorkOrderServiceTaskCreationNotAllowed } from "../../domain/work-order/domain-error/work-order-service-task-creation-not-allowed";

class InMemoryServiceRepository implements ServiceRepository {
  public service: Service | null = null;

  public async create(service: Service): Promise<Service> {
    this.service = service;
    return service;
  }

  public async findById(id: number): Promise<Service | null> {
    if (!this.service) return null;
    const snapshot = this.service.toSnapshot();
    return snapshot.id === id ? this.service : null;
  }

  public async findAll(): Promise<Service[]> {
    return this.service ? [this.service] : [];
  }

  public async save(service: Service): Promise<void> {
    this.service = service;
  }

  public async delete(id: number): Promise<void> {
    void id;
  }
}

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

  public async findAll(): Promise<ServiceTask[]> {
    return [...this.items.values()];
  }

  public async findByServiceId(serviceId: number): Promise<ServiceTask[]> {
    return [...this.items.values()].filter((serviceTask) => {
      const snapshot = serviceTask.toSnapshot();
      return snapshot.serviceId === serviceId;
    });
  }

  public async save(serviceTask: ServiceTask): Promise<void> {
    const snapshot = serviceTask.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Service task must have an id to be saved");
    }
    this.items.set(snapshot.id, serviceTask);
  }
}

class InMemoryWorkOrderRepository implements WorkOrderRepository {
  public workOrder: WorkOrder | null = null;

  public async create(workOrder: WorkOrder): Promise<WorkOrder> {
    this.workOrder = workOrder;
    return workOrder;
  }

  public async findById(id: number): Promise<WorkOrder | null> {
    if (!this.workOrder) return null;
    const snapshot = this.workOrder.toSnapshot();
    return snapshot.id === id ? this.workOrder : null;
  }

  public async findByPublicToken(): Promise<WorkOrder | null> {
    return this.workOrder;
  }

  public async findAll(): Promise<WorkOrder[]> {
    return this.workOrder ? [this.workOrder] : [];
  }

  public async listOperationalQueue(): Promise<WorkOrder[]> {
    return this.findAll();
  }

  public async save(workOrder: WorkOrder): Promise<void> {
    this.workOrder = workOrder;
  }
}

class InMemoryStockItemRepository implements StockItemRepository {
  public stockItem: StockItem | null = null;

  public async create(stockItem: StockItem): Promise<StockItem> {
    this.stockItem = stockItem;
    return stockItem;
  }

  public async findById(id: number): Promise<StockItem | null> {
    if (!this.stockItem) return null;
    const snapshot = this.stockItem.toSnapshot();
    return snapshot.id === id ? this.stockItem : null;
  }

  public async findAll(): Promise<StockItem[]> {
    return this.stockItem ? [this.stockItem] : [];
  }

  public async save(stockItem: StockItem): Promise<void> {
    this.stockItem = stockItem;
  }

  public async delete(id: number): Promise<void> {
    void id;
  }
}

describe("AddServiceTask", () => {
  it("creates a service task based on the service catalog data", async () => {
    const serviceRepository = new InMemoryServiceRepository();
    const taskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const stockItemRepository = new InMemoryStockItemRepository();

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

    await workOrderRepository.create(workOrder);

    const stockItem = StockItem.rehydrate({
      id: 10,
      sku: StockItemSku.create("SKU-10"),
      name: StockItemName.create("Brake pad"),
      description: null,
      unitOfMeasure: null,
      quantity: StockItemQuantity.create(100),
      price: Money.create(50),
    });

    await stockItemRepository.create(stockItem);

    const service = Service.rehydrate({
      id: 5,
      name: ServiceName.create("Brake inspection"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(90),
      price: Money.create(250),
      requiredItems: [
        ServiceStockItemsRequired.create({
          stockItemId: 10,
          quantity: 2,
        }),
      ],
    });

    serviceRepository.service = service;

    const useCase = new AddServiceTask(
      taskRepository,
      serviceRepository,
      workOrderRepository,
      stockItemRepository,
    );

    const result = await useCase.execute({
      serviceId: 5,
      workOrderId: 1,
    });

    expect(result.id).not.toBeNull();
    expect(result).toMatchObject({
      serviceId: 5,
      status: ServiceTaskStatus.PENDING_APPROVAL,
      estimatedTime: 90,
      // 250 (service) + 2 * 50 (stock item) = 350
      price: 350,
    });

    const updatedWorkOrder = workOrderRepository.workOrder;
    expect(updatedWorkOrder).not.toBeNull();
    const workOrderSnapshot = updatedWorkOrder?.toSnapshot();
    expect(workOrderSnapshot?.totalAmount).toBe(350);
  });

  it("throws when the service does not exist", async () => {
    const serviceRepository = new InMemoryServiceRepository();
    const taskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const stockItemRepository = new InMemoryStockItemRepository();

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

    await workOrderRepository.create(workOrder);

    const useCase = new AddServiceTask(
      taskRepository,
      serviceRepository,
      workOrderRepository,
      stockItemRepository,
    );

    expect(
      useCase.execute({
        serviceId: 999,
        workOrderId: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceNotFound);
  });

  it("throws when the work order does not exist", async () => {
    const serviceRepository = new InMemoryServiceRepository();
    const taskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const stockItemRepository = new InMemoryStockItemRepository();

    const service = Service.rehydrate({
      id: 5,
      name: ServiceName.create("Brake inspection"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(90),
      price: Money.create(250),
      requiredItems: [
        ServiceStockItemsRequired.create({
          stockItemId: 10,
          quantity: 2,
        }),
      ],
    });

    serviceRepository.service = service;

    const useCase = new AddServiceTask(
      taskRepository,
      serviceRepository,
      workOrderRepository,
      stockItemRepository,
    );

    expect(
      useCase.execute({
        serviceId: 5,
        workOrderId: 999,
      }),
    ).rejects.toBeInstanceOf(WorkOrderNotFound);
  });

  it("throws when a required stock item does not exist", async () => {
    const serviceRepository = new InMemoryServiceRepository();
    const taskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const stockItemRepository = new InMemoryStockItemRepository();

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

    await workOrderRepository.create(workOrder);

    const service = Service.rehydrate({
      id: 5,
      name: ServiceName.create("Brake inspection"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(90),
      price: Money.create(250),
      requiredItems: [
        ServiceStockItemsRequired.create({
          stockItemId: 999,
          quantity: 1,
        }),
      ],
    });

    serviceRepository.service = service;

    const useCase = new AddServiceTask(
      taskRepository,
      serviceRepository,
      workOrderRepository,
      stockItemRepository,
    );

    expect(
      useCase.execute({
        serviceId: 5,
        workOrderId: 1,
      }),
    ).rejects.toBeInstanceOf(StockItemNotFound);
  });

  it("throws when the work order is not in diagnosis", async () => {
    const serviceRepository = new InMemoryServiceRepository();
    const taskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const stockItemRepository = new InMemoryStockItemRepository();

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

    await workOrderRepository.create(workOrder);

    const stockItem = StockItem.rehydrate({
      id: 10,
      sku: StockItemSku.create("SKU-10"),
      name: StockItemName.create("Brake pad"),
      description: null,
      unitOfMeasure: null,
      quantity: StockItemQuantity.create(100),
      price: Money.create(50),
    });

    await stockItemRepository.create(stockItem);

    const service = Service.rehydrate({
      id: 5,
      name: ServiceName.create("Brake inspection"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(90),
      price: Money.create(250),
      requiredItems: [
        ServiceStockItemsRequired.create({
          stockItemId: 10,
          quantity: 2,
        }),
      ],
    });

    serviceRepository.service = service;

    const useCase = new AddServiceTask(
      taskRepository,
      serviceRepository,
      workOrderRepository,
      stockItemRepository,
    );

    expect(
      useCase.execute({
        serviceId: 5,
        workOrderId: 1,
      }),
    ).rejects.toBeInstanceOf(WorkOrderServiceTaskCreationNotAllowed);
  });

  it("throws when created service task snapshot has null id", async () => {
    class NullIdServiceTaskRepository implements ServiceTaskRepository {
      public async create(serviceTask: ServiceTask): Promise<ServiceTask> {
        return serviceTask;
      }

      public async findById(): Promise<ServiceTask | null> {
        return null;
      }

      public async findByServiceId(): Promise<ServiceTask[]> {
        return [];
      }

      public async findAll(): Promise<ServiceTask[]> {
        return [];
      }

      public async save(): Promise<void> {}
    }

    const serviceRepository = new InMemoryServiceRepository();
    const taskRepository = new NullIdServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const stockItemRepository = new InMemoryStockItemRepository();

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

    await workOrderRepository.create(workOrder);

    const stockItem = StockItem.rehydrate({
      id: 10,
      sku: StockItemSku.create("SKU-10"),
      name: StockItemName.create("Brake pad"),
      description: null,
      unitOfMeasure: null,
      quantity: StockItemQuantity.create(100),
      price: Money.create(50),
    });

    await stockItemRepository.create(stockItem);

    const service = Service.rehydrate({
      id: 5,
      name: ServiceName.create("Brake inspection"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(90),
      price: Money.create(250),
      requiredItems: [
        ServiceStockItemsRequired.create({
          stockItemId: 10,
          quantity: 2,
        }),
      ],
    });

    serviceRepository.service = service;

    const useCase = new AddServiceTask(
      taskRepository,
      serviceRepository,
      workOrderRepository,
      stockItemRepository,
    );

    expect(
      useCase.execute({
        serviceId: 5,
        workOrderId: 1,
      }),
    ).rejects.toThrowError("Service task must have an id after creation");
  });
});
