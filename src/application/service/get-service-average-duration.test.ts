import { describe, expect, it } from "bun:test";

import { GetServiceAverageDuration } from "./get-service-average-duration";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import { Service } from "../../domain/service/aggregate/service";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceStockItemsRequired } from "../../domain/service/value-object/service-stock-item-reference";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { ServiceNotFound } from "../../domain/service/domain-error/service-not-found";
import { Money } from "../../domain/shared/value-object/money";

class InMemoryServiceRepository implements ServiceRepository {
  public items = new Map<number, Service>();

  public async create(service: Service): Promise<Service> {
    const snapshot = service.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Service must have an id to be created");
    }
    this.items.set(snapshot.id, service);
    return service;
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

function buildService(id: number): Service {
  return Service.rehydrate({
    id,
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

function buildCompletedTask(params: {
  id: number;
  serviceId: number;
  durationSeconds: number;
}): ServiceTask {
  const startedAt = new Date("2024-01-01T10:00:00.000Z");
  const completedAt = new Date(startedAt.getTime() + params.durationSeconds * 1000);

  const task = ServiceTask.rehydrate({
    id: params.id,
    serviceId: params.serviceId,
    workOrderId: 1,
    status: ServiceTaskStatus.COMPLETED,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
    price: Money.create(150),
    startedAt,
    completedAt,
  });

  return task;
}

function buildInExecutionTask(params: { id: number; serviceId: number }): ServiceTask {
  const startedAt = new Date("2024-01-01T10:00:00.000Z");

  return ServiceTask.rehydrate({
    id: params.id,
    serviceId: params.serviceId,
    workOrderId: 1,
    status: ServiceTaskStatus.IN_EXECUTION,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
    price: Money.create(150),
    startedAt,
    completedAt: null,
  });
}

describe("GetServiceAverageDuration", () => {
  it("calculates average duration in seconds using completed tasks", async () => {
    const serviceRepository = new InMemoryServiceRepository();
    const serviceTaskRepository = new InMemoryServiceTaskRepository();

    const service = buildService(1);
    await serviceRepository.create(service);

    await serviceTaskRepository.create(
      buildCompletedTask({ id: 1, serviceId: 1, durationSeconds: 3600 }),
    );
    await serviceTaskRepository.create(
      buildCompletedTask({ id: 2, serviceId: 1, durationSeconds: 7200 }),
    );

    const useCase = new GetServiceAverageDuration(serviceRepository, serviceTaskRepository);

    const result = await useCase.execute({ id: 1 });

    expect(result).toEqual({
      serviceId: 1,
      averageDurationSeconds: 5400,
      taskCount: 2,
      hasData: true,
    });
  });

  it("ignores non-completed or incomplete tasks", async () => {
    const serviceRepository = new InMemoryServiceRepository();
    const serviceTaskRepository = new InMemoryServiceTaskRepository();

    const service = buildService(1);
    await serviceRepository.create(service);

    await serviceTaskRepository.create(
      buildCompletedTask({ id: 1, serviceId: 1, durationSeconds: 1800 }),
    );
    await serviceTaskRepository.create(buildInExecutionTask({ id: 2, serviceId: 1 }));

    const useCase = new GetServiceAverageDuration(serviceRepository, serviceTaskRepository);

    const result = await useCase.execute({ id: 1 });

    expect(result).toEqual({
      serviceId: 1,
      averageDurationSeconds: 1800,
      taskCount: 1,
      hasData: true,
    });
  });

  it("returns hasData=false when there are no completed tasks", async () => {
    const serviceRepository = new InMemoryServiceRepository();
    const serviceTaskRepository = new InMemoryServiceTaskRepository();

    const service = buildService(1);
    await serviceRepository.create(service);

    const useCase = new GetServiceAverageDuration(serviceRepository, serviceTaskRepository);

    const result = await useCase.execute({ id: 1 });

    expect(result).toEqual({
      serviceId: 1,
      averageDurationSeconds: null,
      taskCount: 0,
      hasData: false,
    });
  });

  it("throws ServiceNotFound when service does not exist", async () => {
    const serviceRepository = new InMemoryServiceRepository();
    const serviceTaskRepository = new InMemoryServiceTaskRepository();

    const useCase = new GetServiceAverageDuration(serviceRepository, serviceTaskRepository);

    expect(useCase.execute({ id: 999 })).rejects.toBeInstanceOf(ServiceNotFound);
  });
});
