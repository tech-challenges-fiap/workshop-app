import type {
  WorkOrderRepository,
  WorkOrderStatusDurationMetric,
} from "../../domain/work-order/repository/work-order-repository";

export type GetWorkOrderStatusDurationMetricsOutput = WorkOrderStatusDurationMetric[];

export class GetWorkOrderStatusDurationMetrics {
  public constructor(private readonly workOrderRepository: WorkOrderRepository) {}

  public async execute(): Promise<GetWorkOrderStatusDurationMetricsOutput> {
    if (!this.workOrderRepository.getAverageDurationByStatus) {
      return [];
    }

    return this.workOrderRepository.getAverageDurationByStatus();
  }
}
