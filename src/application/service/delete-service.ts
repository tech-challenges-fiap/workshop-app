import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import { ServiceNotFound } from "../../domain/service/domain-error/service-not-found";

export interface DeleteServiceInput {
  id: number;
}

export class DeleteService {
  constructor(private readonly serviceRepository: ServiceRepository) {}

  public async execute(input: DeleteServiceInput): Promise<void> {
    const existing = await this.serviceRepository.findById(input.id);

    if (!existing) {
      throw new ServiceNotFound(input.id);
    }

    await this.serviceRepository.delete(input.id);
  }
}
