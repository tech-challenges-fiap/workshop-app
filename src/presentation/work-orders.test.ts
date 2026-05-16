import { beforeAll, describe, expect, it } from "bun:test";
import { Hono } from "hono";

import { registerWorkOrderRoutes } from "./work-orders";
import { CreateWorkOrderWithFullPayload } from "../application/work-order/create-work-order-with-full-payload";
import { GetWorkOrderById } from "../application/work-order/get-work-order-by-id";
import { ListWorkOrders } from "../application/work-order/list-work-orders";
import { CancelWorkOrder } from "../application/work-order/cancel-work-order";
import { DeliverVehicle } from "../application/work-order/deliver-vehicle";
import { GetWorkOrderByPublicToken } from "../application/work-order/get-work-order-by-public-token";
import { StartDiagnosis } from "../application/work-order/start-diagnosis";
import { CompleteDiagnosis } from "../application/work-order/complete-diagnosis";
import { AddServiceTask } from "../application/service-task/add-service-task";
import type { WorkOrderRepository } from "../domain/work-order/repository/work-order-repository";
import type { ServiceTaskRepository } from "../domain/service-task/repository/service-task-repository";
import type { ServiceRepository } from "../domain/service/repository/service-repository";
import type { StockItemRepository } from "../domain/stock-item/repository/stock-item-repository";
import type { VehicleRepository } from "../domain/vehicle/repository/vehicle-repository";
import type { PersonRepository } from "../domain/person/repository/person-repository";
import { WorkOrder } from "../domain/work-order/aggregate/work-order";
import { Vehicle } from "../domain/vehicle/aggregate/vehicle";
import { VehiclePlate } from "../domain/vehicle/value-object/vehicle-plate";
import { VehicleModel } from "../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../domain/vehicle/value-object/vehicle-year";
import { ServiceTask } from "../domain/service-task/aggregate/service-task";
import { ServiceTaskStatus } from "../domain/service-task/value-object/service-task-status";
import { ServiceEstimatedTime } from "../domain/service/value-object/service-estimated-time";
import { Money } from "../domain/shared/value-object/money";
import { Person } from "../domain/person/aggregate/person";
import { PersonName } from "../domain/person/value-object/person-name";
import { PersonDocument } from "../domain/person/value-object/person-document";
import { PersonPhone } from "../domain/person/value-object/person-phone";
import { PersonEmail } from "../domain/person/value-object/person-email";
import { PersonRole } from "../domain/person/value-object/person-role";
import { PersonDocumentAlreadyExists } from "../domain/person/domain-error/person-document-already-exists";
import { Service } from "../domain/service/aggregate/service";
import { ServiceName } from "../domain/service/value-object/service-name";
import { ServiceStockItemsRequired } from "../domain/service/value-object/service-stock-item-reference";
import { StockItem } from "../domain/stock-item/aggregate/stock-item";
import { StockItemName } from "../domain/stock-item/value-object/stock-item-name";
import { StockItemSku } from "../domain/stock-item/value-object/stock-item-sku";
import { StockItemQuantity } from "../domain/stock-item/value-object/stock-item-quantity";
import { SkuAlreadyExists } from "../domain/stock-item/domain-error/sku-already-exists";
import type { Notification } from "../application/notification/notification";
import { adminAuthMiddleware } from "./middleware/auth";
import { signToken } from "../infrastructure/auth/jwt";
import { WorkOrderStatusTransitionNotAllowed } from "../domain/work-order/domain-error/work-order-status-transition-not-allowed";
import { WorkOrderStatus } from "../domain/work-order/value-object/work-order-status";

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

class InMemoryVehicleRepository implements VehicleRepository {
  private nextId = 1;
  public items = new Map<number, Vehicle>();

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
    const existing = [...this.items.values()].find(
      (item) => item.toSnapshot().sku === snapshot.sku,
    );
    if (existing) {
      throw new SkuAlreadyExists(snapshot.sku);
    }

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
    return this.persons.find((p) => p.toSnapshot().id === id) ?? null;
  }

  public async findByDocument(document: PersonDocument): Promise<Person | null> {
    return this.persons.find((p) => p.toSnapshot().document === document.toString()) ?? null;
  }

  public async findAll(): Promise<Person[]> {
    return this.persons;
  }

  public async save(person: Person): Promise<void> {
    const snapshot = person.toSnapshot();
    const index = this.persons.findIndex((p) => p.toSnapshot().id === snapshot.id);
    if (index !== -1) {
      this.persons[index] = person;
    }
  }

  public async delete(id: number): Promise<void> {
    this.persons = this.persons.filter((p) => p.toSnapshot().id !== id);
  }
}

function buildApp() {
  const app = new Hono();
  app.use("/work-orders/*", adminAuthMiddleware);

  const workOrderRepository = new InMemoryWorkOrderRepository();
  const vehicleRepository = new InMemoryVehicleRepository();
  const serviceTaskRepository = new InMemoryServiceTaskRepository();
  const serviceRepository = new InMemoryServiceRepository();
  const stockItemRepository = new InMemoryStockItemRepository();
  const personRepository = new InMemoryPersonRepository();

  const notification: Notification = {
    async send(): Promise<void> {
      // noop for HTTP tests
    },
  };

  const createWorkOrder = new CreateWorkOrderWithFullPayload({
    personRepository,
    vehicleRepository,
    stockItemRepository,
    serviceRepository,
    serviceTaskRepository,
    workOrderRepository,
  });
  const getWorkOrderById = new GetWorkOrderById(workOrderRepository);
  const listWorkOrders = new ListWorkOrders(workOrderRepository);
  const cancelWorkOrder = new CancelWorkOrder(workOrderRepository);
  const deliverVehicle = new DeliverVehicle(workOrderRepository);
  const getWorkOrderByPublicToken = new GetWorkOrderByPublicToken(workOrderRepository);
  const startDiagnosis = new StartDiagnosis(workOrderRepository);
  const completeDiagnosis = new CompleteDiagnosis(workOrderRepository, {
    vehicleRepository,
    personRepository,
    serviceTaskRepository,
    serviceRepository,
    stockItemRepository,
    notification,
    publicBaseUrl: "http://localhost:8080",
  });

  registerWorkOrderRoutes(app, {
    createWorkOrder,
    getWorkOrderById,
    listWorkOrders,
    cancelWorkOrder,
    deliverVehicle,
    getWorkOrderByPublicToken,
    startDiagnosis,
    completeDiagnosis,
  });

  return {
    app,
    workOrderRepository,
    vehicleRepository,
    serviceTaskRepository,
    serviceRepository,
    stockItemRepository,
  };
}

function buildCreateWorkOrderPayload(params?: { document?: string; plate?: string; sku?: string }) {
  const sku = params?.sku ?? "SKU-WO-ROUTE-BASE";

  return {
    customer: {
      name: "Ana Silva",
      document: params?.document ?? "52998224725",
      phone: "+5511999999999",
      email: "ana.silva@example.com",
      role: "customer",
    },
    vehicle: {
      plate: params?.plate ?? "ABC-1234",
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

describe("WorkOrder routes", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
  });

  it("creates and loads a work order", async () => {
    const { app } = buildApp();
    const token = signToken({ sub: "admin" });

    const payload = {
      customer: {
        name: "Ana Silva",
        document: "52998224725",
        phone: "+5511999999999",
        email: "ana.silva@example.com",
        role: "customer",
      },
      vehicle: {
        plate: "ABC-1234",
        brand: "Honda",
        model: "Civic",
        year: 2020,
      },
      parts: [
        {
          sku: "SKU-WO-ROUTE-1",
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
          requiredParts: [{ sku: "SKU-WO-ROUTE-1", quantity: 1 }],
        },
      ],
    };

    const createRes = await app.request("/work-orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    expect(createRes.status).toBe(201);
    const createdBody = await createRes.json();

    const getRes = await app.request(`/work-orders/${createdBody.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.publicToken).toEqual(expect.any(String));
    expect(getBody.publicToken.length).toBeGreaterThan(0);
  });

  it("returns 400 when service references a SKU not present in parts", async () => {
    const { app } = buildApp();
    const token = signToken({ sub: "admin" });

    const payload = {
      customer: {
        name: "Ana Silva",
        document: "52998224725",
        phone: "+5511999999999",
        email: "ana.silva@example.com",
        role: "customer",
      },
      vehicle: {
        plate: "ABC-9999",
        brand: "Honda",
        model: "Civic",
        year: 2020,
      },
      parts: [
        {
          sku: "SKU-WO-ROUTE-2",
          name: "Brake Fluid",
          description: null,
          quantity: 10,
          unitOfMeasure: null,
          price: 20,
        },
      ],
      services: [
        {
          name: "Brake Service",
          estimatedTime: 90,
          price: 300,
          requiredParts: [{ sku: "SKU-UNKNOWN", quantity: 1 }],
        },
      ],
    };

    const res = await app.request("/work-orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("CreateWorkOrderPayloadValidationError");
  });

  it("returns 409 when customer document already exists", async () => {
    const { app } = buildApp();
    const token = signToken({ sub: "admin" });

    const firstPayload = buildCreateWorkOrderPayload({
      document: "52998224725",
      plate: "DOC-1234",
      sku: "SKU-WO-DOC-1",
    });
    const secondPayload = buildCreateWorkOrderPayload({
      document: "52998224725",
      plate: "DOC-5678",
      sku: "SKU-WO-DOC-2",
    });

    const first = await app.request("/work-orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firstPayload),
    });
    expect(first.status).toBe(201);

    const second = await app.request("/work-orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(secondPayload),
    });

    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error).toBe(PersonDocumentAlreadyExists.name);
  });

  it("returns 409 when vehicle plate already exists", async () => {
    const { app } = buildApp();
    const token = signToken({ sub: "admin" });

    const firstPayload = buildCreateWorkOrderPayload({
      document: "52998224725",
      plate: "PLT-1234",
      sku: "SKU-WO-PLATE-1",
    });
    const secondPayload = buildCreateWorkOrderPayload({
      document: "16899535009",
      plate: "PLT-1234",
      sku: "SKU-WO-PLATE-2",
    });

    const first = await app.request("/work-orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firstPayload),
    });
    expect(first.status).toBe(201);

    const second = await app.request("/work-orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(secondPayload),
    });

    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error).toBe("PlateAlreadyExists");
  });

  it("returns 409 when part sku already exists", async () => {
    const { app } = buildApp();
    const token = signToken({ sub: "admin" });

    const firstPayload = buildCreateWorkOrderPayload({
      document: "52998224725",
      plate: "SKU-1234",
      sku: "SKU-WO-CONFLICT-1",
    });
    const secondPayload = buildCreateWorkOrderPayload({
      document: "16899535009",
      plate: "SKU-5678",
      sku: "SKU-WO-CONFLICT-1",
    });

    const first = await app.request("/work-orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firstPayload),
    });
    expect(first.status).toBe(201);

    const second = await app.request("/work-orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(secondPayload),
    });

    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error).toBe("SkuAlreadyExists");
  });

  it("returns totalAmount including service and stock items after adding a service task", async () => {
    const {
      app,
      workOrderRepository,
      vehicleRepository,
      serviceTaskRepository,
      serviceRepository,
      stockItemRepository,
    } = buildApp();
    const token = signToken({ sub: "admin" });

    const vehicle = await vehicleRepository.create(
      Vehicle.create({
        plate: VehiclePlate.create("TOT-1234"),
        model: VehicleModel.create("Civic"),
        year: VehicleYear.create(2020),
        ownerPersonId: 10,
      }),
    );

    const workOrderAggregate = WorkOrder.create({
      vehicleId: vehicle.toSnapshot().id ?? 0,
      publicToken: "public-token-total",
      publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
      serviceTasks: [],
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });

    workOrderAggregate.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));

    const workOrder = await workOrderRepository.create(workOrderAggregate);

    const stockItem = await stockItemRepository.create(
      StockItem.create({
        sku: StockItemSku.create("SKU-TOTAL-1"),
        name: StockItemName.create("Oil Filter"),
        description: null,
        unitOfMeasure: null,
        initialQuantity: StockItemQuantity.create(10),
        price: Money.create(50),
      }),
    );

    const service = await serviceRepository.create(
      Service.create({
        name: ServiceName.create("Oil Change"),
        estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
        price: Money.create(200),
        requiredItems: [
          ServiceStockItemsRequired.create({
            stockItemId: stockItem.toSnapshot().id ?? 0,
            quantity: 2,
          }),
        ],
      }),
    );

    const addServiceTask = new AddServiceTask(
      serviceTaskRepository,
      serviceRepository,
      workOrderRepository,
      stockItemRepository,
    );

    await addServiceTask.execute({
      serviceId: service.toSnapshot().id ?? 0,
      workOrderId: workOrder.toSnapshot().id ?? 0,
    });

    const getRes = await app.request(`/work-orders/${workOrder.toSnapshot().id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(getRes.status).toBe(200);
    const body = await getRes.json();

    // 200 (service) + 2 * 50 (stock items) = 300
    expect(body.totalAmount).toBe(300);
  });

  it("lists operational queue by status priority and deterministic tie-breakers", async () => {
    const { app, workOrderRepository, vehicleRepository } = buildApp();
    const token = signToken({ sub: "admin" });

    const vehicle = await vehicleRepository.create(
      Vehicle.create({
        plate: VehiclePlate.create("XYZ-1234"),
        model: VehicleModel.create("Fit"),
        year: VehicleYear.create(2018),
        ownerPersonId: 12,
      }),
    );

    await workOrderRepository.create(
      WorkOrder.rehydrate({
        id: 91,
        vehicleId: vehicle.toSnapshot().id ?? 0,
        status: WorkOrderStatus.FINALIZED,
        totalAmount: Money.create(0),
        publicToken: "public-token-finalized",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        createdAt: new Date("2024-01-10T06:00:00.000Z"),
        updatedAt: new Date("2024-01-10T06:30:00.000Z"),
        serviceTasks: [],
      }),
    );
    await workOrderRepository.create(
      WorkOrder.rehydrate({
        id: 92,
        vehicleId: vehicle.toSnapshot().id ?? 0,
        status: WorkOrderStatus.DELIVERED,
        totalAmount: Money.create(0),
        publicToken: "public-token-delivered",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        createdAt: new Date("2024-01-10T06:10:00.000Z"),
        updatedAt: new Date("2024-01-10T06:40:00.000Z"),
        serviceTasks: [],
      }),
    );

    const inExecution = await workOrderRepository.create(
      WorkOrder.rehydrate({
        id: 1,
        vehicleId: vehicle.toSnapshot().id ?? 0,
        status: WorkOrderStatus.IN_EXECUTION,
        totalAmount: Money.create(0),
        publicToken: "public-token-in-execution",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        createdAt: new Date("2024-01-10T08:00:00.000Z"),
        updatedAt: new Date("2024-01-10T11:00:00.000Z"),
        serviceTasks: [],
      }),
    );
    const waitingApprovalFirst = await workOrderRepository.create(
      WorkOrder.rehydrate({
        id: 2,
        vehicleId: vehicle.toSnapshot().id ?? 0,
        status: WorkOrderStatus.WAITING_APPROVAL,
        totalAmount: Money.create(0),
        publicToken: "public-token-waiting-1",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        createdAt: new Date("2024-01-10T08:01:00.000Z"),
        updatedAt: new Date("2024-01-10T09:00:00.000Z"),
        serviceTasks: [],
      }),
    );
    const waitingApprovalSecond = await workOrderRepository.create(
      WorkOrder.rehydrate({
        id: 3,
        vehicleId: vehicle.toSnapshot().id ?? 0,
        status: WorkOrderStatus.WAITING_APPROVAL,
        totalAmount: Money.create(0),
        publicToken: "public-token-waiting-2",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        createdAt: new Date("2024-01-10T08:02:00.000Z"),
        updatedAt: new Date("2024-01-10T09:00:00.000Z"),
        serviceTasks: [],
      }),
    );
    const diagnosis = await workOrderRepository.create(
      WorkOrder.rehydrate({
        id: 4,
        vehicleId: vehicle.toSnapshot().id ?? 0,
        status: WorkOrderStatus.DIAGNOSIS,
        totalAmount: Money.create(0),
        publicToken: "public-token-diagnosis",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        createdAt: new Date("2024-01-10T08:03:00.000Z"),
        updatedAt: new Date("2024-01-10T08:30:00.000Z"),
        serviceTasks: [],
      }),
    );
    const received = await workOrderRepository.create(
      WorkOrder.rehydrate({
        id: 5,
        vehicleId: vehicle.toSnapshot().id ?? 0,
        status: WorkOrderStatus.RECEIVED,
        totalAmount: Money.create(0),
        publicToken: "public-token-received",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        createdAt: new Date("2024-01-10T08:04:00.000Z"),
        updatedAt: new Date("2024-01-10T08:00:00.000Z"),
        serviceTasks: [],
      }),
    );

    const res = await app.request("/work-orders", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: number; status: WorkOrderStatus }>;
    expect(body).toHaveLength(5);
    expect(body.map((item) => item.status)).toEqual([
      WorkOrderStatus.IN_EXECUTION,
      WorkOrderStatus.WAITING_APPROVAL,
      WorkOrderStatus.WAITING_APPROVAL,
      WorkOrderStatus.DIAGNOSIS,
      WorkOrderStatus.RECEIVED,
    ]);
    expect(body.map((item) => item.id)).toEqual([
      inExecution.toSnapshot().id,
      waitingApprovalFirst.toSnapshot().id,
      waitingApprovalSecond.toSnapshot().id,
      diagnosis.toSnapshot().id,
      received.toSnapshot().id,
    ]);
  });

  // Finalization of work orders now happens automatically when
  // all related service tasks reach final execution statuses.

  it("cancels a work order", async () => {
    const { app, workOrderRepository, vehicleRepository } = buildApp();
    const token = signToken({ sub: "admin" });

    const vehicle = await vehicleRepository.create(
      Vehicle.create({
        plate: VehiclePlate.create("QWE-1234"),
        model: VehicleModel.create("Corolla"),
        year: VehicleYear.create(2017),
        ownerPersonId: 8,
      }),
    );

    const created = await workOrderRepository.create(
      WorkOrder.create({
        vehicleId: vehicle.toSnapshot().id ?? 0,
        publicToken: "public-token-cancel",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        serviceTasks: [],
        createdAt: new Date("2024-01-10T08:00:00.000Z"),
      }),
    );

    const res = await app.request(`/work-orders/${created.toSnapshot().id}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("CANCELED");
  });

  it("delivers a finalized work order", async () => {
    const { app, workOrderRepository, vehicleRepository } = buildApp();
    const token = signToken({ sub: "admin" });

    const vehicle = await vehicleRepository.create(
      Vehicle.create({
        plate: VehiclePlate.create("DLV-1234"),
        model: VehicleModel.create("Tracker"),
        year: VehicleYear.create(2023),
        ownerPersonId: 18,
      }),
    );

    const workOrder = await workOrderRepository.create(
      WorkOrder.rehydrate({
        id: 44,
        vehicleId: vehicle.toSnapshot().id ?? 0,
        status: WorkOrderStatus.FINALIZED,
        totalAmount: Money.create(150),
        publicToken: "public-token-deliver",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        createdAt: new Date("2024-01-10T08:00:00.000Z"),
        updatedAt: new Date("2024-01-10T09:00:00.000Z"),
        serviceTasks: [],
      }),
    );

    const res = await app.request(`/work-orders/${workOrder.toSnapshot().id}/deliver`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("DELIVERED");
  });

  it("returns 409 when delivering in an invalid state", async () => {
    const { app, workOrderRepository, vehicleRepository } = buildApp();
    const token = signToken({ sub: "admin" });

    const vehicle = await vehicleRepository.create(
      Vehicle.create({
        plate: VehiclePlate.create("DLV-4090"),
        model: VehicleModel.create("Sentra"),
        year: VehicleYear.create(2020),
        ownerPersonId: 19,
      }),
    );

    const workOrder = await workOrderRepository.create(
      WorkOrder.create({
        vehicleId: vehicle.toSnapshot().id ?? 0,
        publicToken: "public-token-deliver-409",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        serviceTasks: [],
        createdAt: new Date("2024-01-10T08:00:00.000Z"),
      }),
    );

    const res = await app.request(`/work-orders/${workOrder.toSnapshot().id}/deliver`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe(WorkOrderStatusTransitionNotAllowed.name);
  });

  it("returns work order data by public token", async () => {
    const { app, workOrderRepository, vehicleRepository } = buildApp();

    const vehicle = await vehicleRepository.create(
      Vehicle.create({
        plate: VehiclePlate.create("ASD-1234"),
        model: VehicleModel.create("Focus"),
        year: VehicleYear.create(2019),
        ownerPersonId: 7,
      }),
    );

    await workOrderRepository.create(
      WorkOrder.create({
        vehicleId: vehicle.toSnapshot().id ?? 0,
        publicToken: "public-token-status",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        serviceTasks: [
          {
            serviceTaskId: 1,
            status: ServiceTaskStatus.PENDING_APPROVAL,
            amount: Money.create(100),
          },
        ],
        createdAt: new Date("2024-01-10T08:00:00.000Z"),
      }),
    );

    const res = await app.request("/public/work-orders/public-token-status");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.publicToken).toBe("public-token-status");

    const statusRes = await app.request("/public/work-orders/public-token-status/status");
    expect(statusRes.status).toBe(200);
    const statusBody = await statusRes.json();
    expect(statusBody.status).toBe("RECEIVED");
  });

  it("returns 404 when public token is not found", async () => {
    const { app } = buildApp();

    const res = await app.request("/public/work-orders/public-token-missing");

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("WorkOrderPublicTokenNotFound");
  });

  it("returns a public approval page with task links", async () => {
    const { app, workOrderRepository } = buildApp();

    const workOrder = WorkOrder.create({
      vehicleId: 1,
      publicToken: "public-token-approval",
      publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
      serviceTasks: [
        {
          serviceTaskId: 1,
          status: ServiceTaskStatus.PENDING_APPROVAL,
          amount: Money.create(200),
        },
      ],
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    await workOrderRepository.create(workOrder);

    const res = await app.request("/public/work-orders/public-token-approval/approval");

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Work Order");
    expect(html).toContain("/public/work-orders/public-token-approval/service-tasks/1/approve");
    expect(html).toContain("/public/work-orders/public-token-approval/service-tasks/1/reject");
  });

  it("returns 401 when public token is expired", async () => {
    const { app, workOrderRepository, vehicleRepository } = buildApp();

    const vehicle = await vehicleRepository.create(
      Vehicle.create({
        plate: VehiclePlate.create("ZXC-1234"),
        model: VehicleModel.create("Onix"),
        year: VehicleYear.create(2015),
        ownerPersonId: 5,
      }),
    );

    await workOrderRepository.create(
      WorkOrder.create({
        vehicleId: vehicle.toSnapshot().id ?? 0,
        publicToken: "public-token-expired",
        publicTokenExpiresAt: new Date("2020-01-10T12:00:00.000Z"),
        serviceTasks: [],
        createdAt: new Date("2024-01-10T08:00:00.000Z"),
      }),
    );

    const res = await app.request("/public/work-orders/public-token-expired");

    expect(res.status).toBe(401);
  });

  it("returns 401 when public token is expired for approval page", async () => {
    const { app, workOrderRepository } = buildApp();

    await workOrderRepository.create(
      WorkOrder.create({
        vehicleId: 1,
        publicToken: "public-token-expired-approval",
        publicTokenExpiresAt: new Date("2020-01-10T12:00:00.000Z"),
        serviceTasks: [],
        createdAt: new Date("2024-01-10T08:00:00.000Z"),
      }),
    );

    const res = await app.request("/public/work-orders/public-token-expired-approval/approval");

    expect(res.status).toBe(401);
  });

  it("starts diagnosis for a work order", async () => {
    const { app, workOrderRepository, vehicleRepository } = buildApp();
    const token = signToken({ sub: "admin" });

    const vehicle = await vehicleRepository.create(
      Vehicle.create({
        plate: VehiclePlate.create("DIA-1234"),
        model: VehicleModel.create("Cruze"),
        year: VehicleYear.create(2021),
        ownerPersonId: 11,
      }),
    );

    const created = await workOrderRepository.create(
      WorkOrder.create({
        vehicleId: vehicle.toSnapshot().id ?? 0,
        publicToken: "public-token-diagnosis-start",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        serviceTasks: [],
        createdAt: new Date("2024-01-10T08:00:00.000Z"),
      }),
    );

    const res = await app.request(`/work-orders/${created.toSnapshot().id}/diagnosis/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("DIAGNOSIS");
  });

  it("returns 404 when starting diagnosis for missing work order", async () => {
    const { app } = buildApp();
    const token = signToken({ sub: "admin" });

    const res = await app.request("/work-orders/999/diagnosis/start", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
  });

  it("returns 409 when starting diagnosis in an invalid state", async () => {
    const { app, workOrderRepository, vehicleRepository } = buildApp();
    const token = signToken({ sub: "admin" });

    const vehicle = await vehicleRepository.create(
      Vehicle.create({
        plate: VehiclePlate.create("DIA-4090"),
        model: VehicleModel.create("Golf"),
        year: VehicleYear.create(2016),
        ownerPersonId: 14,
      }),
    );

    const workOrder = WorkOrder.create({
      vehicleId: vehicle.toSnapshot().id ?? 0,
      publicToken: "public-token-diagnosis-start-409",
      publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
      serviceTasks: [],
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });
    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));

    const created = await workOrderRepository.create(workOrder);

    const res = await app.request(`/work-orders/${created.toSnapshot().id}/diagnosis/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(409);
  });

  it("completes diagnosis for a work order", async () => {
    const { app, workOrderRepository, vehicleRepository } = buildApp();
    const token = signToken({ sub: "admin" });

    const vehicle = await vehicleRepository.create(
      Vehicle.create({
        plate: VehiclePlate.create("DIA-5678"),
        model: VehicleModel.create("HB20"),
        year: VehicleYear.create(2022),
        ownerPersonId: 13,
      }),
    );

    const workOrder = WorkOrder.create({
      vehicleId: vehicle.toSnapshot().id ?? 0,
      publicToken: "public-token-diagnosis-complete",
      publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
      serviceTasks: [],
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });
    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));

    const created = await workOrderRepository.create(workOrder);

    const res = await app.request(`/work-orders/${created.toSnapshot().id}/diagnosis/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("WAITING_APPROVAL");
  });

  it("returns 404 when completing diagnosis for missing work order", async () => {
    const { app } = buildApp();
    const token = signToken({ sub: "admin" });

    const res = await app.request("/work-orders/999/diagnosis/complete", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
  });

  it("returns 409 when completing diagnosis in an invalid state", async () => {
    const { app, workOrderRepository, vehicleRepository } = buildApp();
    const token = signToken({ sub: "admin" });

    const vehicle = await vehicleRepository.create(
      Vehicle.create({
        plate: VehiclePlate.create("DIA-0001"),
        model: VehicleModel.create("Polo"),
        year: VehicleYear.create(2019),
        ownerPersonId: 15,
      }),
    );

    const created = await workOrderRepository.create(
      WorkOrder.create({
        vehicleId: vehicle.toSnapshot().id ?? 0,
        publicToken: "public-token-diagnosis-complete-409",
        publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
        serviceTasks: [],
        createdAt: new Date("2024-01-10T08:00:00.000Z"),
      }),
    );

    const res = await app.request(`/work-orders/${created.toSnapshot().id}/diagnosis/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(409);
  });
});
