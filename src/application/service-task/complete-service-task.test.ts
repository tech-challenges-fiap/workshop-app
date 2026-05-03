import { describe, expect, it } from "bun:test";

import { CompleteServiceTask } from "./complete-service-task";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";
import { Money } from "../../domain/shared/value-object/money";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import { VehicleModel } from "../../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../../domain/vehicle/value-object/vehicle-year";
import { VehicleBrand } from "../../domain/vehicle/value-object/vehicle-brand";
import { Person } from "../../domain/person/aggregate/person";
import type { PersonRepository } from "../../domain/person/repository/person-repository";
import { PersonName } from "../../domain/person/value-object/person-name";
import { PersonDocument } from "../../domain/person/value-object/person-document";
import { PersonPhone } from "../../domain/person/value-object/person-phone";
import { PersonEmail } from "../../domain/person/value-object/person-email";
import { PersonRole, assertPersonRole } from "../../domain/person/value-object/person-role";
import type { Notification, NotificationInput } from "../notification/notification";

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
  public items = new Map<number, WorkOrder>();

  public async create(workOrder: WorkOrder): Promise<WorkOrder> {
    const snapshot = workOrder.toSnapshot();
    const id = snapshot.id ?? 0;
    this.items.set(id, workOrder);
    return workOrder;
  }

  public async findById(id: number): Promise<WorkOrder | null> {
    return this.items.get(id) ?? null;
  }

  public async findByPublicToken(_token: string): Promise<WorkOrder | null> {
    void _token;
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
    const id = snapshot.id ?? 0;
    this.items.set(id, workOrder);
  }
}

class InMemoryVehicleRepository implements VehicleRepository {
  private nextId = 1;
  public items = new Map<number, Vehicle>();

  public async create(vehicle: Vehicle): Promise<Vehicle> {
    const snapshot = vehicle.toSnapshot();
    const id = this.nextId++;

    const created = Vehicle.rehydrate({
      id,
      plate: VehiclePlate.create(snapshot.plate),
      brand: VehicleBrand.create(snapshot.brand),
      model: VehicleModel.create(snapshot.model),
      year: VehicleYear.create(snapshot.year),
      ownerPersonId: snapshot.ownerPersonId,
    });

    this.items.set(id, created);
    return created;
  }

  public async findById(id: number): Promise<Vehicle | null> {
    return this.items.get(id) ?? null;
  }

  public async findByPlate(_plate: VehiclePlate): Promise<Vehicle | null> {
    void _plate;
    return null;
  }

  public async findAll(): Promise<Vehicle[]> {
    return [...this.items.values()];
  }

  public async save(vehicle: Vehicle): Promise<void> {
    const snapshot = vehicle.toSnapshot();
    if (!snapshot.id) {
      throw new Error("Vehicle must have an id to be saved");
    }
    this.items.set(snapshot.id, vehicle);
  }

  public async delete(id: number): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryPersonRepository implements PersonRepository {
  private nextId = 1;
  public items = new Map<number, Person>();

  public async create(person: Person): Promise<Person> {
    const snapshot = person.toSnapshot();
    const id = this.nextId++;

    const created = Person.rehydrate({
      id,
      name: PersonName.create(snapshot.name),
      document: PersonDocument.create(snapshot.document),
      phone: PersonPhone.create(snapshot.phone),
      email: PersonEmail.create(snapshot.email),
      role: assertPersonRole(snapshot.role),
    });

    this.items.set(id, created);
    return created;
  }

  public async findById(id: number): Promise<Person | null> {
    return this.items.get(id) ?? null;
  }

  public async findByDocument(_document: PersonDocument): Promise<Person | null> {
    void _document;
    return null;
  }

  public async findAll(): Promise<Person[]> {
    return [...this.items.values()];
  }

  public async save(person: Person): Promise<void> {
    const snapshot = person.toSnapshot();
    if (!snapshot.id) {
      throw new Error("Person must have an id to be saved");
    }
    this.items.set(snapshot.id, person);
  }

  public async delete(id: number): Promise<void> {
    this.items.delete(id);
  }
}

class FakeNotification implements Notification {
  public sent: NotificationInput[] = [];

  public async send(input: NotificationInput): Promise<void> {
    this.sent.push(input);
  }
}

function buildServiceTask(): ServiceTask {
  const task = ServiceTask.create({
    serviceId: 2,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
    price: Money.create(150),
    workOrderId: 1,
  });

  task.approve();
  task.startExecution(new Date("2024-02-01T10:00:00.000Z"));

  return task;
}

function buildWorkOrderInExecution(): WorkOrder {
  return WorkOrder.rehydrate({
    id: 1,
    vehicleId: 99,
    status: WorkOrderStatus.IN_EXECUTION,
    totalAmount: Money.create(250),
    publicToken: "public-token",
    publicTokenExpiresAt: new Date("2024-02-01T12:00:00.000Z"),
    createdAt: new Date("2024-02-01T08:00:00.000Z"),
    updatedAt: new Date("2024-02-01T10:00:00.000Z"),
    serviceTasks: [
      {
        serviceTaskId: 1,
        status: ServiceTaskStatus.IN_EXECUTION,
        amount: Money.create(150),
      },
      {
        serviceTaskId: 2,
        status: ServiceTaskStatus.COMPLETED,
        amount: Money.create(100),
      },
    ],
  });
}

describe("CompleteServiceTask", () => {
  it("completes a task in execution and auto-finalizes the work order", async () => {
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const workOrder = buildWorkOrderInExecution();
    const workOrderId = workOrder.toSnapshot().id ?? 0;
    workOrderRepository.items.set(workOrderId, workOrder);

    const repository = new InMemoryServiceTaskRepository();
    const created = await repository.create(buildServiceTask());
    const id = created.toSnapshot().id ?? 0;

    const useCase = new CompleteServiceTask(repository, workOrderRepository);
    const completedAt = new Date("2024-02-01T12:00:00.000Z");

    const result = await useCase.execute({ id, completedAt });

    expect(result.status).toBe(ServiceTaskStatus.COMPLETED);
    expect(workOrderRepository.items.get(workOrderId)?.toSnapshot().status).toBe(
      WorkOrderStatus.FINALIZED,
    );
  });

  it("throws when the task does not exist", async () => {
    const repository = new InMemoryServiceTaskRepository();
    const useCase = new CompleteServiceTask(repository);

    expect(useCase.execute({ id: 999 })).rejects.toBeInstanceOf(ServiceTaskNotFound);
  });

  it("throws WorkOrderNotFound when the owning work order cannot be loaded", async () => {
    const repository = new InMemoryServiceTaskRepository();
    const created = await repository.create(buildServiceTask());
    const id = created.toSnapshot().id ?? 0;

    const workOrderRepository = new InMemoryWorkOrderRepository();
    const useCase = new CompleteServiceTask(repository, workOrderRepository);

    expect(useCase.execute({ id })).rejects.toBeInstanceOf(WorkOrderNotFound);
  });

  it("sends a notification when the work order is finalized", async () => {
    const serviceTaskRepository = new InMemoryServiceTaskRepository();
    const workOrderRepository = new InMemoryWorkOrderRepository();
    const vehicleRepository = new InMemoryVehicleRepository();
    const personRepository = new InMemoryPersonRepository();
    const notification = new FakeNotification();

    const person = Person.create({
      name: PersonName.create("Customer"),
      document: PersonDocument.create("52998224725"),
      phone: PersonPhone.create("+5511999999999"),
      email: PersonEmail.create("customer@example.com"),
      role: PersonRole.CUSTOMER,
    });
    const createdPerson = await personRepository.create(person);

    const vehicle = Vehicle.create({
      plate: VehiclePlate.create("ABC-1234"),
      brand: VehicleBrand.create("Honda"),
      model: VehicleModel.create("Civic"),
      year: VehicleYear.create(2020),
      ownerPersonId: createdPerson.toSnapshot().id ?? 0,
    });
    const createdVehicle = await vehicleRepository.create(vehicle);

    const workOrder = WorkOrder.rehydrate({
      id: 1,
      vehicleId: createdVehicle.toSnapshot().id ?? 0,
      status: WorkOrderStatus.IN_EXECUTION,
      totalAmount: Money.create(250),
      publicToken: "public-token",
      publicTokenExpiresAt: new Date("2024-02-01T12:00:00.000Z"),
      createdAt: new Date("2024-02-01T08:00:00.000Z"),
      updatedAt: new Date("2024-02-01T10:00:00.000Z"),
      serviceTasks: [
        {
          serviceTaskId: 1,
          status: ServiceTaskStatus.IN_EXECUTION,
          amount: Money.create(150),
        },
        {
          serviceTaskId: 2,
          status: ServiceTaskStatus.COMPLETED,
          amount: Money.create(100),
        },
      ],
    });

    await workOrderRepository.create(workOrder);

    const createdTask = await serviceTaskRepository.create(buildServiceTask());
    const taskId = createdTask.toSnapshot().id ?? 0;

    const useCase = new CompleteServiceTask(serviceTaskRepository, workOrderRepository, {
      vehicleRepository,
      personRepository,
      notification,
    });

    const completedAt = new Date("2024-02-01T12:00:00.000Z");

    const result = await useCase.execute({ id: taskId, completedAt });

    expect(result.status).toBe(ServiceTaskStatus.COMPLETED);
    const workOrderSnapshot = (await workOrderRepository.findById(1))?.toSnapshot();
    expect(workOrderSnapshot?.status).toBe(WorkOrderStatus.FINALIZED);

    expect(notification.sent).toHaveLength(1);
    const payload = JSON.parse(notification.sent[0].message);
    expect(payload.event).toBe("work_order_finalized");
    expect(payload.workOrder.id).toBe(1);
    expect(payload.workOrder.status).toBe(WorkOrderStatus.FINALIZED);
    expect(payload.vehicle.id).toBe(createdVehicle.toSnapshot().id);
    expect(payload.owner.id).toBe(createdPerson.toSnapshot().id);
  });
});
