import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";

export interface GetServiceTaskByIdInput {
  id: number;
}

export type GetServiceTaskByIdOutput = ReturnType<ServiceTask["toSnapshot"]>;

export class GetServiceTaskById {
  constructor(private readonly serviceTaskRepository: ServiceTaskRepository) {}

  public async execute(input: GetServiceTaskByIdInput): Promise<GetServiceTaskByIdOutput> {
    const serviceTask = await this.serviceTaskRepository.findById(input.id);

    if (!serviceTask) {
      throw new ServiceTaskNotFound(input.id);
    }

    return serviceTask.toSnapshot();
  }
}
