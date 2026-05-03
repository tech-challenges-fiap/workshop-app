import type { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";

export type ListVehiclesOutput = ReturnType<Vehicle["toSnapshot"]>[];

export class ListVehicles {
  constructor(private readonly vehicleRepository: VehicleRepository) {}

  public async execute(): Promise<ListVehiclesOutput> {
    const vehicles = await this.vehicleRepository.findAll();
    return vehicles.map((vehicle) => vehicle.toSnapshot());
  }
}
