import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";

export interface DeliverVehicleInput {
  id: number;
  deliveredAt?: Date;
}

export type DeliverVehicleOutput = ReturnType<WorkOrder["toSnapshot"]>;

export class DeliverVehicle {
  constructor(private readonly workOrderRepository: WorkOrderRepository) {}

  public async execute(input: DeliverVehicleInput): Promise<DeliverVehicleOutput> {
    const workOrder = await this.workOrderRepository.findById(input.id);

    if (!workOrder) {
      throw new WorkOrderNotFound(input.id);
    }

    const deliveredAt = input.deliveredAt ?? new Date();
    workOrder.deliver(deliveredAt);
    await this.workOrderRepository.save(workOrder);

    return workOrder.toSnapshot();
  }
}
