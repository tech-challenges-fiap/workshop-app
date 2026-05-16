import { beforeAll, describe, expect, it } from "bun:test";

import { db, ensureDatabaseConnection } from "../db";
import { runMigrations } from "../db/migrate";
import { services, serviceRequiredStockItems } from "../db/schema/service";
import { serviceTasks } from "../db/schema/service-task";
import { ServiceRepositoryPostgres } from "./service-repository-postgres";
import { Service } from "../../domain/service/aggregate/service";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { Money } from "../../domain/shared/value-object/money";

describe("ServiceRepositoryPostgres", () => {
  const repository = new ServiceRepositoryPostgres();

  beforeAll(async () => {
    await ensureDatabaseConnection();
    await runMigrations();
    // Ensure tables are empty for deterministic tests
    await db.delete(serviceRequiredStockItems);
    await db.delete(serviceTasks);
    await db.delete(services);
  });

  it("persists and retrieves service price correctly", async () => {
    const service = Service.create({
      name: ServiceName.create("Wheel Alignment"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(60),
      price: Money.create(199.9),
      requiredItems: [],
    });

    const created = await repository.create(service);
    const snapshot = created.toSnapshot();

    expect(snapshot.id).not.toBeNull();
    expect(snapshot.price).toBe(199.9);

    const found = await repository.findById(snapshot.id!);
    expect(found).not.toBeNull();

    const foundSnapshot = found!.toSnapshot();
    expect(foundSnapshot.price).toBe(199.9);
  });

  it("updates service price correctly", async () => {
    const service = Service.create({
      name: ServiceName.create("Basic Service"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
      price: Money.create(50),
      requiredItems: [],
    });

    const created = await repository.create(service);

    const updatedPrice = Money.create(75.5);
    created.updateDetails({
      name: ServiceName.create("Basic Service"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
      price: updatedPrice,
      requiredItems: [],
    });

    await repository.save(created);

    const reloaded = await repository.findById(created.toSnapshot().id!);
    expect(reloaded).not.toBeNull();

    const reloadedSnapshot = reloaded!.toSnapshot();
    expect(reloadedSnapshot.price).toBe(75.5);
  });
});
