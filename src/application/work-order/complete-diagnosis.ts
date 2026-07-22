import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import {
  buildCompleteDiagnosisNotificationInput,
  type CompleteDiagnosisNotificationDeps,
} from "./complete-diagnosis/build-notification-payload";
import {
  noopWorkOrderMetrics,
  type WorkOrderMetrics,
} from "../../domain/work-order/observability/work-order-metrics";

export interface CompleteDiagnosisInput {
  id: number;
  completedAt?: Date;
}

export type CompleteDiagnosisOutput = ReturnType<WorkOrder["toSnapshot"]>;

export class CompleteDiagnosis {
  constructor(
    private readonly workOrderRepository: WorkOrderRepository,
    private readonly notificationDeps?: CompleteDiagnosisNotificationDeps,
    private readonly metrics: WorkOrderMetrics = noopWorkOrderMetrics,
  ) {}

  public async execute(input: CompleteDiagnosisInput): Promise<CompleteDiagnosisOutput> {
    const workOrder = await this.workOrderRepository.findById(input.id);

    if (!workOrder) {
      throw new WorkOrderNotFound(input.id);
    }

    const previousStatus = workOrder.toSnapshot().status;
    const completedAt = input.completedAt ?? new Date();
    workOrder.completeDiagnosis(completedAt);
    await this.workOrderRepository.save(workOrder);

    const snapshot = workOrder.toSnapshot();
    this.metrics.recordStatusChange(previousStatus, snapshot.status);
    await this.trySendNotification(snapshot);

    return snapshot;
  }

  private async trySendNotification(snapshot: CompleteDiagnosisOutput): Promise<void> {
    const deps = this.notificationDeps;

    if (!deps) {
      return;
    }

    try {
      const notificationInput = await buildCompleteDiagnosisNotificationInput(snapshot, deps);
      await deps.notification.send(notificationInput);
    } catch {
      // Notification failures must not prevent diagnosis completion.
    }
  }
}
