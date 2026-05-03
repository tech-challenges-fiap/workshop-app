import { describe, expect, it } from "bun:test";

import { DeliverVehicle } from "./deliver-vehicle";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { Money } from "../../domain/shared/value-object/money";

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

function buildWorkOrderServiceTask(params: {
  id: number;
  status: ServiceTaskStatus;
  amount: number;
}) {
  return {
    serviceTaskId: params.id,
    status: params.status,
    amount: Money.create(params.amount),
  };
}

describe("DeliverVehicle", () => {
  it("delivers a finalized work order", async () => {
    const repository = new InMemoryWorkOrderRepository();
    const serviceTasks = [
      buildWorkOrderServiceTask({
        id: 1,
        status: ServiceTaskStatus.APPROVED,
        amount: 200,
      }),
      buildWorkOrderServiceTask({
        id: 2,
        status: ServiceTaskStatus.APPROVED,
        amount: 100,
      }),
    ];

    const workOrder = WorkOrder.create({
      vehicleId: 10,
      publicToken: "public-token",
      publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
      serviceTasks,
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));
    workOrder.startExecution(new Date("2024-01-10T09:00:00.000Z"));

    serviceTasks[0].status = ServiceTaskStatus.COMPLETED;
    serviceTasks[1].status = ServiceTaskStatus.CANCELED;
    workOrder.syncServiceTasks({
      tasks: serviceTasks,
      now: new Date("2024-01-10T10:00:00.000Z"),
    });

    workOrder.finalize(new Date("2024-01-10T11:00:00.000Z"));

    const created = await repository.create(workOrder);
    const id = created.toSnapshot().id ?? 0;
    const useCase = new DeliverVehicle(repository);

    const result = await useCase.execute({
      id,
      deliveredAt: new Date("2024-01-10T12:00:00.000Z"),
    });

    expect(result.status).toBe(WorkOrderStatus.DELIVERED);
  });

  it("throws when the work order does not exist", async () => {
    const repository = new InMemoryWorkOrderRepository();
    const useCase = new DeliverVehicle(repository);

    expect(useCase.execute({ id: 999 })).rejects.toBeInstanceOf(WorkOrderNotFound);
  });
});
