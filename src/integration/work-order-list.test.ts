import { beforeAll, beforeEach, describe, expect, it } from "bun:test";

import { ensureDatabaseConnection, pool } from "../infrastructure/db";
import { runMigrations } from "../infrastructure/db/migrate";
import { ListWorkOrders } from "../application/work-order/list-work-orders";
import { WorkOrderRepositoryPostgres } from "../infrastructure/work-order/work-order-repository-postgres";
import { PersonRepositoryPostgres } from "../infrastructure/person/person-repository-postgres";
import { VehicleRepositoryPostgres } from "../infrastructure/vehicle/vehicle-repository-postgres";
import { Person } from "../domain/person/aggregate/person";
import { PersonName } from "../domain/person/value-object/person-name";
import { PersonDocument } from "../domain/person/value-object/person-document";
import { PersonPhone } from "../domain/person/value-object/person-phone";
import { PersonEmail } from "../domain/person/value-object/person-email";
import { PersonRole } from "../domain/person/value-object/person-role";
import { Vehicle } from "../domain/vehicle/aggregate/vehicle";
import { VehiclePlate } from "../domain/vehicle/value-object/vehicle-plate";
import { VehicleModel } from "../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../domain/vehicle/value-object/vehicle-year";
import { WorkOrder } from "../domain/work-order/aggregate/work-order";
import { WorkOrderStatus } from "../domain/work-order/value-object/work-order-status";
import { Money } from "../domain/shared/value-object/money";

async function resetDatabase(): Promise<void> {
  await pool.query(
    "TRUNCATE TABLE work_orders, service_tasks, service_stock_items, services, vehicles, person, stock_items RESTART IDENTITY CASCADE",
  );
}

async function createVehicleId(): Promise<number> {
  const personRepository = new PersonRepositoryPostgres();
  const vehicleRepository = new VehicleRepositoryPostgres();

  const person = Person.create({
    name: PersonName.create("Queue Customer"),
    document: PersonDocument.create("52998224725"),
    phone: PersonPhone.create("+5511999999999"),
    email: PersonEmail.create("queue.customer@example.com"),
    role: PersonRole.CUSTOMER,
  });

  const createdPerson = await personRepository.create(person);
  const personId = createdPerson.toSnapshot().id ?? 0;

  const vehicle = Vehicle.create({
    plate: VehiclePlate.create("QST-4321"),
    model: VehicleModel.create("Civic"),
    year: VehicleYear.create(2020),
    ownerPersonId: personId,
  });

  const createdVehicle = await vehicleRepository.create(vehicle);
  return createdVehicle.toSnapshot().id ?? 0;
}

function buildWorkOrder(params: {
  vehicleId: number;
  status: WorkOrderStatus;
  publicToken: string;
  createdAt: string;
  updatedAt: string;
}): WorkOrder {
  return WorkOrder.rehydrate({
    id: 0,
    vehicleId: params.vehicleId,
    status: params.status,
    totalAmount: Money.create(0),
    publicToken: params.publicToken,
    publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
    createdAt: new Date(params.createdAt),
    updatedAt: new Date(params.updatedAt),
    serviceTasks: [],
  });
}

describe("Work order list integration", () => {
  beforeAll(async () => {
    await ensureDatabaseConnection();
    await runMigrations();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("excludes finalized and delivered work orders from operational queue", async () => {
    const workOrderRepository = new WorkOrderRepositoryPostgres();
    const listWorkOrders = new ListWorkOrders(workOrderRepository);
    const vehicleId = await createVehicleId();

    await workOrderRepository.create(
      buildWorkOrder({
        vehicleId,
        status: WorkOrderStatus.RECEIVED,
        publicToken: "queue-received",
        createdAt: "2024-01-10T08:00:00.000Z",
        updatedAt: "2024-01-10T08:00:00.000Z",
      }),
    );
    await workOrderRepository.create(
      buildWorkOrder({
        vehicleId,
        status: WorkOrderStatus.FINALIZED,
        publicToken: "queue-finalized",
        createdAt: "2024-01-10T08:10:00.000Z",
        updatedAt: "2024-01-10T08:10:00.000Z",
      }),
    );
    await workOrderRepository.create(
      buildWorkOrder({
        vehicleId,
        status: WorkOrderStatus.DELIVERED,
        publicToken: "queue-delivered",
        createdAt: "2024-01-10T08:20:00.000Z",
        updatedAt: "2024-01-10T08:20:00.000Z",
      }),
    );

    const result = await listWorkOrders.execute();

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe(WorkOrderStatus.RECEIVED);
  });

  it("returns deterministic operational order by status priority, updatedAt and id", async () => {
    const workOrderRepository = new WorkOrderRepositoryPostgres();
    const listWorkOrders = new ListWorkOrders(workOrderRepository);
    const vehicleId = await createVehicleId();

    const waitingApprovalFirst = await workOrderRepository.create(
      buildWorkOrder({
        vehicleId,
        status: WorkOrderStatus.WAITING_APPROVAL,
        publicToken: "queue-waiting-1",
        createdAt: "2024-01-10T09:00:00.000Z",
        updatedAt: "2024-01-10T10:00:00.000Z",
      }),
    );
    const diagnosis = await workOrderRepository.create(
      buildWorkOrder({
        vehicleId,
        status: WorkOrderStatus.DIAGNOSIS,
        publicToken: "queue-diagnosis",
        createdAt: "2024-01-10T09:10:00.000Z",
        updatedAt: "2024-01-10T07:00:00.000Z",
      }),
    );
    const inExecution = await workOrderRepository.create(
      buildWorkOrder({
        vehicleId,
        status: WorkOrderStatus.IN_EXECUTION,
        publicToken: "queue-execution",
        createdAt: "2024-01-10T09:20:00.000Z",
        updatedAt: "2024-01-10T11:00:00.000Z",
      }),
    );
    const waitingApprovalSecond = await workOrderRepository.create(
      buildWorkOrder({
        vehicleId,
        status: WorkOrderStatus.WAITING_APPROVAL,
        publicToken: "queue-waiting-2",
        createdAt: "2024-01-10T09:30:00.000Z",
        updatedAt: "2024-01-10T10:00:00.000Z",
      }),
    );
    const received = await workOrderRepository.create(
      buildWorkOrder({
        vehicleId,
        status: WorkOrderStatus.RECEIVED,
        publicToken: "queue-received-last",
        createdAt: "2024-01-10T09:40:00.000Z",
        updatedAt: "2024-01-10T06:00:00.000Z",
      }),
    );

    const result = await listWorkOrders.execute();

    expect(result.map((workOrder) => workOrder.status)).toEqual([
      WorkOrderStatus.IN_EXECUTION,
      WorkOrderStatus.WAITING_APPROVAL,
      WorkOrderStatus.WAITING_APPROVAL,
      WorkOrderStatus.DIAGNOSIS,
      WorkOrderStatus.RECEIVED,
    ]);
    expect(result.map((workOrder) => workOrder.id)).toEqual([
      inExecution.toSnapshot().id,
      waitingApprovalFirst.toSnapshot().id,
      waitingApprovalSecond.toSnapshot().id,
      diagnosis.toSnapshot().id,
      received.toSnapshot().id,
    ]);
  });
});
