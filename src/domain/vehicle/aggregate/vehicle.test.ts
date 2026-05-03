import { describe, expect, it } from "bun:test";
import { Vehicle } from "./vehicle";
import { VehicleBrand } from "../value-object/vehicle-brand";
import { VehiclePlate } from "../value-object/vehicle-plate";
import { VehicleModel } from "../value-object/vehicle-model";
import { VehicleYear } from "../value-object/vehicle-year";

describe("Vehicle", () => {
  it("creates a vehicle with valid data", () => {
    const plate = VehiclePlate.create("ABC-1234");
    const brand = VehicleBrand.create("Honda");
    const model = VehicleModel.create("Civic");
    const year = VehicleYear.create(2022);
    const ownerPersonId = 1;

    const vehicle = Vehicle.create({
      plate,
      brand,
      model,
      year,
      ownerPersonId,
    });

    const snapshot = vehicle.toSnapshot();
    expect(snapshot.id).toBeNull();
    expect(snapshot.plate).toBe("ABC-1234");
    expect(snapshot.brand).toBe("Honda");
    expect(snapshot.model).toBe("Civic");
    expect(snapshot.year).toBe(2022);
    expect(snapshot.ownerPersonId).toBe(1);
  });

  it("rehydrates a vehicle", () => {
    const id = 1;
    const plate = VehiclePlate.create("XYZ-9876");
    const brand = VehicleBrand.create("Toyota");
    const model = VehicleModel.create("Corolla");
    const year = VehicleYear.create(2020);
    const ownerPersonId = 2;

    const vehicle = Vehicle.rehydrate({
      id,
      plate,
      brand,
      model,
      year,
      ownerPersonId,
    });

    const snapshot = vehicle.toSnapshot();
    expect(snapshot.id).toBe(1);
    expect(snapshot.plate).toBe("XYZ-9876");
    expect(snapshot.brand).toBe("Toyota");
  });

  it("updates vehicle details", () => {
    const vehicle = Vehicle.create({
      brand: VehicleBrand.create("Honda"),
      plate: VehiclePlate.create("ABC-1234"),
      model: VehicleModel.create("Civic"),
      year: VehicleYear.create(2022),
      ownerPersonId: 1,
    });

    vehicle.update({
      brand: VehicleBrand.create("Acura"),
      model: VehicleModel.create("Civic Type R"),
      ownerPersonId: 2,
    });

    const snapshot = vehicle.toSnapshot();
    expect(snapshot.model).toBe("Civic Type R");
    expect(snapshot.ownerPersonId).toBe(2);
    expect(snapshot.year).toBe(2022); // Unchanged
    expect(snapshot.brand).toBe("Acura");
  });
});
