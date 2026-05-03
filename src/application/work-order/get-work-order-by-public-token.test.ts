import { describe, expect, it } from "bun:test";

import { GetWorkOrderByPublicToken } from "./get-work-order-by-public-token";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import { WorkOrderPublicTokenNotFound } from "../../domain/work-order/domain-error/work-order-public-token-not-found";
import { WorkOrderPublicTokenExpired } from "../../domain/work-order/domain-error/work-order-public-token-expired";
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

// eslint-disable-next-line no-secrets/no-secrets
describe("GetWorkOrderByPublicToken", () => {
  it("returns the work order when token is valid", async () => {
    const repository = new InMemoryWorkOrderRepository();
    const workOrder = WorkOrder.create({
      vehicleId: 10,
      publicToken: "public-token",
      publicTokenExpiresAt: new Date("2100-01-10T12:00:00.000Z"),
      serviceTasks: [],
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });

    await repository.create(workOrder);
    const useCase = new GetWorkOrderByPublicToken(repository);

    const result = await useCase.execute({ publicToken: "public-token" });

    expect(result.publicToken).toBe("public-token");
  });

  it("throws when token is expired", async () => {
    const repository = new InMemoryWorkOrderRepository();
    const workOrder = WorkOrder.create({
      vehicleId: 10,
      publicToken: "expired-token",
      publicTokenExpiresAt: new Date("2020-01-10T12:00:00.000Z"),
      serviceTasks: [],
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });

    await repository.create(workOrder);
    const useCase = new GetWorkOrderByPublicToken(repository);

    expect(useCase.execute({ publicToken: "expired-token" })).rejects.toBeInstanceOf(
      WorkOrderPublicTokenExpired,
    );
  });

  it("throws when token does not exist", async () => {
    const repository = new InMemoryWorkOrderRepository();
    const useCase = new GetWorkOrderByPublicToken(repository);

    expect(useCase.execute({ publicToken: "missing-token" })).rejects.toBeInstanceOf(
      WorkOrderPublicTokenNotFound,
    );
  });
});
