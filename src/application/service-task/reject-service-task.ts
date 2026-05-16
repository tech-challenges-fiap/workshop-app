import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";
import { WorkOrderStatusTransitionNotAllowed } from "../../domain/work-order/domain-error/work-order-status-transition-not-allowed";

export interface RejectServiceTaskInput {
  id: number;
  workOrderId?: number;
}

export type RejectServiceTaskOutput = ReturnType<ServiceTask["toSnapshot"]>;

export class RejectServiceTask {
  constructor(
    private readonly serviceTaskRepository: ServiceTaskRepository,
    private readonly workOrderRepository?: WorkOrderRepository,
  ) {}

  public async execute(input: RejectServiceTaskInput): Promise<RejectServiceTaskOutput> {
    const serviceTask = await this.serviceTaskRepository.findById(input.id);

    if (!serviceTask) {
      throw new ServiceTaskNotFound(input.id);
    }

    const snapshot = serviceTask.toSnapshot();
    const workOrderId =
      typeof input.workOrderId === "number" ? input.workOrderId : snapshot.workOrderId;
    const workOrderRepository = this.workOrderRepository;
    let workOrder = null;

    if (workOrderRepository && typeof workOrderId === "number") {
      workOrder = await workOrderRepository.findById(workOrderId);

      if (!workOrder) {
        throw new WorkOrderNotFound(workOrderId);
      }

      if (workOrder.toSnapshot().status !== WorkOrderStatus.WAITING_APPROVAL) {
        throw new WorkOrderStatusTransitionNotAllowed({
          from: workOrder.toSnapshot().status,
          to: WorkOrderStatus.WAITING_APPROVAL,
        });
      }
    }

    serviceTask.reject();
    await this.serviceTaskRepository.save(serviceTask);

    if (workOrder && workOrderRepository) {
      workOrder.updateServiceTaskStatus({
        serviceTaskId: input.id,
        status: serviceTask.toSnapshot().status,
      });

      await workOrderRepository.save(workOrder);
    }

    return serviceTask.toSnapshot();
  }
}
