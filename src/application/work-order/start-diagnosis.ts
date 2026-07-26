import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import {
  noopWorkOrderMetrics,
  type WorkOrderMetrics,
} from "../../domain/work-order/observability/work-order-metrics";

export interface StartDiagnosisInput {
  id: number;
  startedAt?: Date;
}

export type StartDiagnosisOutput = ReturnType<WorkOrder["toSnapshot"]>;

export class StartDiagnosis {
  constructor(
    private readonly workOrderRepository: WorkOrderRepository,
    private readonly metrics: WorkOrderMetrics = noopWorkOrderMetrics,
  ) {}

  public async execute(input: StartDiagnosisInput): Promise<StartDiagnosisOutput> {
    const workOrder = await this.workOrderRepository.findById(input.id);

    if (!workOrder) {
      throw new WorkOrderNotFound(input.id);
    }

    const previousStatus = workOrder.toSnapshot().status;
    const startedAt = input.startedAt ?? new Date();
    workOrder.startDiagnosis(startedAt);
    await this.workOrderRepository.save(workOrder);

    this.metrics.recordStatusChange(previousStatus, workOrder.toSnapshot().status);

    return workOrder.toSnapshot();
  }
}
