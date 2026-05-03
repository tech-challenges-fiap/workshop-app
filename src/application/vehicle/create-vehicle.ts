import { Vehicle } from "../../domain/vehicle/aggregate/vehicle";
import { VehiclePlate } from "../../domain/vehicle/value-object/vehicle-plate";
import { VehicleBrand } from "../../domain/vehicle/value-object/vehicle-brand";
import { VehicleModel } from "../../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../../domain/vehicle/value-object/vehicle-year";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import { PlateAlreadyExists } from "../../domain/vehicle/domain-error/plate-already-exists";
import type { PersonRepository } from "../../domain/person/repository/person-repository";
import { PersonNotFound } from "../../domain/person/domain-error/person-not-found";

export interface CreateVehicleInput {
  plate: string;
  brand?: string;
  model: string;
  year: number;
  ownerPersonId: number;
}

export type CreateVehicleOutput = ReturnType<Vehicle["toSnapshot"]>;

export class CreateVehicle {
  constructor(
    private readonly vehicleRepository: VehicleRepository,
    private readonly personRepository: PersonRepository,
  ) {}

  public async execute(input: CreateVehicleInput): Promise<CreateVehicleOutput> {
    const plate = VehiclePlate.create(input.plate);
    const brand = input.brand !== undefined ? VehicleBrand.create(input.brand) : undefined;

    // Check if plate exists before trying to create.
    // Although the repo also handles unique violation, this is a domain check.
    const existing = await this.vehicleRepository.findByPlate(plate);
    if (existing) {
      throw new PlateAlreadyExists(input.plate);
    }

    const model = VehicleModel.create(input.model);
    const year = VehicleYear.create(input.year);

    const person = await this.personRepository.findById(input.ownerPersonId);
    if (!person) {
      throw new PersonNotFound(String(input.ownerPersonId));
    }

    const vehicle = Vehicle.create({
      plate,
      brand,
      model,
      year,
      ownerPersonId: input.ownerPersonId,
    });

    const created = await this.vehicleRepository.create(vehicle);

    return created.toSnapshot();
  }
}
