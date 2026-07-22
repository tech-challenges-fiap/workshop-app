import { describe, expect, it } from "bun:test";

import { WorkOrderSagaTransitionNotAllowed } from "../domain-error/work-order-saga-transition-not-allowed";
import {
  WorkOrderSaga,
  WorkOrderSagaEventType,
  WorkOrderSagaState,
} from "./work-order-saga";

describe("WorkOrderSaga", () => {
  it("applies the happy path transition sequence", () => {
    const saga = WorkOrderSaga.start({ workOrderId: 1, now: new Date("2024-01-01T00:00:00.000Z") });

    saga.apply({ eventType: WorkOrderSagaEventType.DIAGNOSIS_STARTED });
    expect(saga.toSnapshot().state).toBe(WorkOrderSagaState.DIAGNOSIS_STARTED);

    saga.apply({ eventType: WorkOrderSagaEventType.DIAGNOSIS_COMPLETED });
    expect(saga.toSnapshot().state).toBe(WorkOrderSagaState.WAITING_APPROVAL);

    saga.apply({ eventType: WorkOrderSagaEventType.APPROVAL_GRANTED });
    expect(saga.toSnapshot().state).toBe(WorkOrderSagaState.APPROVED);

    saga.apply({ eventType: WorkOrderSagaEventType.EXECUTION_STARTED });
    expect(saga.toSnapshot().state).toBe(WorkOrderSagaState.IN_EXECUTION);

    saga.apply({ eventType: WorkOrderSagaEventType.EXECUTION_COMPLETED });
    expect(saga.toSnapshot().state).toBe(WorkOrderSagaState.COMPLETED);

    saga.apply({ eventType: WorkOrderSagaEventType.VEHICLE_DELIVERED });
    expect(saga.toSnapshot().state).toBe(WorkOrderSagaState.DELIVERED);
  });

  it("rejects invalid transitions without mutating state", () => {
    const saga = WorkOrderSaga.start({ workOrderId: 1 });

    expect(() => saga.apply({ eventType: WorkOrderSagaEventType.EXECUTION_COMPLETED })).toThrow(
      WorkOrderSagaTransitionNotAllowed,
    );
    expect(saga.toSnapshot().state).toBe(WorkOrderSagaState.RECEIVED);
  });

  it("records compensation intent and closes as compensated", () => {
    const saga = WorkOrderSaga.start({ workOrderId: 1 });
    saga.apply({ eventType: WorkOrderSagaEventType.DIAGNOSIS_STARTED });
    saga.apply({ eventType: WorkOrderSagaEventType.DIAGNOSIS_COMPLETED });

    saga.apply({
      eventType: WorkOrderSagaEventType.APPROVAL_REJECTED,
      compensationReason: "customer rejected all services",
    });

    expect(saga.toSnapshot()).toMatchObject({
      state: WorkOrderSagaState.COMPENSATING,
      compensationReason: "customer rejected all services",
    });

    saga.apply({ eventType: WorkOrderSagaEventType.COMPENSATION_COMPLETED });
    expect(saga.toSnapshot().state).toBe(WorkOrderSagaState.COMPENSATED);
  });
});
