import { beforeAll, beforeEach, describe, expect, it } from "bun:test";

import { ensureDatabaseConnection, pool } from "../db";
import { runMigrations } from "../db/migrate";
import { WorkOrderRepositoryPostgres } from "./work-order-repository-postgres";
import { PersonRepositoryPostgres } from "../person/person-repository-postgres";
import { VehicleRepositoryPostgres } from "../vehicle/vehicle-repository-postgres";
import { ServiceRepositoryPostgres } from "../service/service-repository-postgres";
import { StockItemRepositoryPostgres } from "../stock-item/stock-item-repository-postgres";
import { ServiceTaskRepositoryPostgres } from "../service-task/service-task-repository-postgres";
import { Person } from "../../domain/person/aggregate/person";
import { PersonName } from "../../domain/person/value-object/person-name";
import { PersonDocument } from "../../domain/person/value-object/person-document";
import { PersonPhone } from "../../domain/person/value-object/person-phone";
import { PersonEmail } from "../../domain/person/value-object/person-email";
import { PersonRole } from "../../domain/person/value-object/person-role";
import { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import { VehicleModel } from "../../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../../domain/vehicle/value-object/vehicle-year";
import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemName } from "../../domain/stock-item/value-object/stock-item-name";
import { StockItemQuantity } from "../../domain/stock-item/value-object/stock-item-quantity";
import { StockItemSku } from "../../domain/stock-item/value-object/stock-item-sku";
import { Service } from "../../domain/service/aggregate/service";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import { Money } from "../../domain/shared/value-object/money";

async function resetDatabase(): Promise<void> {
  await pool.query(
    "TRUNCATE TABLE work_orders, service_tasks, service_stock_items, services, vehicles, person, stock_items RESTART IDENTITY CASCADE",
  );
}

async function createPerson(): Promise<number> {
  const repository = new PersonRepositoryPostgres();
  const person = Person.create({
    name: PersonName.create("Maria Silva"),
    document: PersonDocument.create("52998224725"),
    phone: PersonPhone.create("+5511999999999"),
    email: PersonEmail.create("maria@example.com"),
    role: PersonRole.CUSTOMER,
  });

  const created = await repository.create(person);
  return created.toSnapshot().id ?? 0;
}

async function createVehicle(): Promise<number> {
  const repository = new VehicleRepositoryPostgres();
  const personId = await createPerson();
  const vehicle = Vehicle.create({
    plate: VehiclePlate.create("ABC-1234"),
    model: VehicleModel.create("Civic"),
    year: VehicleYear.create(2020),
    ownerPersonId: personId,
  });

  const created = await repository.create(vehicle);
  return created.toSnapshot().id ?? 0;
}

async function createStockItem(sku: string): Promise<number> {
  const repository = new StockItemRepositoryPostgres();
  const stockItem = StockItem.create({
    sku: StockItemSku.create(sku),
    name: StockItemName.create("Oil Filter"),
    description: null,
    unitOfMeasure: null,
    initialQuantity: StockItemQuantity.create(10),
    price: Money.create(50),
  });

  const created = await repository.create(stockItem);
  return created.toSnapshot().id ?? 0;
}

async function createService(): Promise<number> {
  const repository = new ServiceRepositoryPostgres();
  const service = Service.create({
    name: ServiceName.create("Oil Change"),
    estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
    price: Money.create(200),
    requiredItems: [],
  });

  const created = await repository.create(service);
  return created.toSnapshot().id ?? 0;
}

async function createServiceTask(params: {
  serviceId: number;
  stockItemId: number;
  price: number;
  workOrderId: number;
}): Promise<ServiceTask> {
  const repository = new ServiceTaskRepositoryPostgres();

  const task = ServiceTask.create({
    serviceId: params.serviceId,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(45),
    price: Money.create(params.price),
    workOrderId: params.workOrderId,
  });

  return repository.create(task);
}

describe("WorkOrderRepositoryPostgres", () => {
  beforeAll(async () => {
    await ensureDatabaseConnection();
    await runMigrations();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates and loads a work order with service tasks", async () => {
    const repository = new WorkOrderRepositoryPostgres();
    const vehicleId = await createVehicle();
    const stockItemId = await createStockItem("SKU-WO-1");
    const serviceId = await createService();
    const workOrder = WorkOrder.create({
      vehicleId,
      publicToken: "public-token-1",
      publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });
    const created = await repository.create(workOrder);
    const createdSnapshot = created.toSnapshot();

    expect(createdSnapshot.id).not.toBeNull();

    const serviceTask = await createServiceTask({
      serviceId,
      stockItemId,
      price: 250,
      workOrderId: createdSnapshot.id ?? 0,
    });
    const serviceTaskSnapshot = serviceTask.toSnapshot();

    created.syncServiceTasks({
      tasks: [
        {
          serviceTaskId: serviceTaskSnapshot.id ?? 0,
          status: serviceTaskSnapshot.status,
          amount: Money.create(250),
        },
      ],
      now: new Date("2024-01-10T08:30:00.000Z"),
    });

    await repository.save(created);

    const found = await repository.findById(createdSnapshot.id ?? 0);

    expect(found).not.toBeNull();
    expect(found?.toSnapshot()).toMatchObject({
      vehicleId,
      totalAmount: 250,
      serviceTasks: [
        {
          serviceTaskId: serviceTaskSnapshot.id,
          status: ServiceTaskStatus.PENDING_APPROVAL,
          amount: 250,
        },
      ],
    });
  });

  it("updates work order status and service tasks", async () => {
    const repository = new WorkOrderRepositoryPostgres();
    const vehicleId = await createVehicle();
    const stockItemId = await createStockItem("SKU-WO-2");
    const serviceId = await createService();
    const workOrder = WorkOrder.create({
      vehicleId,
      publicToken: "public-token-2",
      publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });
    const created = await repository.create(workOrder);
    const createdSnapshot = created.toSnapshot();

    const serviceTask = await createServiceTask({
      serviceId,
      stockItemId,
      price: 180,
      workOrderId: createdSnapshot.id ?? 0,
    });
    const serviceTaskSnapshot = serviceTask.toSnapshot();

    created.syncServiceTasks({
      tasks: [
        {
          serviceTaskId: serviceTaskSnapshot.id ?? 0,
          status: serviceTaskSnapshot.status,
          amount: Money.create(180),
        },
      ],
      now: new Date("2024-01-10T08:10:00.000Z"),
    });

    created.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    created.completeDiagnosis(new Date("2024-01-10T08:15:00.000Z"));
    created.updateServiceTaskStatus({
      serviceTaskId: serviceTaskSnapshot.id ?? 0,
      status: ServiceTaskStatus.REJECTED,
      now: new Date("2024-01-10T08:20:00.000Z"),
    });

    await repository.save(created);

    const reloaded = await repository.findById(created.toSnapshot().id ?? 0);

    expect(reloaded?.toSnapshot()).toMatchObject({
      status: "CANCELED",
      totalAmount: 0,
      serviceTasks: [
        {
          serviceTaskId: serviceTaskSnapshot.id,
          status: ServiceTaskStatus.REJECTED,
          amount: 180,
        },
      ],
    });
  });

  it("finds a work order by public token", async () => {
    const repository = new WorkOrderRepositoryPostgres();
    const vehicleId = await createVehicle();
    const stockItemId = await createStockItem("SKU-WO-5");
    const serviceId = await createService();
    const workOrder = WorkOrder.create({
      vehicleId,
      publicToken: "public-token-find",
      publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });
    const created = await repository.create(workOrder);
    const createdSnapshot = created.toSnapshot();

    const serviceTask = await createServiceTask({
      serviceId,
      stockItemId,
      price: 210,
      workOrderId: createdSnapshot.id ?? 0,
    });
    const serviceTaskSnapshot = serviceTask.toSnapshot();

    created.syncServiceTasks({
      tasks: [
        {
          serviceTaskId: serviceTaskSnapshot.id ?? 0,
          status: serviceTaskSnapshot.status,
          amount: Money.create(210),
        },
      ],
      now: new Date("2024-01-10T08:10:00.000Z"),
    });

    await repository.save(created);

    const found = await repository.findByPublicToken("public-token-find");

    expect(found).not.toBeNull();
    expect(found?.toSnapshot()).toMatchObject({
      vehicleId,
      publicToken: "public-token-find",
    });
  });

  it("lists all work orders", async () => {
    const repository = new WorkOrderRepositoryPostgres();
    const vehicleId = await createVehicle();
    const stockItemId = await createStockItem("SKU-WO-3");
    const serviceId = await createService();
    const first = WorkOrder.create({
      vehicleId,
      publicToken: "public-token-3",
      publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
    });

    const second = WorkOrder.create({
      vehicleId,
      publicToken: "public-token-4",
      publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
      createdAt: new Date("2024-01-10T09:00:00.000Z"),
    });
    const firstCreated = await repository.create(first);
    const secondCreated = await repository.create(second);

    const firstCreatedSnapshot = firstCreated.toSnapshot();
    const secondCreatedSnapshot = secondCreated.toSnapshot();

    const firstServiceTask = await createServiceTask({
      serviceId,
      stockItemId,
      price: 90,
      workOrderId: firstCreatedSnapshot.id ?? 0,
    });
    const secondServiceTask = await createServiceTask({
      serviceId,
      stockItemId,
      price: 120,
      workOrderId: secondCreatedSnapshot.id ?? 0,
    });

    const firstServiceTaskSnapshot = firstServiceTask.toSnapshot();
    const secondServiceTaskSnapshot = secondServiceTask.toSnapshot();

    firstCreated.syncServiceTasks({
      tasks: [
        {
          serviceTaskId: firstServiceTaskSnapshot.id ?? 0,
          status: firstServiceTaskSnapshot.status,
          amount: Money.create(90),
        },
      ],
      now: new Date("2024-01-10T08:10:00.000Z"),
    });

    secondCreated.syncServiceTasks({
      tasks: [
        {
          serviceTaskId: secondServiceTaskSnapshot.id ?? 0,
          status: secondServiceTaskSnapshot.status,
          amount: Money.create(120),
        },
      ],
      now: new Date("2024-01-10T09:10:00.000Z"),
    });

    await repository.save(firstCreated);
    await repository.save(secondCreated);

    const workOrders = await repository.findAll();

    expect(workOrders).toHaveLength(2);
  });
});
