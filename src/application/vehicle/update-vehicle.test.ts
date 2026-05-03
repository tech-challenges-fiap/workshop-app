import { describe, expect, it } from "bun:test";

import { UpdateVehicle } from "./update-vehicle";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import { VehicleBrand } from "../../domain/vehicle/value-object/vehicle-brand";
import { VehicleModel } from "../../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../../domain/vehicle/value-object/vehicle-year";
import type { PersonRepository } from "../../domain/person/repository/person-repository";
import type { Person } from "../../domain/person/aggregate/person";
import type { PersonDocument } from "../../domain/person/value-object/person-document";
import { VehicleNotFound } from "../../domain/vehicle/domain-error/vehicle-not-found";
import { PlateAlreadyExists } from "../../domain/vehicle/domain-error/plate-already-exists";
import { PersonNotFound } from "../../domain/person/domain-error/person-not-found";

// Duplicated stub for simplicity, normally would be shared
class InMemoryVehicleRepository implements VehicleRepository {
  public vehicles: Vehicle[] = [];

  public async create(vehicle: Vehicle): Promise<Vehicle> {
    this.vehicles.push(vehicle);
    return vehicle;
  }
  public async findById(id: number): Promise<Vehicle | null> {
    return this.vehicles.find((v) => v.toSnapshot().id === id) || null;
  }
  public async findByPlate(plate: VehiclePlate): Promise<Vehicle | null> {
    return this.vehicles.find((v) => v.toSnapshot().plate === plate.toString()) || null;
  }
  public async findAll(): Promise<Vehicle[]> {
    return this.vehicles;
  }
  public async save(vehicle: Vehicle): Promise<void> {
    const startId = vehicle.toSnapshot().id;
    const index = this.vehicles.findIndex((v) => v.toSnapshot().id === startId);
    if (index !== -1) this.vehicles[index] = vehicle;
  }
  public async delete(id: number): Promise<void> {
    this.vehicles = this.vehicles.filter((v) => v.toSnapshot().id !== id);
  }
}

class InMemoryPersonRepository implements PersonRepository {
  constructor(private readonly existingIds: number[] = [1, 2]) {}

  public async create(person: Person): Promise<Person> {
    void person;
    throw new Error("Not implemented in test repository");
  }

  public async findById(id: number): Promise<Person | null> {
    if (!this.existingIds.includes(id)) {
      return null;
    }

    return {
      toSnapshot: () => ({
        id,
        name: "Person",
        document: "doc",
        phone: "phone",
        email: "email",
        role: "customer",
      }),
    } as unknown as Person;
  }

  public async findByDocument(_document: PersonDocument): Promise<Person | null> {
    void _document;
    throw new Error("Not implemented in test repository");
  }

  public async findAll(): Promise<Person[]> {
    return [];
  }

  public async save(_person: Person): Promise<void> {
    void _person;
    throw new Error("Not implemented in test repository");
  }

  public async delete(_id: number): Promise<void> {
    void _id;
    throw new Error("Not implemented in test repository");
  }
}

describe("UpdateVehicle", () => {
  it("updates vehicle fields", async () => {
    const repo = new InMemoryVehicleRepository();
    const existingVehicle = Vehicle.rehydrate({
      id: 1,
      plate: VehiclePlate.create("ABC-1234"),
      brand: VehicleBrand.create("Honda"),
      model: VehicleModel.create("Civic"),
      year: VehicleYear.create(2022),
      ownerPersonId: 1,
    });
    repo.vehicles.push(existingVehicle);

    const personRepo = new InMemoryPersonRepository();
    const useCase = new UpdateVehicle(repo, personRepo);
    const result = await useCase.execute({
      id: 1,
      brand: "Acura",
      model: "Civic 2.0",
      ownerPersonId: 2,
    });

    expect(result.model).toBe("Civic 2.0");
    expect(result.brand).toBe("Acura");
    expect(result.ownerPersonId).toBe(2);
    expect(result.year).toBe(2022); // unchanged
  });

  it("throws if vehicle not found", async () => {
    const repo = new InMemoryVehicleRepository();
    const personRepo = new InMemoryPersonRepository();
    const useCase = new UpdateVehicle(repo, personRepo);

    expect(useCase.execute({ id: 999, model: "New" })).rejects.toThrow(VehicleNotFound);
  });

  it("throws if updating plate to an existing one", async () => {
    const repo = new InMemoryVehicleRepository();

    // Vehicle 1
    repo.vehicles.push(
      Vehicle.rehydrate({
        id: 1,
        plate: VehiclePlate.create("ABC-1111"),
        brand: VehicleBrand.create("Brand 1"),
        model: VehicleModel.create("Car 1"),
        year: VehicleYear.create(2020),
        ownerPersonId: 1,
      }),
    );

    // Vehicle 2
    repo.vehicles.push(
      Vehicle.rehydrate({
        id: 2,
        plate: VehiclePlate.create("ABC-2222"),
        brand: VehicleBrand.create("Brand 2"),
        model: VehicleModel.create("Car 2"),
        year: VehicleYear.create(2020),
        ownerPersonId: 2,
      }),
    );

    const personRepo = new InMemoryPersonRepository();
    const useCase = new UpdateVehicle(repo, personRepo);

    // Try to update Vehicle 1 to have Vehicle 2's plate
    expect(
      useCase.execute({
        id: 1,
        plate: "ABC-2222",
      }),
    ).rejects.toThrow(PlateAlreadyExists);
  });

  it("throws if new owner person does not exist", async () => {
    const repo = new InMemoryVehicleRepository();
    repo.vehicles.push(
      Vehicle.rehydrate({
        id: 1,
        plate: VehiclePlate.create("OWN-0001"),
        brand: VehicleBrand.create("Brand"),
        model: VehicleModel.create("Car"),
        year: VehicleYear.create(2021),
        ownerPersonId: 1,
      }),
    );

    const personRepo = new InMemoryPersonRepository([]);
    const useCase = new UpdateVehicle(repo, personRepo);

    expect(
      useCase.execute({
        id: 1,
        ownerPersonId: 999,
      }),
    ).rejects.toThrow(PersonNotFound);
  });
});
