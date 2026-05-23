import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import { recordWorkOrderStatusChange } from "../../infrastructure/observability/work-order-metrics";

export interface CancelWorkOrderInput {
  id: number;
  canceledAt?: Date;
}

export type CancelWorkOrderOutput = ReturnType<WorkOrder["toSnapshot"]>;

export class CancelWorkOrder {
  constructor(private readonly workOrderRepository: WorkOrderRepository) {}

  public async execute(input: CancelWorkOrderInput): Promise<CancelWorkOrderOutput> {
    const workOrder = await this.workOrderRepository.findById(input.id);

    if (!workOrder) {
      throw new WorkOrderNotFound(input.id);
    }

    const previousStatus = workOrder.toSnapshot().status;
    const canceledAt = input.canceledAt ?? new Date();
    workOrder.cancel(canceledAt);
    await this.workOrderRepository.save(workOrder);

    recordWorkOrderStatusChange(previousStatus, workOrder.toSnapshot().status);

    return workOrder.toSnapshot();
  }
}
