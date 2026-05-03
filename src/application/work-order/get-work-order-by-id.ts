import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";

export interface GetWorkOrderByIdInput {
  id: number;
}

export type GetWorkOrderByIdOutput = ReturnType<WorkOrder["toSnapshot"]>;

export class GetWorkOrderById {
  constructor(private readonly workOrderRepository: WorkOrderRepository) {}

  public async execute(input: GetWorkOrderByIdInput): Promise<GetWorkOrderByIdOutput> {
    const workOrder = await this.workOrderRepository.findById(input.id);

    if (!workOrder) {
      throw new WorkOrderNotFound(input.id);
    }

    return workOrder.toSnapshot();
  }
}
