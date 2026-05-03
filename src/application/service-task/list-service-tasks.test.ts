import { describe, expect, it } from "bun:test";

import { ListServiceTasks } from "./list-service-tasks";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { Money } from "../../domain/shared/value-object/money";

class InMemoryServiceTaskRepository implements ServiceTaskRepository {
  public items = new Map<number, ServiceTask>();

  public async create(serviceTask: ServiceTask): Promise<ServiceTask> {
    const snapshot = serviceTask.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Service task must have an id to be created");
    }
    this.items.set(snapshot.id, serviceTask);
    return serviceTask;
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

function buildServiceTask(id: number, serviceId: number): ServiceTask {
  return ServiceTask.rehydrate({
    id,
    serviceId,
    workOrderId: 1,
    status: ServiceTaskStatus.PENDING_APPROVAL,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
    price: Money.create(120),
    startedAt: null,
    completedAt: null,
  });
}

describe("ListServiceTasks", () => {
  it("returns all service tasks", async () => {
    const repository = new InMemoryServiceTaskRepository();
    await repository.create(buildServiceTask(1, 1));
    await repository.create(buildServiceTask(2, 2));
    const useCase = new ListServiceTasks(repository);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result.map((task) => task.id)).toEqual([1, 2]);
  });
});
