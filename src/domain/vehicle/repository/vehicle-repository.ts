import type { Vehicle } from "../aggregate/vehicle";
import type { VehiclePlate } from "../value-object/vehicle-plate";

export interface VehicleRepository {
  create(vehicle: Vehicle): Promise<Vehicle>;
  findById(id: number): Promise<Vehicle | null>;
  findByPlate(plate: VehiclePlate): Promise<Vehicle | null>;
  findAll(): Promise<Vehicle[]>;
  save(vehicle: Vehicle): Promise<void>;
  delete(id: number): Promise<void>;
}
