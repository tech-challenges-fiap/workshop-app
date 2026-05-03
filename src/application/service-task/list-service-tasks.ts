import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";

export type ListServiceTasksOutput = ReturnType<ServiceTask["toSnapshot"]>[];

export class ListServiceTasks {
  constructor(private readonly serviceTaskRepository: ServiceTaskRepository) {}

  public async execute(): Promise<ListServiceTasksOutput> {
    const tasks = await this.serviceTaskRepository.findAll();

    return tasks.map((task) => task.toSnapshot());
  }
}
