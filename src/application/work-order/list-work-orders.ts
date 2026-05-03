import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";

export type ListWorkOrdersOutput = ReturnType<WorkOrder["toSnapshot"]>[];

export class ListWorkOrders {
  constructor(private readonly workOrderRepository: WorkOrderRepository) {}

  public async execute(): Promise<ListWorkOrdersOutput> {
    const workOrders = await this.workOrderRepository.listOperationalQueue();
    return workOrders.map((workOrder) => workOrder.toSnapshot());
  }
}
