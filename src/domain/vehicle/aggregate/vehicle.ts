import { VehiclePlate } from "../value-object/vehicle-plate";
import { VehicleModel } from "../value-object/vehicle-model";
import { VehicleYear } from "../value-object/vehicle-year";
import { VehicleBrand } from "../value-object/vehicle-brand";

export interface VehicleSnapshot {
  readonly id: number | null;
  readonly plate: string;
  readonly brand: string;
  readonly model: string;
  readonly year: number;
  readonly ownerPersonId: number;
}

export class Vehicle {
  private readonly id: number | null;
  private plate: VehiclePlate;
  private brand: VehicleBrand;
  private model: VehicleModel;
  private year: VehicleYear;
  private ownerPersonId: number;

  private constructor(params: {
    id: number | null;
    plate: VehiclePlate;
    brand: VehicleBrand;
    model: VehicleModel;
    year: VehicleYear;
    ownerPersonId: number;
  }) {
    this.id = params.id;
    this.plate = params.plate;
    this.brand = params.brand;
    this.model = params.model;
    this.year = params.year;
    this.ownerPersonId = params.ownerPersonId;
  }

  public static create(params: {
    plate: VehiclePlate;
    brand?: VehicleBrand;
    model: VehicleModel;
    year: VehicleYear;
    ownerPersonId: number;
  }): Vehicle {
    const brand = params.brand ?? VehicleBrand.create("UNKNOWN");
    return new Vehicle({
      id: null,
      plate: params.plate,
      brand,
      model: params.model,
      year: params.year,
      ownerPersonId: params.ownerPersonId,
    });
  }

  public static rehydrate(params: {
    id: number;
    plate: VehiclePlate;
    brand?: VehicleBrand;
    model: VehicleModel;
    year: VehicleYear;
    ownerPersonId: number;
  }): Vehicle {
    const brand = params.brand ?? VehicleBrand.create("UNKNOWN");
    return new Vehicle({
      id: params.id,
      plate: params.plate,
      brand,
      model: params.model,
      year: params.year,
      ownerPersonId: params.ownerPersonId,
    });
  }

  public update(params: {
    brand?: VehicleBrand;
    model?: VehicleModel;
    year?: VehicleYear;
    ownerPersonId?: number;
    plate?: VehiclePlate;
  }): void {
    if (params.brand) this.brand = params.brand;
    if (params.model) this.model = params.model;
    if (params.year) this.year = params.year;
    if (typeof params.ownerPersonId === "number") this.ownerPersonId = params.ownerPersonId;
    if (params.plate) this.plate = params.plate;
  }

  public toSnapshot(): VehicleSnapshot {
    return {
      id: this.id,
      plate: this.plate.toString(),
      brand: this.brand.toString(),
      model: this.model.toString(),
      year: this.year.toNumber(),
      ownerPersonId: this.ownerPersonId,
    };
  }
}
