import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderPublicTokenNotFound } from "../../domain/work-order/domain-error/work-order-public-token-not-found";
import { WorkOrderPublicTokenExpired } from "../../domain/work-order/domain-error/work-order-public-token-expired";
import { WorkOrderServiceTaskNotFound } from "../../domain/work-order/domain-error/work-order-service-task-not-found";
import { RejectServiceTask } from "./reject-service-task";

export interface RejectServiceTaskByPublicTokenInput {
  publicToken: string;
  serviceTaskId: number;
}

export type RejectServiceTaskByPublicTokenOutput = ReturnType<ServiceTask["toSnapshot"]>;

export class RejectServiceTaskByPublicToken {
  private readonly rejectServiceTask: RejectServiceTask;

  constructor(
    private readonly serviceTaskRepository: ServiceTaskRepository,
    private readonly workOrderRepository: WorkOrderRepository,
  ) {
    this.rejectServiceTask = new RejectServiceTask(
      this.serviceTaskRepository,
      this.workOrderRepository,
    );
  }

  public async execute(
    input: RejectServiceTaskByPublicTokenInput,
  ): Promise<RejectServiceTaskByPublicTokenOutput> {
    const workOrder = await this.workOrderRepository.findByPublicToken(input.publicToken);

    if (!workOrder) {
      throw new WorkOrderPublicTokenNotFound(input.publicToken);
    }

    if (!workOrder.isPublicTokenValid()) {
      throw new WorkOrderPublicTokenExpired(input.publicToken);
    }

    const workOrderSnapshot = workOrder.toSnapshot();

    if (workOrderSnapshot.id === null) {
      throw new Error("Work order must have an id to reject service tasks");
    }

    const serviceTask = await this.serviceTaskRepository.findById(input.serviceTaskId);

    if (!serviceTask) {
      throw new ServiceTaskNotFound(input.serviceTaskId);
    }

    const serviceTaskSnapshot = serviceTask.toSnapshot();

    if (serviceTaskSnapshot.workOrderId !== workOrderSnapshot.id) {
      throw new WorkOrderServiceTaskNotFound(input.serviceTaskId);
    }

    return this.rejectServiceTask.execute({
      id: input.serviceTaskId,
      workOrderId: workOrderSnapshot.id,
    });
  }
}
