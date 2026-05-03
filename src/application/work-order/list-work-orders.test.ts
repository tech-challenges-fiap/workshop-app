import { describe, expect, it } from "bun:test";

import { ListWorkOrders } from "./list-work-orders";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";
import { Money } from "../../domain/shared/value-object/money";

const ACTIVE_STATUSES = new Set<WorkOrderStatus>([
  WorkOrderStatus.IN_EXECUTION,
  WorkOrderStatus.WAITING_APPROVAL,
  WorkOrderStatus.DIAGNOSIS,
  WorkOrderStatus.RECEIVED,
]);

const STATUS_PRIORITY: Record<WorkOrderStatus, number> = {
  [WorkOrderStatus.IN_EXECUTION]: 1,
  [WorkOrderStatus.WAITING_APPROVAL]: 2,
  [WorkOrderStatus.DIAGNOSIS]: 3,
  [WorkOrderStatus.RECEIVED]: 4,
  [WorkOrderStatus.READY]: 99,
  [WorkOrderStatus.FINALIZED]: 99,
  [WorkOrderStatus.DELIVERED]: 99,
  [WorkOrderStatus.CANCELED]: 99,
};

function createRehydratedWorkOrder(params: {
  id: number;
  vehicleId: number;
  status: WorkOrderStatus;
  updatedAt: string;
  createdAt?: string;
  publicToken?: string;
}): WorkOrder {
  return WorkOrder.rehydrate({
    id: params.id,
    vehicleId: params.vehicleId,
    status: params.status,
    totalAmount: Money.create(0),
    publicToken: params.publicToken ?? `public-token-${params.id}`,
    publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
    createdAt: new Date(params.createdAt ?? "2024-01-10T08:00:00.000Z"),
    updatedAt: new Date(params.updatedAt),
    serviceTasks: [],
  });
}

class InMemoryWorkOrderRepository implements WorkOrderRepository {
  private nextId = 1;
  public items = new Map<number, WorkOrder>();
  public findAllCalls = 0;
  public listOperationalQueueCalls = 0;

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
      serviceTasks: [],
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
    this.findAllCalls += 1;
    return [...this.items.values()];
  }

  public async listOperationalQueue(): Promise<WorkOrder[]> {
    this.listOperationalQueueCalls += 1;
    return [...this.items.values()]
      .filter((workOrder) => ACTIVE_STATUSES.has(workOrder.toSnapshot().status))
      .sort((left, right) => {
        const leftSnapshot = left.toSnapshot();
        const rightSnapshot = right.toSnapshot();
        const byStatus =
          STATUS_PRIORITY[leftSnapshot.status] - STATUS_PRIORITY[rightSnapshot.status];

        if (byStatus !== 0) {
          return byStatus;
        }

        const byUpdatedAt =
          new Date(leftSnapshot.updatedAt).getTime() - new Date(rightSnapshot.updatedAt).getTime();
        if (byUpdatedAt !== 0) {
          return byUpdatedAt;
        }

        return (leftSnapshot.id ?? 0) - (rightSnapshot.id ?? 0);
      });
  }

  public async save(workOrder: WorkOrder): Promise<void> {
    const snapshot = workOrder.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Work order must have an id to be saved");
    }
    this.items.set(snapshot.id, workOrder);
  }
}

describe("ListWorkOrders", () => {
  it("returns snapshots from the operational queue", async () => {
    const repository = new InMemoryWorkOrderRepository();
    repository.items.set(
      1,
      createRehydratedWorkOrder({
        id: 1,
        vehicleId: 10,
        status: WorkOrderStatus.IN_EXECUTION,
        updatedAt: "2024-01-10T10:00:00.000Z",
      }),
    );
    repository.items.set(
      2,
      createRehydratedWorkOrder({
        id: 2,
        vehicleId: 11,
        status: WorkOrderStatus.FINALIZED,
        updatedAt: "2024-01-10T11:00:00.000Z",
      }),
    );

    const useCase = new ListWorkOrders(repository);
    const result = await useCase.execute();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
    expect(result[0]?.status).toBe(WorkOrderStatus.IN_EXECUTION);
  });

  it("uses listOperationalQueue at the application boundary", async () => {
    const repository = new InMemoryWorkOrderRepository();
    repository.items.set(
      1,
      createRehydratedWorkOrder({
        id: 1,
        vehicleId: 10,
        status: WorkOrderStatus.RECEIVED,
        updatedAt: "2024-01-10T10:00:00.000Z",
      }),
    );

    const useCase = new ListWorkOrders(repository);
    const result = await useCase.execute();

    expect(result).toHaveLength(1);
    expect(repository.findAllCalls).toBe(0);
    expect(repository.listOperationalQueueCalls).toBe(1);
  });

  it("returns active statuses in deterministic operational queue order", async () => {
    const repository = new InMemoryWorkOrderRepository();

    const fixture = [
      createRehydratedWorkOrder({
        id: 10,
        vehicleId: 20,
        status: WorkOrderStatus.FINALIZED,
        updatedAt: "2024-01-10T08:30:00.000Z",
      }),
      createRehydratedWorkOrder({
        id: 2,
        vehicleId: 21,
        status: WorkOrderStatus.WAITING_APPROVAL,
        updatedAt: "2024-01-10T12:00:00.000Z",
      }),
      createRehydratedWorkOrder({
        id: 1,
        vehicleId: 22,
        status: WorkOrderStatus.IN_EXECUTION,
        updatedAt: "2024-01-10T10:00:00.000Z",
      }),
      createRehydratedWorkOrder({
        id: 5,
        vehicleId: 23,
        status: WorkOrderStatus.WAITING_APPROVAL,
        updatedAt: "2024-01-10T11:00:00.000Z",
      }),
      createRehydratedWorkOrder({
        id: 4,
        vehicleId: 24,
        status: WorkOrderStatus.DIAGNOSIS,
        updatedAt: "2024-01-10T09:30:00.000Z",
      }),
      createRehydratedWorkOrder({
        id: 3,
        vehicleId: 25,
        status: WorkOrderStatus.WAITING_APPROVAL,
        updatedAt: "2024-01-10T11:00:00.000Z",
      }),
      createRehydratedWorkOrder({
        id: 6,
        vehicleId: 26,
        status: WorkOrderStatus.RECEIVED,
        updatedAt: "2024-01-10T08:00:00.000Z",
      }),
      createRehydratedWorkOrder({
        id: 7,
        vehicleId: 27,
        status: WorkOrderStatus.DELIVERED,
        updatedAt: "2024-01-10T07:00:00.000Z",
      }),
    ];

    for (const workOrder of fixture) {
      repository.items.set(workOrder.toSnapshot().id ?? 0, workOrder);
    }

    const useCase = new ListWorkOrders(repository);
    const result = await useCase.execute();

    expect(result.map((workOrder) => workOrder.status)).toEqual([
      WorkOrderStatus.IN_EXECUTION,
      WorkOrderStatus.WAITING_APPROVAL,
      WorkOrderStatus.WAITING_APPROVAL,
      WorkOrderStatus.WAITING_APPROVAL,
      WorkOrderStatus.DIAGNOSIS,
      WorkOrderStatus.RECEIVED,
    ]);
    expect(result.map((workOrder) => workOrder.id)).toEqual([1, 3, 5, 2, 4, 6]);
  });
});
