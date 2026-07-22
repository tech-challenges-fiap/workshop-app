import { randomUUID } from "crypto";

import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";
import { Money } from "../../domain/shared/value-object/money";
import { ServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import { VehicleNotFound } from "../../domain/vehicle/domain-error/vehicle-not-found";
import {
  noopWorkOrderMetrics,
  type WorkOrderMetrics,
} from "../../domain/work-order/observability/work-order-metrics";

export interface CreateWorkOrderServiceTaskInput {
  serviceTaskId: number;
}

export interface CreateWorkOrderInput {
  vehicleId: number;
  serviceTasks?: CreateWorkOrderServiceTaskInput[];
  createdAt?: Date;
}

export type CreateWorkOrderOutput = ReturnType<WorkOrder["toSnapshot"]>;

export class CreateWorkOrder {
  constructor(
    private readonly workOrderRepository: WorkOrderRepository,
    private readonly vehicleRepository: VehicleRepository,
    private readonly serviceTaskRepository: ServiceTaskRepository,
    private readonly metrics: WorkOrderMetrics = noopWorkOrderMetrics,
  ) {}

  public async execute(input: CreateWorkOrderInput): Promise<CreateWorkOrderOutput> {
    const vehicle = await this.vehicleRepository.findById(input.vehicleId);
    if (!vehicle) {
      throw new VehicleNotFound(String(input.vehicleId));
    }

    const serviceTasks: {
      serviceTaskId: number;
      status: ServiceTaskStatus;
      amount: Money;
    }[] = [];
    for (const task of input.serviceTasks ?? []) {
      const serviceTask = await this.serviceTaskRepository.findById(task.serviceTaskId);

      if (!serviceTask) {
        throw new ServiceTaskNotFound(task.serviceTaskId);
      }

      const snapshot = serviceTask.toSnapshot();
      serviceTasks.push({
        serviceTaskId: snapshot.id ?? 0,
        status: snapshot.status,
        amount: Money.create(snapshot.price),
      });
    }

    const baseCreatedAt = input.createdAt ?? new Date();
    const publicToken = randomUUID();
    const publicTokenExpiresAt = new Date(baseCreatedAt.getTime());
    publicTokenExpiresAt.setFullYear(publicTokenExpiresAt.getFullYear() + 2);

    const workOrder = WorkOrder.create({
      vehicleId: input.vehicleId,
      publicToken,
      publicTokenExpiresAt,
      serviceTasks,
      createdAt: baseCreatedAt,
    });

    const created = await this.workOrderRepository.create(workOrder);

    this.metrics.recordCreated();

    return created.toSnapshot();
  }
}
