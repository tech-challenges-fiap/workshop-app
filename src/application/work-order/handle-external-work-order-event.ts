import { createHash } from "node:crypto";

import type { ApproveServiceTask } from "../service-task/approve-service-task";
import type { RejectServiceTask } from "../service-task/reject-service-task";
import type { StartServiceExecution } from "../service-task/start-service-execution";
import type { CompleteServiceTask } from "../service-task/complete-service-task";
import type { StartDiagnosis } from "./start-diagnosis";
import type { CompleteDiagnosis } from "./complete-diagnosis";
import type { CancelWorkOrder } from "./cancel-work-order";
import type { DeliverVehicle } from "./deliver-vehicle";
import type { WorkOrderWebhookEventRepository } from "../../domain/work-order/repository/work-order-webhook-event-repository";
import { WorkOrderWebhookEventInvalid } from "../../domain/work-order/domain-error/work-order-webhook-event-invalid";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";

export type ExternalWorkOrderEventType =
  | "SERVICE_TASK_APPROVED"
  | "SERVICE_TASK_REJECTED"
  | "WORK_ORDER_STATUS_UPDATED";

type SupportedStatusUpdate =
  | WorkOrderStatus.DIAGNOSIS
  | WorkOrderStatus.WAITING_APPROVAL
  | WorkOrderStatus.IN_EXECUTION
  | WorkOrderStatus.FINALIZED
  | WorkOrderStatus.CANCELED
  | WorkOrderStatus.DELIVERED;

export type HandleExternalWorkOrderEventInput =
  | {
      eventId: string;
      eventType: "SERVICE_TASK_APPROVED";
      workOrderId: number;
      serviceTaskId: number;
      occurredAt?: Date;
    }
  | {
      eventId: string;
      eventType: "SERVICE_TASK_REJECTED";
      workOrderId: number;
      serviceTaskId: number;
      occurredAt?: Date;
    }
  | {
      eventId: string;
      eventType: "WORK_ORDER_STATUS_UPDATED";
      workOrderId: number;
      targetStatus: SupportedStatusUpdate;
      serviceTaskId?: number;
      occurredAt?: Date;
    };

export interface HandleExternalWorkOrderEventOutput {
  eventId: string;
  eventType: ExternalWorkOrderEventType;
  result: "processed" | "duplicate";
}

interface HandleExternalWorkOrderEventDeps {
  approveServiceTask: ApproveServiceTask;
  rejectServiceTask: RejectServiceTask;
  startServiceExecution: StartServiceExecution;
  completeServiceTask: CompleteServiceTask;
  startDiagnosis: StartDiagnosis;
  completeDiagnosis: CompleteDiagnosis;
  cancelWorkOrder: CancelWorkOrder;
  deliverVehicle: DeliverVehicle;
  workOrderWebhookEventRepository: WorkOrderWebhookEventRepository;
}

export class HandleExternalWorkOrderEvent {
  constructor(private readonly deps: HandleExternalWorkOrderEventDeps) {}

  public async execute(
    input: HandleExternalWorkOrderEventInput,
  ): Promise<HandleExternalWorkOrderEventOutput> {
    const payloadHash = hashPayload(input);
    const isNewEvent = await this.deps.workOrderWebhookEventRepository.registerPending({
      eventId: input.eventId,
      eventType: input.eventType,
      payloadHash,
    });

    if (!isNewEvent) {
      return {
        eventId: input.eventId,
        eventType: input.eventType,
        result: "duplicate",
      };
    }

    try {
      await this.dispatch(input);
      await this.deps.workOrderWebhookEventRepository.markProcessed(input.eventId);

      return {
        eventId: input.eventId,
        eventType: input.eventType,
        result: "processed",
      };
    } catch (error) {
      await this.deps.workOrderWebhookEventRepository.releasePending(input.eventId);
      throw error;
    }
  }

  private async dispatch(input: HandleExternalWorkOrderEventInput): Promise<void> {
    switch (input.eventType) {
      case "SERVICE_TASK_APPROVED":
        await this.deps.approveServiceTask.execute({
          id: input.serviceTaskId,
          workOrderId: input.workOrderId,
        });
        return;
      case "SERVICE_TASK_REJECTED":
        await this.deps.rejectServiceTask.execute({
          id: input.serviceTaskId,
          workOrderId: input.workOrderId,
        });
        return;
      case "WORK_ORDER_STATUS_UPDATED":
        await this.applyStatusUpdate(input);
        return;
    }
  }

  private async applyStatusUpdate(
    input: Extract<HandleExternalWorkOrderEventInput, { eventType: "WORK_ORDER_STATUS_UPDATED" }>,
  ): Promise<void> {
    switch (input.targetStatus) {
      case WorkOrderStatus.DIAGNOSIS:
        await this.deps.startDiagnosis.execute({
          id: input.workOrderId,
          startedAt: input.occurredAt,
        });
        return;
      case WorkOrderStatus.WAITING_APPROVAL:
        await this.deps.completeDiagnosis.execute({
          id: input.workOrderId,
          completedAt: input.occurredAt,
        });
        return;
      case WorkOrderStatus.IN_EXECUTION: {
        if (!input.serviceTaskId) {
          throw new WorkOrderWebhookEventInvalid(
            "serviceTaskId is required for WORK_ORDER_STATUS_UPDATED to IN_EXECUTION",
          );
        }

        await this.deps.startServiceExecution.execute({
          id: input.serviceTaskId,
          startedAt: input.occurredAt,
        });
        return;
      }
      case WorkOrderStatus.FINALIZED: {
        if (!input.serviceTaskId) {
          throw new WorkOrderWebhookEventInvalid(
            "serviceTaskId is required for WORK_ORDER_STATUS_UPDATED to FINALIZED",
          );
        }

        await this.deps.completeServiceTask.execute({
          id: input.serviceTaskId,
          completedAt: input.occurredAt,
        });
        return;
      }
      case WorkOrderStatus.CANCELED:
        await this.deps.cancelWorkOrder.execute({
          id: input.workOrderId,
          canceledAt: input.occurredAt,
        });
        return;
      case WorkOrderStatus.DELIVERED:
        await this.deps.deliverVehicle.execute({
          id: input.workOrderId,
          deliveredAt: input.occurredAt,
        });
        return;
    }
  }
}

function hashPayload(input: HandleExternalWorkOrderEventInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
