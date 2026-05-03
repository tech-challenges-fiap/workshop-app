import type { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import { VehicleBrand } from "../../domain/vehicle/value-object/vehicle-brand";
import { VehicleModel } from "../../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../../domain/vehicle/value-object/vehicle-year";
import { VehicleNotFound } from "../../domain/vehicle/domain-error/vehicle-not-found";
import { PlateAlreadyExists } from "../../domain/vehicle/domain-error/plate-already-exists";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import type { PersonRepository } from "../../domain/person/repository/person-repository";
import { PersonNotFound } from "../../domain/person/domain-error/person-not-found";

export interface UpdateVehicleInput {
  id: number;
  plate?: string;
  brand?: string;
  model?: string;
  year?: number;
  ownerPersonId?: number;
}

export type UpdateVehicleOutput = ReturnType<Vehicle["toSnapshot"]>;

export class UpdateVehicle {
  constructor(
    private readonly vehicleRepository: VehicleRepository,
    private readonly personRepository: PersonRepository,
  ) {}

  public async execute(input: UpdateVehicleInput): Promise<UpdateVehicleOutput> {
    const vehicle = await this.vehicleRepository.findById(input.id);

    if (!vehicle) {
      throw new VehicleNotFound(String(input.id));
    }

    if (input.plate) {
      const newPlate = VehiclePlate.create(input.plate);
      // Check for uniqueness if plate is changing
      if (input.plate !== vehicle.toSnapshot().plate) {
        // Simplifying since snapshot returns string
        const conflict = await this.vehicleRepository.findByPlate(newPlate);
        if (conflict && conflict.toSnapshot().id !== input.id) {
          throw new PlateAlreadyExists(input.plate);
        }
      }
    }

    if (typeof input.ownerPersonId === "number") {
      const person = await this.personRepository.findById(input.ownerPersonId);
      if (!person) {
        throw new PersonNotFound(String(input.ownerPersonId));
      }
    }

    vehicle.update({
      plate: input.plate ? VehiclePlate.create(input.plate) : undefined,
      brand: input.brand !== undefined ? VehicleBrand.create(input.brand) : undefined,
      model: input.model ? VehicleModel.create(input.model) : undefined,
      year: input.year ? VehicleYear.create(input.year) : undefined,
      ownerPersonId: input.ownerPersonId,
    });

    await this.vehicleRepository.save(vehicle);

    return vehicle.toSnapshot();
  }
}
