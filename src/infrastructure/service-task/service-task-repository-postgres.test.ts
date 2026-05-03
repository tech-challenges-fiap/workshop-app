import { beforeAll, beforeEach, describe, expect, it } from "bun:test";

import { ensureDatabaseConnection, pool } from "../db";
import { runMigrations } from "../db/migrate";
import { ServiceTaskRepositoryPostgres } from "./service-task-repository-postgres";
import { ServiceRepositoryPostgres } from "../service/service-repository-postgres";
import { Service } from "../../domain/service/aggregate/service";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { Money } from "../../domain/shared/value-object/money";

async function resetDatabase(): Promise<void> {
  await pool.query(
    "TRUNCATE TABLE work_orders, service_tasks, service_stock_items, services, vehicles, person, stock_items RESTART IDENTITY CASCADE",
  );
}

async function createService(): Promise<number> {
  const repository = new ServiceRepositoryPostgres();
  const service = Service.create({
    name: ServiceName.create("Inspection"),
    estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
    price: Money.create(120),
    requiredItems: [],
  });

  const created = await repository.create(service);
  return created.toSnapshot().id ?? 0;
}

async function createWorkOrder(): Promise<number> {
  const personResult = await pool.query(
    "INSERT INTO person (name, document, phone, email, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    ["Test User", "99999999901", "+5511999990000", "test.user@example.com", "customer"],
  );

  const personId = personResult.rows[0]?.id as number;

  const vehicleResult = await pool.query(
    "INSERT INTO vehicles (plate, brand, model, year, owner_person_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    ["STT-1234", "Ford", "Fiesta", 2019, personId],
  );

  const vehicleId = vehicleResult.rows[0]?.id as number;

  const workOrderResult = await pool.query(
    "INSERT INTO work_orders (vehicle_id, status, total_amount, public_token, public_token_expires_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    [
      vehicleId,
      "RECEIVED",
      "0.00",
      "test-public-token",
      new Date("2099-01-10T12:00:00.000Z"),
      new Date("2024-01-10T08:00:00.000Z"),
      new Date("2024-01-10T08:00:00.000Z"),
    ],
  );

  return workOrderResult.rows[0]?.id as number;
}

describe("ServiceTaskRepositoryPostgres", () => {
  beforeAll(async () => {
    await ensureDatabaseConnection();
    await runMigrations();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates and loads a service task with parts", async () => {
    const serviceTaskRepository = new ServiceTaskRepositoryPostgres();
    const serviceId = await createService();
    const workOrderId = await createWorkOrder();

    const task = ServiceTask.create({
      serviceId,
      estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
      price: Money.create(120),
      workOrderId,
    });

    const created = await serviceTaskRepository.create(task);
    const createdSnapshot = created.toSnapshot();

    expect(createdSnapshot.id).not.toBeNull();
    expect(createdSnapshot.status).toBe(ServiceTaskStatus.PENDING_APPROVAL);

    const found = await serviceTaskRepository.findById(createdSnapshot.id ?? 0);

    expect(found).not.toBeNull();
    expect(found?.toSnapshot()).toMatchObject({
      serviceId,
      status: ServiceTaskStatus.PENDING_APPROVAL,
      estimatedTime: 60,
      price: 120,
    });
  });

  it("updates status and timestamps", async () => {
    const serviceTaskRepository = new ServiceTaskRepositoryPostgres();
    const serviceId = await createService();
    const workOrderId = await createWorkOrder();

    const task = ServiceTask.create({
      serviceId,
      estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
      price: Money.create(120),
      workOrderId,
    });

    const created = await serviceTaskRepository.create(task);
    const createdSnapshot = created.toSnapshot();
    const startedAt = new Date("2024-03-01T10:00:00.000Z");
    const completedAt = new Date("2024-03-01T12:00:00.000Z");

    created.approve();
    created.startExecution(startedAt);
    created.complete(completedAt);

    await serviceTaskRepository.save(created);

    const reloaded = await serviceTaskRepository.findById(createdSnapshot.id ?? 0);

    expect(reloaded).not.toBeNull();
    expect(reloaded?.toSnapshot()).toMatchObject({
      status: ServiceTaskStatus.COMPLETED,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    });
  });

  it("lists all service tasks", async () => {
    const serviceTaskRepository = new ServiceTaskRepositoryPostgres();
    const serviceId = await createService();
    const workOrderId = await createWorkOrder();

    const first = ServiceTask.create({
      serviceId,
      estimatedTime: ServiceEstimatedTime.createFromMinutes(15),
      price: Money.create(120),
      workOrderId,
    });

    const second = ServiceTask.create({
      serviceId,
      estimatedTime: ServiceEstimatedTime.createFromMinutes(45),
      price: Money.create(120),
      workOrderId,
    });

    await serviceTaskRepository.create(first);
    await serviceTaskRepository.create(second);

    const tasks = await serviceTaskRepository.findAll();

    expect(tasks).toHaveLength(2);
  });
});
