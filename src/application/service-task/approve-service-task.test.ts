import { describe, expect, it } from "bun:test";

import { ApproveServiceTask } from "./approve-service-task";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import { Money } from "../../domain/shared/value-object/money";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";
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

class InMemoryWorkOrderRepository implements WorkOrderRepository {
  private nextId = 1;
  public items = new Map<number, WorkOrder>();

  public async create(workOrder: WorkOrder): Promise<WorkOrder> {
    const snapshot = workOrder.toSnapshot();
    const id = this.nextId++;
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
  return ServiceTask.create({
    serviceId: 1,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
    price: Money.create(150),
    workOrderId: 1,
  });
}

describe("ApproveServiceTask", () => {
  it("approves a pending task", async () => {
    const repository = new InMemoryServiceTaskRepository();
    const created = await repository.create(buildServiceTask());
    const id = created.toSnapshot().id ?? 0;
    const useCase = new ApproveServiceTask(repository);

    const result = await useCase.execute({ id });

    expect(result.status).toBe(ServiceTaskStatus.APPROVED);
  });

  it("throws when the task does not exist", async () => {
    const repository = new InMemoryServiceTaskRepository();
    const useCase = new ApproveServiceTask(repository);

    expect(useCase.execute({ id: 999 })).rejects.toBeInstanceOf(ServiceTaskNotFound);
  });

  it("updates work order tasks when work order id is provided", async () => {
    const serviceTaskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const createdTask = await serviceTaskRepository.create(buildServiceTask());
    const serviceTaskId = createdTask.toSnapshot().id ?? 0;

    const workOrder = WorkOrder.create({
      vehicleId: 1,
      publicToken: "public-token",
      publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
      serviceTasks: [
        {
          serviceTaskId,
          status: ServiceTaskStatus.PENDING_APPROVAL,
          amount: Money.create(150),
        },
      ],
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    const createdWorkOrder = await workOrderRepository.create(workOrder);
    const workOrderId = createdWorkOrder.toSnapshot().id ?? 0;

    const useCase = new ApproveServiceTask(serviceTaskRepository, workOrderRepository);

    await useCase.execute({ id: serviceTaskId, workOrderId });

    const updated = await workOrderRepository.findById(workOrderId);
    const updatedTaskStatus = updated?.toSnapshot().serviceTasks[0]?.status;
    expect(updatedTaskStatus).toBe(ServiceTaskStatus.APPROVED);
    expect(updated?.toSnapshot().status).toBe(WorkOrderStatus.READY);
  });

  it("keeps work order waiting approval when another task is pending", async () => {
    const serviceTaskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const firstTask = await serviceTaskRepository.create(buildServiceTask());
    const secondTask = await serviceTaskRepository.create(buildServiceTask());
    const firstTaskId = firstTask.toSnapshot().id ?? 0;
    const secondTaskId = secondTask.toSnapshot().id ?? 0;

    const workOrder = WorkOrder.create({
      vehicleId: 1,
      publicToken: "public-token-pending",
      publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
      serviceTasks: [
        {
          serviceTaskId: firstTaskId,
          status: ServiceTaskStatus.PENDING_APPROVAL,
          amount: Money.create(150),
        },
        {
          serviceTaskId: secondTaskId,
          status: ServiceTaskStatus.PENDING_APPROVAL,
          amount: Money.create(150),
        },
      ],
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    const createdWorkOrder = await workOrderRepository.create(workOrder);
    const workOrderId = createdWorkOrder.toSnapshot().id ?? 0;
    const useCase = new ApproveServiceTask(serviceTaskRepository, workOrderRepository);

    await useCase.execute({ id: firstTaskId, workOrderId });

    const updated = await workOrderRepository.findById(workOrderId);
    expect(updated?.toSnapshot().status).toBe(WorkOrderStatus.WAITING_APPROVAL);
  });

  it("throws when work order is not waiting approval", async () => {
    const serviceTaskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const createdTask = await serviceTaskRepository.create(buildServiceTask());
    const serviceTaskId = createdTask.toSnapshot().id ?? 0;

    const workOrder = WorkOrder.create({
      vehicleId: 1,
      publicToken: "public-token-invalid",
      publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
      serviceTasks: [
        {
          serviceTaskId,
          status: ServiceTaskStatus.PENDING_APPROVAL,
          amount: Money.create(150),
        },
      ],
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));

    const createdWorkOrder = await workOrderRepository.create(workOrder);
    const workOrderId = createdWorkOrder.toSnapshot().id ?? 0;
    const useCase = new ApproveServiceTask(serviceTaskRepository, workOrderRepository);

    expect(useCase.execute({ id: serviceTaskId, workOrderId })).rejects.toBeInstanceOf(
      WorkOrderStatusTransitionNotAllowed,
    );
  });
});
