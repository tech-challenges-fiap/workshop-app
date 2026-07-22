import { randomUUID } from "node:crypto";

import { WorkOrderSagaTransitionNotAllowed } from "../domain-error/work-order-saga-transition-not-allowed";

export enum WorkOrderSagaState {
  RECEIVED = "RECEIVED",
  DIAGNOSIS_STARTED = "DIAGNOSIS_STARTED",
  WAITING_APPROVAL = "WAITING_APPROVAL",
  APPROVED = "APPROVED",
  IN_EXECUTION = "IN_EXECUTION",
  COMPLETED = "COMPLETED",
  DELIVERED = "DELIVERED",
  CANCELED = "CANCELED",
  COMPENSATING = "COMPENSATING",
  COMPENSATED = "COMPENSATED",
}

export enum WorkOrderSagaEventType {
  STARTED = "WORK_ORDER_SAGA_STARTED",
  DIAGNOSIS_STARTED = "DIAGNOSIS_STARTED",
  DIAGNOSIS_COMPLETED = "DIAGNOSIS_COMPLETED",
  APPROVAL_GRANTED = "APPROVAL_GRANTED",
  APPROVAL_REJECTED = "APPROVAL_REJECTED",
  EXECUTION_STARTED = "EXECUTION_STARTED",
  EXECUTION_COMPLETED = "EXECUTION_COMPLETED",
  EXECUTION_FAILED = "EXECUTION_FAILED",
  VEHICLE_DELIVERED = "VEHICLE_DELIVERED",
  CANCELLATION_REQUESTED = "CANCELLATION_REQUESTED",
  COMPENSATION_COMPLETED = "COMPENSATION_COMPLETED",
}

export interface WorkOrderSagaSnapshot {
  readonly sagaId: string;
  readonly workOrderId: number;
  readonly state: WorkOrderSagaState;
  readonly lastEventId: string | null;
  readonly compensationReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class WorkOrderSaga {
  private constructor(
    private readonly sagaId: string,
    private readonly workOrderId: number,
    private state: WorkOrderSagaState,
    private lastEventId: string | null,
    private compensationReason: string | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  public static start(params: { workOrderId: number; now?: Date; sagaId?: string }): WorkOrderSaga {
    WorkOrderSaga.assertWorkOrderId(params.workOrderId);
    const now = params.now ?? new Date();
    WorkOrderSaga.assertValidDate(now, "Work order saga creation time must be a valid date");

    return new WorkOrderSaga(
      params.sagaId ?? randomUUID(),
      params.workOrderId,
      WorkOrderSagaState.RECEIVED,
      null,
      null,
      now,
      now,
    );
  }

  public static rehydrate(snapshot: {
    sagaId: string;
    workOrderId: number;
    state: WorkOrderSagaState;
    lastEventId: string | null;
    compensationReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): WorkOrderSaga {
    WorkOrderSaga.assertWorkOrderId(snapshot.workOrderId);
    WorkOrderSaga.assertValidDate(
      snapshot.createdAt,
      "Work order saga createdAt must be a valid date",
    );
    WorkOrderSaga.assertValidDate(
      snapshot.updatedAt,
      "Work order saga updatedAt must be a valid date",
    );

    return new WorkOrderSaga(
      snapshot.sagaId,
      snapshot.workOrderId,
      snapshot.state,
      snapshot.lastEventId,
      snapshot.compensationReason,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  public apply(params: {
    eventType: WorkOrderSagaEventType;
    eventId?: string;
    occurredAt?: Date;
    compensationReason?: string;
  }): void {
    const nextState = this.resolveNextState(params.eventType);
    const occurredAt = params.occurredAt ?? new Date();
    WorkOrderSaga.assertValidDate(occurredAt, "Work order saga event time must be a valid date");

    this.state = nextState;
    this.lastEventId = params.eventId ?? this.lastEventId;
    this.updatedAt = occurredAt;

    if (nextState === WorkOrderSagaState.COMPENSATING) {
      this.compensationReason = params.compensationReason ?? params.eventType;
    }
  }

  public toSnapshot(): WorkOrderSagaSnapshot {
    return {
      sagaId: this.sagaId,
      workOrderId: this.workOrderId,
      state: this.state,
      lastEventId: this.lastEventId,
      compensationReason: this.compensationReason,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  private resolveNextState(eventType: WorkOrderSagaEventType): WorkOrderSagaState {
    const from = this.state;

    switch (eventType) {
      case WorkOrderSagaEventType.DIAGNOSIS_STARTED:
        return this.assertAllowed(eventType, [WorkOrderSagaState.RECEIVED], WorkOrderSagaState.DIAGNOSIS_STARTED);
      case WorkOrderSagaEventType.DIAGNOSIS_COMPLETED:
        return this.assertAllowed(eventType, [WorkOrderSagaState.DIAGNOSIS_STARTED], WorkOrderSagaState.WAITING_APPROVAL);
      case WorkOrderSagaEventType.APPROVAL_GRANTED:
        return this.assertAllowed(eventType, [WorkOrderSagaState.WAITING_APPROVAL], WorkOrderSagaState.APPROVED);
      case WorkOrderSagaEventType.EXECUTION_STARTED:
        return this.assertAllowed(eventType, [WorkOrderSagaState.APPROVED], WorkOrderSagaState.IN_EXECUTION);
      case WorkOrderSagaEventType.EXECUTION_COMPLETED:
        return this.assertAllowed(
          eventType,
          [WorkOrderSagaState.APPROVED, WorkOrderSagaState.IN_EXECUTION],
          WorkOrderSagaState.COMPLETED,
        );
      case WorkOrderSagaEventType.VEHICLE_DELIVERED:
        return this.assertAllowed(eventType, [WorkOrderSagaState.COMPLETED], WorkOrderSagaState.DELIVERED);
      case WorkOrderSagaEventType.CANCELLATION_REQUESTED:
        return this.assertAllowed(
          eventType,
          [
            WorkOrderSagaState.RECEIVED,
            WorkOrderSagaState.DIAGNOSIS_STARTED,
            WorkOrderSagaState.WAITING_APPROVAL,
            WorkOrderSagaState.APPROVED,
            WorkOrderSagaState.IN_EXECUTION,
          ],
          WorkOrderSagaState.CANCELED,
        );
      case WorkOrderSagaEventType.APPROVAL_REJECTED:
        return this.assertAllowed(eventType, [WorkOrderSagaState.WAITING_APPROVAL], WorkOrderSagaState.COMPENSATING);
      case WorkOrderSagaEventType.EXECUTION_FAILED:
        return this.assertAllowed(eventType, [WorkOrderSagaState.IN_EXECUTION], WorkOrderSagaState.COMPENSATING);
      case WorkOrderSagaEventType.COMPENSATION_COMPLETED:
        return this.assertAllowed(eventType, [WorkOrderSagaState.COMPENSATING], WorkOrderSagaState.COMPENSATED);
      case WorkOrderSagaEventType.STARTED:
        return this.assertAllowed(eventType, [WorkOrderSagaState.RECEIVED], WorkOrderSagaState.RECEIVED);
    }

    throw new WorkOrderSagaTransitionNotAllowed({ from, eventType });
  }

  private assertAllowed(
    eventType: WorkOrderSagaEventType,
    allowedFrom: WorkOrderSagaState[],
    nextState: WorkOrderSagaState,
  ): WorkOrderSagaState {
    if (!allowedFrom.includes(this.state)) {
      throw new WorkOrderSagaTransitionNotAllowed({ from: this.state, eventType });
    }

    return nextState;
  }

  private static assertValidDate(value: Date, message: string): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new Error(message);
    }
  }

  private static assertWorkOrderId(workOrderId: number): void {
    if (!Number.isInteger(workOrderId) || workOrderId <= 0) {
      throw new Error("Work order saga workOrderId must be a positive integer");
    }
  }
}
