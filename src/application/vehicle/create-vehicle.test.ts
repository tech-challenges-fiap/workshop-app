import { describe, expect, it } from "bun:test";

import { CreateVehicle } from "./create-vehicle";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import { VehicleBrand } from "../../domain/vehicle/value-object/vehicle-brand";
import { VehicleModel } from "../../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../../domain/vehicle/value-object/vehicle-year";
import type { PersonRepository } from "../../domain/person/repository/person-repository";
import type { Person } from "../../domain/person/aggregate/person";
import type { PersonDocument } from "../../domain/person/value-object/person-document";
import { PlateAlreadyExists } from "../../domain/vehicle/domain-error/plate-already-exists";
import { PersonNotFound } from "../../domain/person/domain-error/person-not-found";

class InMemoryVehicleRepository implements VehicleRepository {
  private vehicles: Vehicle[] = [];
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
    this.vehicles.push(created);
    return created;
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
    const index = this.vehicles.findIndex((v) => v.toSnapshot().id === vehicle.toSnapshot().id);
    if (index !== -1) {
      this.vehicles[index] = vehicle;
    }
  }

  public async delete(id: number): Promise<void> {
    this.vehicles = this.vehicles.filter((v) => v.toSnapshot().id !== id);
  }

  // Helper for testing setup
  public add(vehicle: Vehicle) {
    this.vehicles.push(vehicle);
  }
}

class InMemoryPersonRepository implements PersonRepository {
  constructor(private readonly existingIds: number[] = [1]) {}

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

describe("CreateVehicle", () => {
  it("creates a vehicle successfully", async () => {
    const repo = new InMemoryVehicleRepository();
    const personRepo = new InMemoryPersonRepository();
    const useCase = new CreateVehicle(repo, personRepo);

    const result = await useCase.execute({
      plate: "ABC-1234",
      brand: "Honda",
      model: "Civic",
      year: 2022,
      ownerPersonId: 1,
    });

    expect(result.id).toBe(1);
    expect(result.plate).toBe("ABC-1234");
    expect(result.brand).toBe("Honda");
    expect(result.model).toBe("Civic");
  });

  it("throws if plate already exists", async () => {
    const repo = new InMemoryVehicleRepository();
    repo.add(
      Vehicle.create({
        plate: VehiclePlate.create("ABC-1234"),
        brand: VehicleBrand.create("Old Brand"),
        model: VehicleModel.create("Old Car"),
        year: VehicleYear.create(2000),
        ownerPersonId: 1,
      }),
    );

    const personRepo = new InMemoryPersonRepository();
    const useCase = new CreateVehicle(repo, personRepo);

    expect(
      useCase.execute({
        plate: "ABC-1234",
        brand: "Honda",
        model: "Civic",
        year: 2022,
        ownerPersonId: 1,
      }),
    ).rejects.toThrow(PlateAlreadyExists);
  });

  it("throws if owner person does not exist", async () => {
    const repo = new InMemoryVehicleRepository();
    const personRepo = new InMemoryPersonRepository([]);
    const useCase = new CreateVehicle(repo, personRepo);

    expect(
      useCase.execute({
        plate: "ABC1A23",
        brand: "Honda",
        model: "Civic",
        year: 2022,
        ownerPersonId: 999,
      }),
    ).rejects.toThrow(PersonNotFound);
  });
});
