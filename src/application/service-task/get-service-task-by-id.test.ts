import { describe, expect, it } from "bun:test";

import { GetServiceTaskById } from "./get-service-task-by-id";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";
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

function buildServiceTask(id: number): ServiceTask {
  return ServiceTask.rehydrate({
    id,
    serviceId: 1,
    workOrderId: 1,
    status: ServiceTaskStatus.PENDING_APPROVAL,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(20),
    price: Money.create(120),
    startedAt: null,
    completedAt: null,
  });
}

describe("GetServiceTaskById", () => {
  it("returns a service task when it exists", async () => {
    const repository = new InMemoryServiceTaskRepository();
    const task = buildServiceTask(1);
    await repository.create(task);
    const useCase = new GetServiceTaskById(repository);

    const result = await useCase.execute({ id: 1 });

    expect(result).toMatchObject({
      id: 1,
      serviceId: 1,
      status: ServiceTaskStatus.PENDING_APPROVAL,
      price: 120,
    });
  });

  it("throws when the service task does not exist", async () => {
    const repository = new InMemoryServiceTaskRepository();
    const useCase = new GetServiceTaskById(repository);

    expect(useCase.execute({ id: 999 })).rejects.toBeInstanceOf(ServiceTaskNotFound);
  });
});
