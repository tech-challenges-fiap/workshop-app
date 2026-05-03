import { describe, expect, it } from "bun:test";

import { GetVehicleByPlate } from "./get-vehicle-by-plate";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import { VehicleBrand } from "../../domain/vehicle/value-object/vehicle-brand";
import { VehicleModel } from "../../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../../domain/vehicle/value-object/vehicle-year";
import { VehicleNotFound } from "../../domain/vehicle/domain-error/vehicle-not-found";

class InMemoryVehicleRepository implements VehicleRepository {
  private vehicles: Vehicle[] = [];

  public async create(vehicle: Vehicle): Promise<Vehicle> {
    this.vehicles.push(vehicle);
    return vehicle;
  }

  public async findById(id: number): Promise<Vehicle | null> {
    return this.vehicles.find((v) => v.toSnapshot().id === id) ?? null;
  }

  public async findByPlate(plate: VehiclePlate): Promise<Vehicle | null> {
    return this.vehicles.find((v) => v.toSnapshot().plate === plate.toString()) ?? null;
  }

  public async findAll(): Promise<Vehicle[]> {
    return this.vehicles;
  }

  public async save(vehicle: Vehicle): Promise<void> {
    const id = vehicle.toSnapshot().id;
    const index = this.vehicles.findIndex((v) => v.toSnapshot().id === id);
    if (index !== -1) {
      this.vehicles[index] = vehicle;
    }
  }

  public async delete(id: number): Promise<void> {
    this.vehicles = this.vehicles.filter((v) => v.toSnapshot().id !== id);
  }

  public add(vehicle: Vehicle): void {
    this.vehicles.push(vehicle);
  }
}

describe("GetVehicleByPlate", () => {
  it("returns vehicle snapshot when found", async () => {
    const repo = new InMemoryVehicleRepository();
    const vehicle = Vehicle.rehydrate({
      id: 1,
      plate: VehiclePlate.create("ABC-1234"),
      brand: VehicleBrand.create("Brand"),
      model: VehicleModel.create("Model"),
      year: VehicleYear.create(2022),
      ownerPersonId: 1,
    });
    repo.add(vehicle);

    const useCase = new GetVehicleByPlate(repo);

    const result = await useCase.execute({ plate: "ABC-1234" });

    expect(result.id).toBe(1);
    expect(result.plate).toBe("ABC-1234");
    expect(result.brand).toBe("Brand");
  });

  it("throws VehicleNotFound when vehicle does not exist", async () => {
    const repo = new InMemoryVehicleRepository();
    const useCase = new GetVehicleByPlate(repo);

    expect(useCase.execute({ plate: "XYZ-9999" })).rejects.toThrow(VehicleNotFound);
  });

  it("propagates VO error when plate is invalid", async () => {
    const repo = new InMemoryVehicleRepository();
    const useCase = new GetVehicleByPlate(repo);

    expect(useCase.execute({ plate: "invalid-plate" })).rejects.toThrow(
      "Invalid vehicle plate format",
    );
  });
});
