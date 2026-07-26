import { describe, expect, it } from "bun:test";

import { OrchestrateWorkOrderSaga } from "./orchestrate-work-order-saga";
import { InMemoryWorkOrderSagaRepository } from "./test-support";
import { WorkOrderSagaEventType, WorkOrderSagaState } from "../../domain/work-order/saga/work-order-saga";

describe("OrchestrateWorkOrderSaga", () => {
  it("starts and persists a saga for a work order", async () => {
    const repository = new InMemoryWorkOrderSagaRepository();
    const useCase = new OrchestrateWorkOrderSaga(repository);

    const result = await useCase.execute({
      workOrderId: 10,
      eventType: WorkOrderSagaEventType.STARTED,
      eventId: "event-started",
    });

    expect(result.result).toBe("started");
    expect(result.saga).toMatchObject({
      workOrderId: 10,
      state: WorkOrderSagaState.RECEIVED,
      lastEventId: null,
    });
    expect(await repository.findByWorkOrderId(10)).not.toBeNull();
  });

  it("returns duplicate when the same external event id arrives again", async () => {
    const repository = new InMemoryWorkOrderSagaRepository();
    const useCase = new OrchestrateWorkOrderSaga(repository);

    await useCase.execute({
      workOrderId: 10,
      eventType: WorkOrderSagaEventType.STARTED,
      eventId: "event-started",
    });

    const duplicate = await useCase.execute({
      workOrderId: 10,
      eventType: WorkOrderSagaEventType.DIAGNOSIS_STARTED,
      eventId: "event-started",
    });

    expect(duplicate.result).toBe("duplicate");
    expect(duplicate.saga.state).toBe(WorkOrderSagaState.RECEIVED);
  });

  it("persists transition results and event identities", async () => {
    const repository = new InMemoryWorkOrderSagaRepository();
    const useCase = new OrchestrateWorkOrderSaga(repository);

    await useCase.execute({ workOrderId: 10, eventType: WorkOrderSagaEventType.STARTED });
    const result = await useCase.execute({
      workOrderId: 10,
      eventType: WorkOrderSagaEventType.DIAGNOSIS_STARTED,
      eventId: "event-diagnosis-started",
      occurredAt: new Date("2024-01-02T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      result: "transitioned",
      saga: {
        workOrderId: 10,
        state: WorkOrderSagaState.DIAGNOSIS_STARTED,
        lastEventId: "event-diagnosis-started",
      },
    });
    expect(await repository.hasProcessedEvent("event-diagnosis-started")).toBe(true);
  });

  it("records compensation reason without publishing transport messages", async () => {
    const repository = new InMemoryWorkOrderSagaRepository();
    const useCase = new OrchestrateWorkOrderSaga(repository);

    await useCase.execute({ workOrderId: 10, eventType: WorkOrderSagaEventType.STARTED });
    await useCase.execute({ workOrderId: 10, eventType: WorkOrderSagaEventType.DIAGNOSIS_STARTED });
    await useCase.execute({ workOrderId: 10, eventType: WorkOrderSagaEventType.DIAGNOSIS_COMPLETED });

    const result = await useCase.execute({
      workOrderId: 10,
      eventType: WorkOrderSagaEventType.APPROVAL_REJECTED,
      eventId: "event-approval-rejected",
      compensationReason: "customer rejected all services",
    });

    expect(result.saga).toMatchObject({
      state: WorkOrderSagaState.COMPENSATING,
      compensationReason: "customer rejected all services",
      lastEventId: "event-approval-rejected",
    });
  });
});
