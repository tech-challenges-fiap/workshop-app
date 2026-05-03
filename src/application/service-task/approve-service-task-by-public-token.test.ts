import { describe, expect, it } from "bun:test";

import { ApproveServiceTaskByPublicToken } from "./approve-service-task-by-public-token";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import { Money } from "../../domain/shared/value-object/money";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";
import { WorkOrderPublicTokenNotFound } from "../../domain/work-order/domain-error/work-order-public-token-not-found";
import { WorkOrderPublicTokenExpired } from "../../domain/work-order/domain-error/work-order-public-token-expired";
import { WorkOrderServiceTaskNotFound } from "../../domain/work-order/domain-error/work-order-service-task-not-found";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";

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

function buildServiceTask(params?: { workOrderId?: number }): ServiceTask {
  return ServiceTask.create({
    serviceId: 1,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
    price: Money.create(150),
    workOrderId: params?.workOrderId ?? 1,
  });
}

function buildWorkOrder(params: { serviceTaskId: number; publicToken: string; expiresAt: Date }) {
  const workOrder = WorkOrder.create({
    vehicleId: 1,
    publicToken: params.publicToken,
    publicTokenExpiresAt: params.expiresAt,
    serviceTasks: [
      {
        serviceTaskId: params.serviceTaskId,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: Money.create(150),
      },
    ],
    createdAt: new Date("2024-01-10T08:00:00.000Z"),
  });

  workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
  workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

  return workOrder;
}

// eslint-disable-next-line no-secrets/no-secrets
describe("ApproveServiceTaskByPublicToken", () => {
  it("approves a pending task for a valid public token", async () => {
    const serviceTaskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const createdTask = await serviceTaskRepository.create(buildServiceTask());
    const serviceTaskId = createdTask.toSnapshot().id ?? 0;

    const workOrder = buildWorkOrder({
      serviceTaskId,
      publicToken: "public-token",
      expiresAt: new Date("2099-01-10T12:00:00.000Z"),
    });
    const createdWorkOrder = await workOrderRepository.create(workOrder);
    const workOrderId = createdWorkOrder.toSnapshot().id ?? 0;

    const useCase = new ApproveServiceTaskByPublicToken(serviceTaskRepository, workOrderRepository);

    const result = await useCase.execute({
      publicToken: "public-token",
      serviceTaskId,
    });

    expect(result.status).toBe(ServiceTaskStatus.APPROVED);

    const updated = await workOrderRepository.findById(workOrderId);
    expect(updated?.toSnapshot().status).toBe(WorkOrderStatus.READY);
  });

  it("throws when the public token does not exist", async () => {
    const serviceTaskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const useCase = new ApproveServiceTaskByPublicToken(serviceTaskRepository, workOrderRepository);

    expect(
      useCase.execute({ publicToken: "missing-token", serviceTaskId: 1 }),
    ).rejects.toBeInstanceOf(WorkOrderPublicTokenNotFound);
  });

  it("throws when the public token is expired", async () => {
    const serviceTaskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const createdTask = await serviceTaskRepository.create(buildServiceTask());
    const serviceTaskId = createdTask.toSnapshot().id ?? 0;

    const workOrder = buildWorkOrder({
      serviceTaskId,
      publicToken: "expired-token",
      expiresAt: new Date("2020-01-10T12:00:00.000Z"),
    });
    await workOrderRepository.create(workOrder);

    const useCase = new ApproveServiceTaskByPublicToken(serviceTaskRepository, workOrderRepository);

    expect(useCase.execute({ publicToken: "expired-token", serviceTaskId })).rejects.toBeInstanceOf(
      WorkOrderPublicTokenExpired,
    );
  });

  it("throws when the service task does not exist", async () => {
    const serviceTaskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const workOrder = buildWorkOrder({
      serviceTaskId: 1,
      publicToken: "public-token",
      expiresAt: new Date("2099-01-10T12:00:00.000Z"),
    });
    await workOrderRepository.create(workOrder);

    const useCase = new ApproveServiceTaskByPublicToken(serviceTaskRepository, workOrderRepository);

    expect(
      useCase.execute({ publicToken: "public-token", serviceTaskId: 999 }),
    ).rejects.toBeInstanceOf(ServiceTaskNotFound);
  });

  it("throws when the service task is not tied to the public token's work order", async () => {
    const serviceTaskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();

    const taskForFirstOrder = await serviceTaskRepository.create(
      buildServiceTask({ workOrderId: 1 }),
    );
    const taskForSecondOrder = await serviceTaskRepository.create(
      buildServiceTask({ workOrderId: 2 }),
    );
    const firstTaskId = taskForFirstOrder.toSnapshot().id ?? 0;
    const secondTaskId = taskForSecondOrder.toSnapshot().id ?? 0;

    const firstWorkOrder = buildWorkOrder({
      serviceTaskId: firstTaskId,
      publicToken: "token-1",
      expiresAt: new Date("2099-01-10T12:00:00.000Z"),
    });
    const secondWorkOrder = buildWorkOrder({
      serviceTaskId: secondTaskId,
      publicToken: "token-2",
      expiresAt: new Date("2099-01-10T12:00:00.000Z"),
    });

    await workOrderRepository.create(firstWorkOrder);
    await workOrderRepository.create(secondWorkOrder);

    const useCase = new ApproveServiceTaskByPublicToken(serviceTaskRepository, workOrderRepository);

    expect(
      useCase.execute({ publicToken: "token-2", serviceTaskId: firstTaskId }),
    ).rejects.toBeInstanceOf(WorkOrderServiceTaskNotFound);
  });
});
