import { VehicleNotFound } from "../../domain/vehicle/domain-error/vehicle-not-found";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";

export interface DeleteVehicleInput {
  id: number;
}

export class DeleteVehicle {
  constructor(private readonly vehicleRepository: VehicleRepository) {}

  public async execute(input: DeleteVehicleInput): Promise<void> {
    const vehicle = await this.vehicleRepository.findById(input.id);

    if (!vehicle) {
      throw new VehicleNotFound(String(input.id));
    }

    await this.vehicleRepository.delete(input.id);
  }
}
