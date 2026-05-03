import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import {
  buildCompleteDiagnosisNotificationInput,
  type CompleteDiagnosisNotificationDeps,
} from "./complete-diagnosis/build-notification-payload";

export interface CompleteDiagnosisInput {
  id: number;
  completedAt?: Date;
}

export type CompleteDiagnosisOutput = ReturnType<WorkOrder["toSnapshot"]>;

export class CompleteDiagnosis {
  constructor(
    private readonly workOrderRepository: WorkOrderRepository,
    private readonly notificationDeps?: CompleteDiagnosisNotificationDeps,
  ) {}

  public async execute(input: CompleteDiagnosisInput): Promise<CompleteDiagnosisOutput> {
    const workOrder = await this.workOrderRepository.findById(input.id);

    if (!workOrder) {
      throw new WorkOrderNotFound(input.id);
    }

    const completedAt = input.completedAt ?? new Date();
    workOrder.completeDiagnosis(completedAt);
    await this.workOrderRepository.save(workOrder);

    const snapshot = workOrder.toSnapshot();
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
