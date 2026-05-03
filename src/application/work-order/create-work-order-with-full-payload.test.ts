import { describe, expect, it } from "bun:test";

import {
  CreateWorkOrderPayloadValidationError,
  CreateWorkOrderWithFullPayload,
} from "./create-work-order-with-full-payload";
import { buildRequiredItems } from "./create-work-order-with-full-payload/build-required-items";
import { validateCreateWorkOrderPayload } from "./create-work-order-with-full-payload/validate-payload";
import { PersonDocumentAlreadyExists } from "../../domain/person/domain-error/person-document-already-exists";
import { PlateAlreadyExists } from "../../domain/vehicle/domain-error/plate-already-exists";
import { SkuAlreadyExists } from "../../domain/stock-item/domain-error/sku-already-exists";
import type { PersonRepository } from "../../domain/person/repository/person-repository";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { Person } from "../../domain/person/aggregate/person";
import { PersonDocument } from "../../domain/person/value-object/person-document";
import { PersonEmail } from "../../domain/person/value-object/person-email";
import { PersonName } from "../../domain/person/value-object/person-name";
import { PersonPhone } from "../../domain/person/value-object/person-phone";
import type { PersonRole } from "../../domain/person/value-object/person-role";
import { Service } from "../../domain/service/aggregate/service";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceStockItemsRequired } from "../../domain/service/value-object/service-stock-item-reference";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { assertServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { Money } from "../../domain/shared/value-object/money";
import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemName } from "../../domain/stock-item/value-object/stock-item-name";
import { StockItemQuantity } from "../../domain/stock-item/value-object/stock-item-quantity";
import { StockItemSku } from "../../domain/stock-item/value-object/stock-item-sku";
import { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehicleBrand } from "../../domain/vehicle/value-object/vehicle-brand";
import { VehicleModel } from "../../domain/vehicle/value-object/vehicle-model";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import { VehicleYear } from "../../domain/vehicle/value-object/vehicle-year";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import { assertWorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";

class InMemoryPersonRepository implements PersonRepository {
  public persons: Person[] = [];
  private nextId = 1;

  public async create(person: Person): Promise<Person> {
    const snapshot = person.toSnapshot();
    const created = Person.rehydrate({
      id: this.nextId++,
      name: PersonName.create(snapshot.name),
      document: PersonDocument.create(snapshot.document),
      phone: PersonPhone.create(snapshot.phone),
      email: PersonEmail.create(snapshot.email),
      role: snapshot.role as PersonRole,
    });
    this.persons.push(created);
    return created;
  }

  public async findById(id: number): Promise<Person | null> {
    return this.persons.find((person) => person.toSnapshot().id === id) ?? null;
  }

  public async findByDocument(document: PersonDocument): Promise<Person | null> {
    return (
      this.persons.find((person) => person.toSnapshot().document === document.toString()) ?? null
    );
  }

  public async findAll(): Promise<Person[]> {
    return this.persons;
  }

  public async save(entity: Person): Promise<void> {
    const snapshot = entity.toSnapshot();
    const index = this.persons.findIndex((person) => person.toSnapshot().id === snapshot.id);
    if (index !== -1) {
      this.persons[index] = entity;
    }
  }

  public async delete(id: number): Promise<void> {
    this.persons = this.persons.filter((person) => person.toSnapshot().id !== id);
  }
}

class InMemoryVehicleRepository implements VehicleRepository {
  public items = new Map<number, Vehicle>();
  private nextId = 1;

  public async create(vehicle: Vehicle): Promise<Vehicle> {
    const snapshot = vehicle.toSnapshot();
    const created = Vehicle.rehydrate({
      id: this.nextId++,
      plate: VehiclePlate.create(snapshot.plate),
      brand: VehicleBrand.create(snapshot.brand),
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

  public async save(entity: Vehicle): Promise<void> {
    const snapshot = entity.toSnapshot();
    if (!snapshot.id) {
      throw new Error("Vehicle must have id");
    }
    this.items.set(snapshot.id, entity);
  }

  public async delete(id: number): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryStockItemRepository implements StockItemRepository {
  public items = new Map<number, StockItem>();
  private nextId = 1;

  public async create(stockItem: StockItem): Promise<StockItem> {
    const snapshot = stockItem.toSnapshot();
    const existing = [...this.items.values()].find(
      (item) => item.toSnapshot().sku === snapshot.sku,
    );
    if (existing) {
      throw new SkuAlreadyExists(snapshot.sku);
    }

    const created = StockItem.rehydrate({
      id: this.nextId++,
      sku: StockItemSku.create(snapshot.sku),
      name: StockItemName.create(snapshot.name),
      description: snapshot.description,
      unitOfMeasure: snapshot.unitOfMeasure,
      quantity: StockItemQuantity.create(snapshot.quantity),
      price: Money.create(snapshot.price),
    });
    this.items.set(created.toSnapshot().id ?? 0, created);
    return created;
  }

  public async findById(id: number): Promise<StockItem | null> {
    return this.items.get(id) ?? null;
  }

  public async findAll(): Promise<StockItem[]> {
    return [...this.items.values()];
  }

  public async save(entity: StockItem): Promise<void> {
    const snapshot = entity.toSnapshot();
    if (!snapshot.id) {
      throw new Error("Stock item must have id");
    }
    this.items.set(snapshot.id, entity);
  }

  public async delete(id: number): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryServiceRepository implements ServiceRepository {
  public items = new Map<number, Service>();
  private nextId = 1;

  public async create(service: Service): Promise<Service> {
    const snapshot = service.toSnapshot();
    const created = Service.rehydrate({
      id: this.nextId++,
      name: ServiceName.create(snapshot.name),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(snapshot.estimatedTime),
      price: Money.create(snapshot.price),
      requiredItems: snapshot.requiredItems.map((item) =>
        ServiceStockItemsRequired.create({
          stockItemId: item.stockItemId,
          quantity: item.quantity,
        }),
      ),
    });
    this.items.set(created.toSnapshot().id ?? 0, created);
    return created;
  }

  public async findById(id: number): Promise<Service | null> {
    return this.items.get(id) ?? null;
  }

  public async findAll(): Promise<Service[]> {
    return [...this.items.values()];
  }

  public async save(entity: Service): Promise<void> {
    const snapshot = entity.toSnapshot();
    if (!snapshot.id) {
      throw new Error("Service must have id");
    }
    this.items.set(snapshot.id, entity);
  }

  public async delete(id: number): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryServiceTaskRepository implements ServiceTaskRepository {
  public items = new Map<number, ServiceTask>();
  private nextId = 1;

  public async create(serviceTask: ServiceTask): Promise<ServiceTask> {
    const snapshot = serviceTask.toSnapshot();
    const created = ServiceTask.rehydrate({
      id: this.nextId++,
      serviceId: snapshot.serviceId,
      workOrderId: snapshot.workOrderId,
      status: assertServiceTaskStatus(snapshot.status),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(snapshot.estimatedTime),
      price: Money.create(snapshot.price),
      startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : null,
      completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : null,
    });
    this.items.set(created.toSnapshot().id ?? 0, created);
    return created;
  }

  public async findById(id: number): Promise<ServiceTask | null> {
    return this.items.get(id) ?? null;
  }

  public async findByServiceId(serviceId: number): Promise<ServiceTask[]> {
    return [...this.items.values()].filter((item) => item.toSnapshot().serviceId === serviceId);
  }

  public async findAll(): Promise<ServiceTask[]> {
    return [...this.items.values()];
  }

  public async save(entity: ServiceTask): Promise<void> {
    const snapshot = entity.toSnapshot();
    if (!snapshot.id) {
      throw new Error("Service task must have id");
    }
    this.items.set(snapshot.id, entity);
  }
}

class InMemoryWorkOrderRepository implements WorkOrderRepository {
  public items = new Map<number, WorkOrder>();
  private nextId = 1;

  public async create(workOrder: WorkOrder): Promise<WorkOrder> {
    const snapshot = workOrder.toSnapshot();
    const created = WorkOrder.rehydrate({
      id: this.nextId++,
      vehicleId: snapshot.vehicleId,
      status: assertWorkOrderStatus(snapshot.status),
      totalAmount: Money.create(snapshot.totalAmount),
      publicToken: snapshot.publicToken,
      publicTokenExpiresAt: new Date(snapshot.publicTokenExpiresAt),
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      serviceTasks: snapshot.serviceTasks.map((task) => ({
        serviceTaskId: task.serviceTaskId,
        status: assertServiceTaskStatus(task.status),
        amount: Money.create(task.amount),
      })),
    });
    this.items.set(created.toSnapshot().id ?? 0, created);
    return created;
  }

  public async findById(id: number): Promise<WorkOrder | null> {
    return this.items.get(id) ?? null;
  }

  public async findByPublicToken(token: string): Promise<WorkOrder | null> {
    for (const item of this.items.values()) {
      if (item.toSnapshot().publicToken === token) {
        return item;
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

  public async save(entity: WorkOrder): Promise<void> {
    const snapshot = entity.toSnapshot();
    if (!snapshot.id) {
      throw new Error("Work order must have id");
    }
    this.items.set(snapshot.id, entity);
  }
}

function createDeps() {
  const personRepository = new InMemoryPersonRepository();
  const vehicleRepository = new InMemoryVehicleRepository();
  const stockItemRepository = new InMemoryStockItemRepository();
  const serviceRepository = new InMemoryServiceRepository();
  const serviceTaskRepository = new InMemoryServiceTaskRepository();
  const workOrderRepository = new InMemoryWorkOrderRepository();

  return {
    personRepository,
    vehicleRepository,
    stockItemRepository,
    serviceRepository,
    serviceTaskRepository,
    workOrderRepository,
  };
}

function buildValidInput(params?: {
  document?: string;
  plate?: string;
  sku?: string;
}): Parameters<CreateWorkOrderWithFullPayload["execute"]>[0] {
  const sku = params?.sku ?? "SKU-FULL-1";

  return {
    customer: {
      name: "Ana Silva",
      document: params?.document ?? "52998224725",
      phone: "+5511999999999",
      email: "ana.silva@example.com",
      role: "customer",
    },
    vehicle: {
      plate: params?.plate ?? "FUL-1234",
      brand: "Honda",
      model: "Civic",
      year: 2020,
    },
    parts: [
      {
        sku,
        name: "Oil Filter",
        description: null,
        quantity: 5,
        unitOfMeasure: null,
        price: 50,
      },
    ],
    services: [
      {
        name: "Oil Change",
        estimatedTime: 60,
        price: 200,
        requiredParts: [{ sku, quantity: 1 }],
      },
    ],
  };
}

describe("CreateWorkOrderWithFullPayload", () => {
  it("validates duplicate part skus before starting orchestration", () => {
    const input = buildValidInput();
    input.parts.push({
      ...input.parts[0],
      sku: ` ${input.parts[0].sku} `,
    });

    expect(() => validateCreateWorkOrderPayload(input)).toThrow(
      CreateWorkOrderPayloadValidationError,
    );
  });

  it("builds required items using normalized skus", () => {
    const input = buildValidInput();
    const requiredItems = buildRequiredItems(
      {
        ...input.services[0],
        requiredParts: [{ sku: ` ${input.parts[0].sku} `, quantity: 3 }],
      },
      new Map([[input.parts[0].sku, 7]]),
    );

    expect(requiredItems).toEqual([{ stockItemId: 7, quantity: 3 }]);
  });

  it("throws when a required item references a missing payload sku during assembly", () => {
    const input = buildValidInput();

    expect(() =>
      buildRequiredItems(
        {
          ...input.services[0],
          requiredParts: [{ sku: "UNKNOWN-SKU", quantity: 1 }],
        },
        new Map(),
      ),
    ).toThrow(CreateWorkOrderPayloadValidationError);
  });

  it("creates customer, vehicle, parts, services and service tasks in one flow", async () => {
    const deps = createDeps();
    const useCase = new CreateWorkOrderWithFullPayload(deps);

    const output = await useCase.execute({
      customer: {
        name: "Ana Silva",
        document: "52998224725",
        phone: "+5511999999999",
        email: "ana.silva@example.com",
        role: "customer",
      },
      vehicle: {
        plate: "FUL-1234",
        brand: "Honda",
        model: "Civic",
        year: 2020,
      },
      parts: [
        {
          sku: "SKU-FULL-1",
          name: "Oil Filter",
          description: null,
          quantity: 5,
          unitOfMeasure: null,
          price: 50,
        },
        {
          sku: "SKU-FULL-2",
          name: "Engine Oil",
          description: null,
          quantity: 8,
          unitOfMeasure: "L",
          price: 20,
        },
      ],
      services: [
        {
          name: "Oil Change",
          estimatedTime: 60,
          price: 200,
          requiredParts: [
            { sku: "SKU-FULL-1", quantity: 1 },
            { sku: "SKU-FULL-2", quantity: 2 },
          ],
        },
        {
          name: "Top-up",
          estimatedTime: 30,
          price: 100,
          requiredParts: [{ sku: "SKU-FULL-2", quantity: 1 }],
        },
      ],
    });

    expect(output.id).not.toBeNull();
    expect(output.status).toBe("WAITING_APPROVAL");
    expect(output.serviceTasks).toHaveLength(2);
    expect(output.totalAmount).toBe(410);
    expect(await deps.personRepository.findAll()).toHaveLength(1);
    expect(await deps.vehicleRepository.findAll()).toHaveLength(1);
    expect(await deps.stockItemRepository.findAll()).toHaveLength(2);
    expect(await deps.serviceRepository.findAll()).toHaveLength(2);
    const serviceTasks = await deps.serviceTaskRepository.findAll();
    expect(serviceTasks).toHaveLength(2);
    expect(serviceTasks.every((task) => task.toSnapshot().workOrderId === output.id)).toBe(true);
  });

  it("throws validation error when a service references a missing part SKU", async () => {
    const deps = createDeps();
    const useCase = new CreateWorkOrderWithFullPayload(deps);

    const act = () =>
      useCase.execute({
        customer: {
          name: "Ana Silva",
          document: "52998224725",
          phone: "+5511999999999",
          email: "ana.silva@example.com",
          role: "customer",
        },
        vehicle: {
          plate: "MIS-1234",
          brand: "Honda",
          model: "Civic",
          year: 2020,
        },
        parts: [
          {
            sku: "SKU-ONLY-1",
            name: "Oil Filter",
            description: null,
            quantity: 5,
            unitOfMeasure: null,
            price: 50,
          },
        ],
        services: [
          {
            name: "Oil Change",
            estimatedTime: 60,
            price: 200,
            requiredParts: [{ sku: "SKU-NOT-FOUND", quantity: 1 }],
          },
        ],
      });

    try {
      await act();
      throw new Error("Expected payload validation error");
    } catch (error) {
      expect(error).toBeInstanceOf(CreateWorkOrderPayloadValidationError);
    }
    expect(await deps.personRepository.findAll()).toHaveLength(0);
    expect(await deps.vehicleRepository.findAll()).toHaveLength(0);
    expect(await deps.stockItemRepository.findAll()).toHaveLength(0);
    expect(await deps.workOrderRepository.findAll()).toHaveLength(0);
  });

  it("throws document conflict when customer document already exists", async () => {
    const deps = createDeps();
    const useCase = new CreateWorkOrderWithFullPayload(deps);

    await useCase.execute(
      buildValidInput({ document: "52998224725", plate: "DOC-1000", sku: "DOC-SKU-1" }),
    );

    try {
      await useCase.execute(
        buildValidInput({ document: "52998224725", plate: "DOC-2000", sku: "DOC-SKU-2" }),
      );
      throw new Error("Expected person document conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(PersonDocumentAlreadyExists);
    }
  });

  it("throws plate conflict when vehicle plate already exists", async () => {
    const deps = createDeps();
    const useCase = new CreateWorkOrderWithFullPayload(deps);

    await useCase.execute(
      buildValidInput({ document: "52998224725", plate: "PLA-1000", sku: "PLA-SKU-1" }),
    );

    try {
      await useCase.execute(
        buildValidInput({ document: "16899535009", plate: "PLA-1000", sku: "PLA-SKU-2" }),
      );
      throw new Error("Expected plate conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(PlateAlreadyExists);
    }
  });

  it("throws sku conflict when part sku already exists", async () => {
    const deps = createDeps();
    const useCase = new CreateWorkOrderWithFullPayload(deps);

    await useCase.execute(
      buildValidInput({ document: "52998224725", plate: "SKU-1000", sku: "SKU-CONFLICT-1" }),
    );

    try {
      await useCase.execute(
        buildValidInput({ document: "16899535009", plate: "SKU-2000", sku: "SKU-CONFLICT-1" }),
      );
      throw new Error("Expected SKU conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(SkuAlreadyExists);
    }
  });
});
