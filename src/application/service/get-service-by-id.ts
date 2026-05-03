import { Service } from "../../domain/service/aggregate/service";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import { ServiceNotFound } from "../../domain/service/domain-error/service-not-found";

export interface GetServiceByIdInput {
  id: number;
}

export type GetServiceByIdOutput = ReturnType<Service["toSnapshot"]>;

export class GetServiceById {
  constructor(private readonly serviceRepository: ServiceRepository) {}

  public async execute(input: GetServiceByIdInput): Promise<GetServiceByIdOutput> {
    const service = await this.serviceRepository.findById(input.id);

    if (!service) {
      throw new ServiceNotFound(input.id);
    }

    return service.toSnapshot();
  }
}
