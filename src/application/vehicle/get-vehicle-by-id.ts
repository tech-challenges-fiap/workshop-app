import type { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehicleNotFound } from "../../domain/vehicle/domain-error/vehicle-not-found";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";

export interface GetVehicleByIdInput {
  id: number;
}

export type GetVehicleByIdOutput = ReturnType<Vehicle["toSnapshot"]>;

export class GetVehicleById {
  constructor(private readonly vehicleRepository: VehicleRepository) {}

  public async execute(input: GetVehicleByIdInput): Promise<GetVehicleByIdOutput> {
    const vehicle = await this.vehicleRepository.findById(input.id);

    if (!vehicle) {
      throw new VehicleNotFound(String(input.id));
    }

    return vehicle.toSnapshot();
  }
}
