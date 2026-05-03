import { eq } from "drizzle-orm";

import { db } from "../db";
import { vehicles } from "../db/schema/vehicle";
import { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import { VehicleBrand } from "../../domain/vehicle/value-object/vehicle-brand";
import { VehicleModel } from "../../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../../domain/vehicle/value-object/vehicle-year";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import { PlateAlreadyExists } from "../../domain/vehicle/domain-error/plate-already-exists";

type QueryExecutor = Pick<typeof db, "insert" | "select" | "update" | "delete">;

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };

  if (candidate.code === "23505") {
    return true;
  }

  if (candidate.cause && typeof candidate.cause === "object") {
    const causeWithCode = candidate.cause as { code?: unknown };
    if (causeWithCode.code === "23505") {
      return true;
    }
  }

  return false;
}

export class VehicleRepositoryPostgres implements VehicleRepository {
  constructor(private readonly queryExecutor: QueryExecutor = db) {}

  public async create(vehicle: Vehicle): Promise<Vehicle> {
    const snapshot = vehicle.toSnapshot();

    try {
      const [row] = await this.queryExecutor
        .insert(vehicles)
        .values({
          brand: snapshot.brand,
          plate: snapshot.plate,
          model: snapshot.model,
          year: snapshot.year,
          ownerPersonId: snapshot.ownerPersonId,
        })
        .returning();

      return Vehicle.rehydrate({
        id: row.id,
        plate: VehiclePlate.create(row.plate),
        brand: VehicleBrand.create(row.brand),
        model: VehicleModel.create(row.model),
        year: VehicleYear.create(row.year),
        ownerPersonId: row.ownerPersonId,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PlateAlreadyExists(snapshot.plate);
      }
      throw error;
    }
  }

  public async findById(id: number): Promise<Vehicle | null> {
    const [row] = await this.queryExecutor.select().from(vehicles).where(eq(vehicles.id, id));

    if (!row) {
      return null;
    }

    return Vehicle.rehydrate({
      id: row.id,
      plate: VehiclePlate.create(row.plate),
      brand: VehicleBrand.create(row.brand),
      model: VehicleModel.create(row.model),
      year: VehicleYear.create(row.year),
      ownerPersonId: row.ownerPersonId,
    });
  }

  public async findByPlate(plate: VehiclePlate): Promise<Vehicle | null> {
    const [row] = await this.queryExecutor
      .select()
      .from(vehicles)
      .where(eq(vehicles.plate, plate.toString()));

    if (!row) {
      return null;
    }

    return Vehicle.rehydrate({
      id: row.id,
      plate: VehiclePlate.create(row.plate),
      brand: VehicleBrand.create(row.brand),
      model: VehicleModel.create(row.model),
      year: VehicleYear.create(row.year),
      ownerPersonId: row.ownerPersonId,
    });
  }

  public async findAll(): Promise<Vehicle[]> {
    const rows = await this.queryExecutor.select().from(vehicles);

    return rows.map((row) =>
      Vehicle.rehydrate({
        id: row.id,
        plate: VehiclePlate.create(row.plate),
        brand: VehicleBrand.create(row.brand),
        model: VehicleModel.create(row.model),
        year: VehicleYear.create(row.year),
        ownerPersonId: row.ownerPersonId,
      }),
    );
  }

  public async save(vehicle: Vehicle): Promise<void> {
    const snapshot = vehicle.toSnapshot();

    if (!snapshot.id) {
      throw new Error("Cannot save vehicle without ID");
    }

    try {
      await this.queryExecutor
        .update(vehicles)
        .set({
          plate: snapshot.plate,
          brand: snapshot.brand,
          model: snapshot.model,
          year: snapshot.year,
          ownerPersonId: snapshot.ownerPersonId,
          updatedAt: new Date(),
        })
        .where(eq(vehicles.id, snapshot.id));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PlateAlreadyExists(snapshot.plate);
      }
      throw error;
    }
  }

  public async delete(id: number): Promise<void> {
    await this.queryExecutor.delete(vehicles).where(eq(vehicles.id, id));
  }
}
