import type { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehicleNotFound } from "../../domain/vehicle/domain-error/vehicle-not-found";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";

export interface GetVehicleByPlateInput {
  plate: string;
}

export type GetVehicleByPlateOutput = ReturnType<Vehicle["toSnapshot"]>;

export class GetVehicleByPlate {
  constructor(private readonly vehicleRepository: VehicleRepository) {}

  public async execute(input: GetVehicleByPlateInput): Promise<GetVehicleByPlateOutput> {
    const plate = VehiclePlate.create(input.plate);

    const vehicle = await this.vehicleRepository.findByPlate(plate);

    if (!vehicle) {
      throw new VehicleNotFound(plate.toString());
    }

    return vehicle.toSnapshot();
  }
}
