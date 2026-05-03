import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderPublicTokenNotFound } from "../../domain/work-order/domain-error/work-order-public-token-not-found";
import { WorkOrderPublicTokenExpired } from "../../domain/work-order/domain-error/work-order-public-token-expired";

export interface GetWorkOrderByPublicTokenInput {
  publicToken: string;
}

export type GetWorkOrderByPublicTokenOutput = ReturnType<WorkOrder["toSnapshot"]>;

export class GetWorkOrderByPublicToken {
  constructor(private readonly workOrderRepository: WorkOrderRepository) {}

  public async execute(
    input: GetWorkOrderByPublicTokenInput,
  ): Promise<GetWorkOrderByPublicTokenOutput> {
    const workOrder = await this.workOrderRepository.findByPublicToken(input.publicToken);

    if (!workOrder) {
      throw new WorkOrderPublicTokenNotFound(input.publicToken);
    }

    if (!workOrder.isPublicTokenValid()) {
      throw new WorkOrderPublicTokenExpired(input.publicToken);
    }

    return workOrder.toSnapshot();
  }
}
