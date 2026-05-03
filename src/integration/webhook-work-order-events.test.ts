import { beforeAll, beforeEach, describe, expect, it } from "bun:test";

import { ensureDatabaseConnection, pool } from "../infrastructure/db";
import { runMigrations } from "../infrastructure/db/migrate";
import { createApp } from "../bootstrap/create-app";
import { PersonRepositoryPostgres } from "../infrastructure/person/person-repository-postgres";
import { VehicleRepositoryPostgres } from "../infrastructure/vehicle/vehicle-repository-postgres";
import { ServiceRepositoryPostgres } from "../infrastructure/service/service-repository-postgres";
import { ServiceTaskRepositoryPostgres } from "../infrastructure/service-task/service-task-repository-postgres";
import { WorkOrderRepositoryPostgres } from "../infrastructure/work-order/work-order-repository-postgres";
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
import { Service } from "../domain/service/aggregate/service";
import { ServiceName } from "../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../domain/service/value-object/service-estimated-time";
import { WorkOrder } from "../domain/work-order/aggregate/work-order";
import { WorkOrderStatus } from "../domain/work-order/value-object/work-order-status";
import { ServiceTask } from "../domain/service-task/aggregate/service-task";
import { ServiceTaskStatus } from "../domain/service-task/value-object/service-task-status";
import { Money } from "../domain/shared/value-object/money";

async function resetDatabase(): Promise<void> {
  await pool.query(
    "TRUNCATE TABLE work_order_webhook_events, work_orders, service_tasks, service_stock_items, services, vehicles, person, stock_items RESTART IDENTITY CASCADE",
  );
}

async function createPersonId(): Promise<number> {
  const personRepository = new PersonRepositoryPostgres();
  const person = Person.create({
    name: PersonName.create("Webhook Customer"),
    document: PersonDocument.create("52998224725"),
    phone: PersonPhone.create("+5511999999999"),
    email: PersonEmail.create("webhook.customer@example.com"),
    role: PersonRole.CUSTOMER,
  });

  const created = await personRepository.create(person);
  return created.toSnapshot().id ?? 0;
}

async function createVehicleId(ownerPersonId: number): Promise<number> {
  const vehicleRepository = new VehicleRepositoryPostgres();
  const vehicle = Vehicle.create({
    plate: VehiclePlate.create("WHK-1234"),
    model: VehicleModel.create("Corolla"),
    year: VehicleYear.create(2022),
    ownerPersonId,
  });

  const created = await vehicleRepository.create(vehicle);
  return created.toSnapshot().id ?? 0;
}

async function createServiceId(): Promise<number> {
  const serviceRepository = new ServiceRepositoryPostgres();
  const service = Service.create({
    name: ServiceName.create("External Approval Service"),
    estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
    price: Money.create(200),
    requiredItems: [],
  });

  const created = await serviceRepository.create(service);
  return created.toSnapshot().id ?? 0;
}

async function createWaitingApprovalFixture(): Promise<{
  workOrderId: number;
  serviceTaskId: number;
}> {
  const workOrderRepository = new WorkOrderRepositoryPostgres();
  const serviceTaskRepository = new ServiceTaskRepositoryPostgres();
  const personId = await createPersonId();
  const vehicleId = await createVehicleId(personId);
  const serviceId = await createServiceId();

  const workOrder = WorkOrder.create({
    vehicleId,
    publicToken: "webhook-public-token",
    publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
    createdAt: new Date("2024-01-10T08:00:00.000Z"),
  });

  const createdWorkOrder = await workOrderRepository.create(workOrder);
  const workOrderId = createdWorkOrder.toSnapshot().id ?? 0;

  const serviceTask = ServiceTask.create({
    serviceId,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(45),
    price: Money.create(200),
    workOrderId,
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
    now: new Date("2024-01-10T08:10:00.000Z"),
  });
  createdWorkOrder.startDiagnosis(new Date("2024-01-10T08:20:00.000Z"));
  createdWorkOrder.completeDiagnosis(new Date("2024-01-10T08:30:00.000Z"));
  await workOrderRepository.save(createdWorkOrder);

  return { workOrderId, serviceTaskId };
}

async function createReceivedWorkOrderFixture(): Promise<{ workOrderId: number }> {
  const workOrderRepository = new WorkOrderRepositoryPostgres();
  const personId = await createPersonId();
  const vehicleId = await createVehicleId(personId);

  const created = await workOrderRepository.create(
    WorkOrder.create({
      vehicleId,
      publicToken: "webhook-status-token",
      publicTokenExpiresAt: new Date("2099-01-10T12:00:00.000Z"),
      createdAt: new Date("2024-01-10T09:00:00.000Z"),
    }),
  );

  return { workOrderId: created.toSnapshot().id ?? 0 };
}

describe("Webhook work-order events integration", () => {
  beforeAll(async () => {
    await ensureDatabaseConnection();
    await runMigrations();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("processes approval event and returns duplicate on retries by event id", async () => {
    const app = createApp();
    const workOrderRepository = new WorkOrderRepositoryPostgres();
    const serviceTaskRepository = new ServiceTaskRepositoryPostgres();
    const { workOrderId, serviceTaskId } = await createWaitingApprovalFixture();

    const payload = {
      eventId: "evt-approve-1",
      eventType: "SERVICE_TASK_APPROVED",
      workOrderId,
      serviceTaskId,
      occurredAt: "2024-01-10T10:00:00.000Z",
    };

    const firstResponse = await app.request("/webhooks/work-orders/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    expect(firstResponse.status).toBe(200);
    expect(await firstResponse.json()).toMatchObject({
      eventId: "evt-approve-1",
      eventType: "SERVICE_TASK_APPROVED",
      result: "processed",
    });

    const secondResponse = await app.request("/webhooks/work-orders/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.json()).toMatchObject({
      eventId: "evt-approve-1",
      eventType: "SERVICE_TASK_APPROVED",
      result: "duplicate",
    });

    const updatedTask = await serviceTaskRepository.findById(serviceTaskId);
    const updatedWorkOrder = await workOrderRepository.findById(workOrderId);

    expect(updatedTask?.toSnapshot().status).toBe(ServiceTaskStatus.APPROVED);
    expect(updatedWorkOrder?.toSnapshot().status).toBe(WorkOrderStatus.READY);
  });

  it("returns 400 for invalid webhook payload", async () => {
    const app = createApp();

    const response = await app.request("/webhooks/work-orders/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId: "evt-invalid",
        eventType: "SERVICE_TASK_APPROVED",
        workOrderId: 1,
      }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 409 when requested status transition is not allowed", async () => {
    const app = createApp();
    const { workOrderId } = await createReceivedWorkOrderFixture();

    const response = await app.request("/webhooks/work-orders/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId: "evt-status-conflict",
        eventType: "WORK_ORDER_STATUS_UPDATED",
        workOrderId,
        targetStatus: WorkOrderStatus.DELIVERED,
        occurredAt: "2024-01-10T11:00:00.000Z",
      }),
    });

    expect(response.status).toBe(409);
  });
});
