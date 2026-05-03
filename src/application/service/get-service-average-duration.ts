import { Service } from "../../domain/service/aggregate/service";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceNotFound } from "../../domain/service/domain-error/service-not-found";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";

export interface GetServiceAverageDurationInput {
  id: number;
}

export interface GetServiceAverageDurationOutput {
  serviceId: number;
  averageDurationSeconds: number | null;
  taskCount: number;
  hasData: boolean;
}

export class GetServiceAverageDuration {
  constructor(
    private readonly serviceRepository: ServiceRepository,
    private readonly serviceTaskRepository: ServiceTaskRepository,
  ) {}

  public async execute(
    input: GetServiceAverageDurationInput,
  ): Promise<GetServiceAverageDurationOutput> {
    const service = await this.serviceRepository.findById(input.id);

    if (!service) {
      throw new ServiceNotFound(input.id);
    }

    const tasks = await this.serviceTaskRepository.findByServiceId(input.id);

    const completedTasks = tasks.filter((task) => {
      const snapshot = task.toSnapshot();
      return (
        snapshot.status === ServiceTaskStatus.COMPLETED &&
        snapshot.startedAt !== null &&
        snapshot.completedAt !== null
      );
    });

    if (completedTasks.length === 0) {
      return {
        serviceId: this.getServiceId(service),
        averageDurationSeconds: null,
        taskCount: 0,
        hasData: false,
      };
    }

    let totalSeconds = 0;

    for (const task of completedTasks) {
      const snapshot = task.toSnapshot();

      const startedAt = snapshot.startedAt ? new Date(snapshot.startedAt) : null;
      const completedAt = snapshot.completedAt ? new Date(snapshot.completedAt) : null;

      if (!startedAt || !completedAt) {
        continue;
      }

      const diffMillis = completedAt.getTime() - startedAt.getTime();

      if (!Number.isFinite(diffMillis) || diffMillis <= 0) {
        continue;
      }

      const diffSeconds = diffMillis / 1000;
      totalSeconds += diffSeconds;
    }

    const effectiveTaskCount = totalSeconds > 0 ? completedTasks.length : 0;

    if (effectiveTaskCount === 0) {
      return {
        serviceId: this.getServiceId(service),
        averageDurationSeconds: null,
        taskCount: 0,
        hasData: false,
      };
    }

    const averageSeconds = totalSeconds / effectiveTaskCount;

    return {
      serviceId: this.getServiceId(service),
      averageDurationSeconds: Math.round(averageSeconds),
      taskCount: effectiveTaskCount,
      hasData: true,
    };
  }

  private getServiceId(service: Service): number {
    const snapshot = service.toSnapshot();

    if (snapshot.id === null) {
      throw new Error("Service must have an id to calculate average duration");
    }

    return snapshot.id;
  }
}
