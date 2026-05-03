import { describe, expect, it } from "bun:test";

import { CreateWorkOrder } from "./create-work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";
import { Money } from "../../domain/shared/value-object/money";
import { VehicleNotFound } from "../../domain/vehicle/domain-error/vehicle-not-found";
import { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import { VehicleModel } from "../../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../../domain/vehicle/value-object/vehicle-year";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";

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

class InMemoryVehicleRepository implements VehicleRepository {
  private items = new Map<number, Vehicle>();
  private nextId = 1;

  public async create(vehicle: Vehicle): Promise<Vehicle> {
    const snapshot = vehicle.toSnapshot();
    const created = Vehicle.rehydrate({
      id: this.nextId++,
      plate: VehiclePlate.create(snapshot.plate),
      model: VehicleModel.create(snapshot.model),
      year: VehicleYear.create(snapshot.year),
      ownerPersonId: snapshot.ownerPersonId,
    });
    this.items.set(created.toSnapshot().id ?? 0, created);
    return created;
  }

  public async findById(id: number): Promise<Vehicle | null> {
    return this.items.get(id) ?? null;
  }

  public async findByPlate(plate: VehiclePlate): Promise<Vehicle | null> {
    return (
      [...this.items.values()].find((vehicle) => vehicle.toSnapshot().plate === plate.toString()) ??
      null
    );
  }

  public async findAll(): Promise<Vehicle[]> {
    return [...this.items.values()];
  }

  public async save(vehicle: Vehicle): Promise<void> {
    const snapshot = vehicle.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Vehicle must have an id to be saved");
    }
    this.items.set(snapshot.id, vehicle);
  }

  public async delete(id: number): Promise<void> {
    this.items.delete(id);
  }

  public add(vehicle: Vehicle): void {
    const snapshot = vehicle.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Vehicle must have an id to be added");
    }
    this.items.set(snapshot.id, vehicle);
  }
}

class InMemoryServiceTaskRepository implements ServiceTaskRepository {
  public items = new Map<number, ServiceTask>();

  public async create(serviceTask: ServiceTask): Promise<ServiceTask> {
    const snapshot = serviceTask.toSnapshot();
    const id = snapshot.id ?? this.items.size + 1;
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

  public add(serviceTask: ServiceTask): void {
    const snapshot = serviceTask.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Service task must have an id to be added");
    }
    this.items.set(snapshot.id, serviceTask);
  }
}

describe("CreateWorkOrder", () => {
  it("creates a work order and calculates total amount", async () => {
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const vehicleRepository = new InMemoryVehicleRepository();
    const serviceTaskRepository = new InMemoryServiceTaskRepository();

    vehicleRepository.add(
      Vehicle.rehydrate({
        id: 1,
        plate: VehiclePlate.create("ABC-1234"),
        model: VehicleModel.create("Civic"),
        year: VehicleYear.create(2020),
        ownerPersonId: 5,
      }),
    );

    serviceTaskRepository.add(
      ServiceTask.rehydrate({
        id: 10,
        serviceId: 100,
        workOrderId: 1,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
        price: Money.create(120),
        startedAt: null,
        completedAt: null,
      }),
    );
    serviceTaskRepository.add(
      ServiceTask.rehydrate({
        id: 11,
        serviceId: 101,
        workOrderId: 1,
        status: ServiceTaskStatus.CANCELED,
        estimatedTime: ServiceEstimatedTime.createFromMinutes(45),
        price: Money.create(80),
        startedAt: null,
        completedAt: null,
      }),
    );
    serviceTaskRepository.add(
      ServiceTask.rehydrate({
        id: 12,
        serviceId: 102,
        workOrderId: 1,
        status: ServiceTaskStatus.APPROVED,
        estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
        price: Money.create(200),
        startedAt: null,
        completedAt: null,
      }),
    );

    const useCase = new CreateWorkOrder(
      workOrderRepository,
      vehicleRepository,
      serviceTaskRepository,
    );

    const result = await useCase.execute({
      vehicleId: 1,
      serviceTasks: [
        {
          serviceTaskId: 10,
        },
        {
          serviceTaskId: 11,
        },
        {
          serviceTaskId: 12,
        },
      ],
    });

    expect(result.status).toBe(WorkOrderStatus.RECEIVED);
    expect(result.totalAmount).toBe(320);
    expect(result.publicToken).toEqual(expect.any(String));
    expect(result.publicToken.length).toBeGreaterThan(0);
    const createdAt = new Date(result.createdAt);
    const expiresAt = new Date(result.publicTokenExpiresAt);
    expect(expiresAt.getFullYear()).toBe(createdAt.getFullYear() + 2);
    expect(expiresAt.getMonth()).toBe(createdAt.getMonth());
    expect(expiresAt.getDate()).toBe(createdAt.getDate());
    expect(result.serviceTasks).toHaveLength(3);
  });

  it("throws when vehicle does not exist", async () => {
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const vehicleRepository = new InMemoryVehicleRepository();
    const serviceTaskRepository = new InMemoryServiceTaskRepository();
    const useCase = new CreateWorkOrder(
      workOrderRepository,
      vehicleRepository,
      serviceTaskRepository,
    );

    expect(
      useCase.execute({
        vehicleId: 999,
      }),
    ).rejects.toBeInstanceOf(VehicleNotFound);
  });
});
