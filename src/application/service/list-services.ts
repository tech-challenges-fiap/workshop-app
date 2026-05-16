import { Service } from "../../domain/service/aggregate/service";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";

export type ListServicesOutput = Array<ReturnType<Service["toSnapshot"]>>;

export class ListServices {
  constructor(private readonly serviceRepository: ServiceRepository) {}

  public async execute(): Promise<ListServicesOutput> {
    const services = await this.serviceRepository.findAll();

    return services.map((service) => service.toSnapshot());
  }
}
