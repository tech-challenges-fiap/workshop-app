import { describe, expect, it } from "bun:test";

import { HandleInboundWorkOrderSagaEvent, UnsupportedInboundWorkOrderSagaEvent } from "./handle-inbound-work-order-saga-event";
import { OrchestrateWorkOrderSaga } from "./orchestrate-work-order-saga";
import type {
  RegisterWorkOrderSagaEventInput,
  WorkOrderSagaRepository,
} from "../../domain/work-order/repository/work-order-saga-repository";
import {
  createWorkOrderEvent,
  InboundWorkOrderSagaEventName,
  OsWorkOrderEventName,
} from "../../domain/work-order/events/work-order-events";
import { WorkOrderSaga } from "../../domain/work-order/saga/work-order-saga";
import { WorkOrderSagaState } from "../../domain/work-order/saga/work-order-saga";

class InMemoryWorkOrderSagaRepository implements WorkOrderSagaRepository {
  private readonly sagasByWorkOrderId = new Map<number, WorkOrderSaga>();
  private readonly events = new Map<string, RegisterWorkOrderSagaEventInput>();

  public async findByWorkOrderId(workOrderId: number): Promise<WorkOrderSaga | null> {
    return this.sagasByWorkOrderId.get(workOrderId) ?? null;
  }

  public async create(saga: WorkOrderSaga): Promise<WorkOrderSaga> {
    this.sagasByWorkOrderId.set(saga.toSnapshot().workOrderId, saga);
    return saga;
  }

  public async save(saga: WorkOrderSaga): Promise<WorkOrderSaga> {
    this.sagasByWorkOrderId.set(saga.toSnapshot().workOrderId, saga);
    return saga;
  }

  public async hasProcessedEvent(eventId: string): Promise<boolean> {
    return this.events.has(eventId);
  }

  public async recordProcessedEvent(input: RegisterWorkOrderSagaEventInput): Promise<boolean> {
    if (this.events.has(input.eventId)) {
      return false;
    }

    this.events.set(input.eventId, input);
    return true;
  }
}

describe("inbound saga event handler", () => {
  it("maps valid inbound events into idempotent saga handoff", async () => {
    const repository = new InMemoryWorkOrderSagaRepository();
    const handler = new HandleInboundWorkOrderSagaEvent(
      new OrchestrateWorkOrderSaga(repository),
    );
    const event = createWorkOrderEvent({
      eventId: "event-diagnosis-started",
      eventName: InboundWorkOrderSagaEventName.DIAGNOSIS_STARTED,
      correlationId: "correlation-1",
      occurredAt: new Date("2026-07-19T00:00:00.000Z"),
      producer: "execution-service",
      payload: { workOrderId: 88 },
    });

    const result = await handler.handle(JSON.stringify(event));
    const duplicate = await handler.handle(JSON.stringify(event));

    expect(result).toMatchObject({
      correlationId: "correlation-1",
      eventId: "event-diagnosis-started",
      sagaResult: {
        result: "transitioned",
        saga: { workOrderId: 88, state: WorkOrderSagaState.DIAGNOSIS_STARTED },
      },
    });
    expect(duplicate.sagaResult.result).toBe("duplicate");
    expect(duplicate.sagaResult.saga.state).toBe(WorkOrderSagaState.DIAGNOSIS_STARTED);
  });

  it("passes compensation reason to the saga orchestrator", async () => {
    const repository = new InMemoryWorkOrderSagaRepository();
    const orchestrator = new OrchestrateWorkOrderSaga(repository);
    const handler = new HandleInboundWorkOrderSagaEvent(orchestrator);

    await handler.handle(
      JSON.stringify(
        createWorkOrderEvent({
          eventId: "event-diagnosis-started",
          eventName: InboundWorkOrderSagaEventName.DIAGNOSIS_STARTED,
          correlationId: "correlation-1",
          payload: { workOrderId: 99 },
        }),
      ),
    );
    await handler.handle(
      JSON.stringify(
        createWorkOrderEvent({
          eventId: "event-diagnosis-completed",
          eventName: InboundWorkOrderSagaEventName.DIAGNOSIS_COMPLETED,
          correlationId: "correlation-1",
          payload: { workOrderId: 99 },
        }),
      ),
    );

    const result = await handler.handle(
      JSON.stringify(
        createWorkOrderEvent({
          eventId: "event-approval-rejected",
          eventName: InboundWorkOrderSagaEventName.APPROVAL_REJECTED,
          correlationId: "correlation-1",
          payload: { workOrderId: 99, compensationReason: "payment rejected" },
        }),
      ),
    );

    expect(result.sagaResult.saga).toMatchObject({
      state: WorkOrderSagaState.COMPENSATING,
      compensationReason: "payment rejected",
    });
  });

  it("rejects unsupported inbound event names before saga handoff", async () => {
    const repository = new InMemoryWorkOrderSagaRepository();
    const handler = new HandleInboundWorkOrderSagaEvent(
      new OrchestrateWorkOrderSaga(repository),
    );
    const outboundEvent = createWorkOrderEvent({
      eventId: "event-received",
      eventName: OsWorkOrderEventName.RECEIVED,
      correlationId: "correlation-1",
      payload: { workOrderId: 77 },
    });

    try {
      await handler.handle(JSON.stringify(outboundEvent));
      throw new Error("expected handler to reject unsupported event");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedInboundWorkOrderSagaEvent);
    }
    expect(await repository.findByWorkOrderId(77)).toBeNull();
  });
});
