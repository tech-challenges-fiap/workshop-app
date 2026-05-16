import { describe, expect, it } from "bun:test";

import { CompleteDiagnosis } from "./complete-diagnosis";
import { buildCompleteDiagnosisNotificationInput } from "./complete-diagnosis/build-notification-payload";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";
import { Money } from "../../domain/shared/value-object/money";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import { VehicleModel } from "../../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../../domain/vehicle/value-object/vehicle-year";
import { VehicleBrand } from "../../domain/vehicle/value-object/vehicle-brand";
import type { PersonRepository } from "../../domain/person/repository/person-repository";
import { Person } from "../../domain/person/aggregate/person";
import { PersonName } from "../../domain/person/value-object/person-name";
import { PersonDocument } from "../../domain/person/value-object/person-document";
import { PersonPhone } from "../../domain/person/value-object/person-phone";
import { PersonEmail } from "../../domain/person/value-object/person-email";
import { PersonRole } from "../../domain/person/value-object/person-role";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import { Service } from "../../domain/service/aggregate/service";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import {
  ServiceStockItemsRequired,
  type ServiceStockItemsRequiredSnapshot,
} from "../../domain/service/value-object/service-stock-item-reference";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemName } from "../../domain/stock-item/value-object/stock-item-name";
import { StockItemSku } from "../../domain/stock-item/value-object/stock-item-sku";
import { StockItemQuantity } from "../../domain/stock-item/value-object/stock-item-quantity";
import type { Notification, NotificationInput } from "../notification/notification";

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

  public async findByPlate(plate: VehiclePlate): Promise<Vehicle | null> {
    for (const vehicle of this.items.values()) {
      if (vehicle.toSnapshot().plate === plate.toString()) {
        return vehicle;
      }
    }
    return null;
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
}

class InMemoryPersonRepository implements PersonRepository {
  private nextId = 1;
  public persons = new Map<number, Person>();

  public async create(person: Person): Promise<Person> {
    const snapshot = person.toSnapshot();
    const id = this.nextId++;
    const created = Person.rehydrate({
      id,
      name: PersonName.create(snapshot.name),
      document: PersonDocument.create(snapshot.document),
      phone: PersonPhone.create(snapshot.phone),
      email: PersonEmail.create(snapshot.email),
      role: snapshot.role as PersonRole,
    });

    this.persons.set(id, created);
    return created;
  }

  public async findById(id: number): Promise<Person | null> {
    return this.persons.get(id) ?? null;
  }

  public async findByDocument(document: PersonDocument): Promise<Person | null> {
    for (const person of this.persons.values()) {
      if (person.toSnapshot().document === document.toString()) {
        return person;
      }
    }
    return null;
  }

  public async findAll(): Promise<Person[]> {
    return [...this.persons.values()];
  }

  public async save(person: Person): Promise<void> {
    const snapshot = person.toSnapshot();
    if (snapshot.id === null) {
      throw new Error("Person must have an id to be saved");
    }
    this.persons.set(snapshot.id, person);
  }

  public async delete(id: number): Promise<void> {
    this.persons.delete(id);
  }
}

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

class InMemoryServiceRepository implements ServiceRepository {
  private nextId = 1;
  public items = new Map<number, Service>();

  public async create(service: Service): Promise<Service> {
    const snapshot = service.toSnapshot();
    const id = this.nextId++;
    const created = Service.rehydrate({
      id,
      name: ServiceName.create(snapshot.name),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(snapshot.estimatedTime),
      price: Money.create(snapshot.price),
      requiredItems: (snapshot.requiredItems ?? []).map((item) =>
        ServiceStockItemsRequired.create({
          stockItemId: item.stockItemId,
          quantity: item.quantity,
        }),
      ),
    });
    this.items.set(id, created);
    return created;
  }

  public async findById(id: number): Promise<Service | null> {
    return this.items.get(id) ?? null;
  }

  public async findAll(): Promise<Service[]> {
    return [...this.items.values()];
  }

  public async save(service: Service): Promise<void> {
    const snapshot = service.toSnapshot();
    if (!snapshot.id) {
      throw new Error("Service must have an id to be saved");
    }
    this.items.set(snapshot.id, service);
  }

  public async delete(id: number): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryStockItemRepository implements StockItemRepository {
  private nextId = 1;
  public items = new Map<number, StockItem>();

  public async create(stockItem: StockItem): Promise<StockItem> {
    const snapshot = stockItem.toSnapshot();
    const id = this.nextId++;
    const created = StockItem.rehydrate({
      id,
      sku: StockItemSku.create(snapshot.sku),
      name: StockItemName.create(snapshot.name),
      description: snapshot.description,
      unitOfMeasure: snapshot.unitOfMeasure,
      quantity: StockItemQuantity.create(snapshot.quantity),
      price: Money.create(snapshot.price),
    });

    this.items.set(id, created);
    return created;
  }

  public async findById(id: number): Promise<StockItem | null> {
    return this.items.get(id) ?? null;
  }

  public async findAll(): Promise<StockItem[]> {
    return [...this.items.values()];
  }

  public async save(stockItem: StockItem): Promise<void> {
    const snapshot = stockItem.toSnapshot();
    if (!snapshot.id) {
      throw new Error("Stock item must have an id to be saved");
    }
    this.items.set(snapshot.id, stockItem);
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

async function seedNotificationScenario() {
  const workOrderRepository = new InMemoryWorkOrderRepository();
  const vehicleRepository = new InMemoryVehicleRepository();
  const personRepository = new InMemoryPersonRepository();
  const serviceTaskRepository = new InMemoryServiceTaskRepository();
  const serviceRepository = new InMemoryServiceRepository();
  const stockItemRepository = new InMemoryStockItemRepository();
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

  const stockItem = StockItem.create({
    sku: StockItemSku.create("SKU-OIL-1"),
    name: StockItemName.create("Oil Filter"),
    description: "Standard oil filter",
    unitOfMeasure: "unit",
    initialQuantity: StockItemQuantity.create(10),
    price: Money.create(50),
  });
  const createdStockItem = await stockItemRepository.create(stockItem);

  const requiredItem: ServiceStockItemsRequiredSnapshot = {
    stockItemId: createdStockItem.toSnapshot().id ?? 0,
    quantity: 1,
  };
  const service = Service.create({
    name: ServiceName.create("Oil Change"),
    estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
    price: Money.create(200),
    requiredItems: [ServiceStockItemsRequired.create(requiredItem)],
  });
  const createdService = await serviceRepository.create(service);

  const workOrder = WorkOrder.create({
    vehicleId: createdVehicle.toSnapshot().id ?? 0,
    publicToken: "public-token",
    publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
    createdAt: new Date("2024-01-10T08:00:00.000Z"),
    serviceTasks: [],
  });
  const createdWorkOrder = await workOrderRepository.create(workOrder);
  const workOrderId = createdWorkOrder.toSnapshot().id ?? 0;

  const serviceTask = ServiceTask.create({
    serviceId: createdService.toSnapshot().id ?? 0,
    workOrderId,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
    price: Money.create(200),
  });
  const createdServiceTask = await serviceTaskRepository.create(serviceTask);
  const serviceTaskId = createdServiceTask.toSnapshot().id ?? 0;

  createdWorkOrder.syncServiceTasks({
    tasks: [
      {
        serviceTaskId,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: Money.create(200),
      },
    ],
    now: new Date("2024-01-10T08:05:00.000Z"),
  });

  createdWorkOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
  await workOrderRepository.save(createdWorkOrder);

  return {
    workOrderRepository,
    vehicleRepository,
    personRepository,
    serviceTaskRepository,
    serviceRepository,
    stockItemRepository,
    notification,
    createdService,
    createdStockItem,
    workOrderId,
    serviceTaskId,
  };
}

describe("CompleteDiagnosis", () => {
  it("builds notification payload with normalized approval links", async () => {
    const scenario = await seedNotificationScenario();
    const workOrder = await scenario.workOrderRepository.findById(scenario.workOrderId);

    if (!workOrder) {
      throw new Error("Expected seeded work order");
    }

    const notificationInput = await buildCompleteDiagnosisNotificationInput(
      workOrder.toSnapshot(),
      {
        vehicleRepository: scenario.vehicleRepository,
        personRepository: scenario.personRepository,
        serviceTaskRepository: scenario.serviceTaskRepository,
        serviceRepository: scenario.serviceRepository,
        stockItemRepository: scenario.stockItemRepository,
        notification: scenario.notification,
        publicBaseUrl: "http://localhost:8080/",
      },
    );

    const payload = JSON.parse(notificationInput.message);

    expect(payload.approvalPageUrl).toBe(
      "http://localhost:8080/public/work-orders/public-token/approval",
    );
    expect(payload.serviceTasks[0].approvalLinks).toEqual({
      approve: `http://localhost:8080/public/work-orders/public-token/service-tasks/${scenario.serviceTaskId}/approve`,
      reject: `http://localhost:8080/public/work-orders/public-token/service-tasks/${scenario.serviceTaskId}/reject`,
    });
  });

  it("completes diagnosis for a work order and sends a notification", async () => {
    const scenario = await seedNotificationScenario();

    const useCase = new CompleteDiagnosis(scenario.workOrderRepository, {
      vehicleRepository: scenario.vehicleRepository,
      personRepository: scenario.personRepository,
      serviceTaskRepository: scenario.serviceTaskRepository,
      serviceRepository: scenario.serviceRepository,
      stockItemRepository: scenario.stockItemRepository,
      notification: scenario.notification,
      publicBaseUrl: "http://localhost:8080/",
    });
    const completedAt = new Date("2024-01-10T08:20:00.000Z");

    const result = await useCase.execute({ id: scenario.workOrderId, completedAt });

    expect(result.status).toBe(WorkOrderStatus.WAITING_APPROVAL);
    expect(result.updatedAt).toBe(completedAt.toISOString());

    expect(scenario.notification.sent).toHaveLength(1);
    expect(scenario.notification.sent[0].email).toBe("customer@example.com");
    expect(scenario.notification.sent[0].phone).toBe("+5511999999999");

    const payload = JSON.parse(scenario.notification.sent[0].message);

    expect(payload.event).toBe("diagnosis_completed");
    expect(payload.workOrder.id).toBe(scenario.workOrderId);
    expect(payload.workOrder.totalAmount).toBe(200);
    expect(payload.approvalPageUrl).toBe(
      "http://localhost:8080/public/work-orders/public-token/approval",
    );
    expect(payload.serviceTasks).toHaveLength(1);
    expect(payload.serviceTasks[0]).toMatchObject({
      id: scenario.serviceTaskId,
      status: ServiceTaskStatus.PENDING_APPROVAL,
      amount: 200,
      service: {
        id: scenario.createdService.toSnapshot().id,
        name: "Oil Change",
        estimatedTime: 60,
        price: 200,
      },
      approvalLinks: {
        approve: `http://localhost:8080/public/work-orders/public-token/service-tasks/${scenario.serviceTaskId}/approve`,
        reject: `http://localhost:8080/public/work-orders/public-token/service-tasks/${scenario.serviceTaskId}/reject`,
      },
    });
    expect(payload.serviceTasks[0].requiredItems).toHaveLength(1);
    expect(payload.serviceTasks[0].requiredItems[0]).toMatchObject({
      stockItemId: scenario.createdStockItem.toSnapshot().id,
      sku: "SKU-OIL-1",
      name: "Oil Filter",
      unitOfMeasure: "unit",
      quantity: 1,
      price: 50,
    });
  });

  it("throws when the work order does not exist", async () => {
    const repository = new InMemoryWorkOrderRepository();
    const useCase = new CompleteDiagnosis(repository);

    expect(useCase.execute({ id: 999 })).rejects.toBeInstanceOf(WorkOrderNotFound);
  });
});
