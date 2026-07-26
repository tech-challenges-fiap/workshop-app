import { describe, expect, it } from "bun:test";

import { HandleInboundWorkOrderSagaEvent } from "./handle-inbound-work-order-saga-event";
import { OrchestrateWorkOrderSaga } from "./orchestrate-work-order-saga";
import type { WorkOrderEventPublisher } from "../../domain/work-order/events/work-order-event-publisher";
import {
  createWorkOrderEvent,
  InboundWorkOrderSagaEventName,
  OsWorkOrderEventName,
  type WorkOrderEventEnvelope,
} from "../../domain/work-order/events/work-order-events";
import type {
  RegisterWorkOrderSagaEventInput,
  WorkOrderSagaRepository,
} from "../../domain/work-order/repository/work-order-saga-repository";
import {
  WorkOrderSaga,
  WorkOrderSagaEventType,
  WorkOrderSagaState,
} from "../../domain/work-order/saga/work-order-saga";

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

class RecordingWorkOrderEventPublisher implements WorkOrderEventPublisher {
  public readonly events: WorkOrderEventEnvelope[] = [];

  public async publish(event: WorkOrderEventEnvelope): Promise<void> {
    this.events.push(event);
  }
}

function buildFlow(): {
  orchestrator: OrchestrateWorkOrderSaga;
  handler: HandleInboundWorkOrderSagaEvent;
  publisher: RecordingWorkOrderEventPublisher;
} {
  const repository = new InMemoryWorkOrderSagaRepository();
  const publisher = new RecordingWorkOrderEventPublisher();
  const orchestrator = new OrchestrateWorkOrderSaga(repository, publisher);
  return {
    orchestrator,
    handler: new HandleInboundWorkOrderSagaEvent(orchestrator),
    publisher,
  };
}

async function moveToWaitingApproval(orchestrator: OrchestrateWorkOrderSaga): Promise<void> {
  await orchestrator.execute({ workOrderId: 501, eventType: WorkOrderSagaEventType.STARTED });
  await orchestrator.execute({
    workOrderId: 501,
    eventType: WorkOrderSagaEventType.DIAGNOSIS_STARTED,
  });
  await orchestrator.execute({
    workOrderId: 501,
    eventType: WorkOrderSagaEventType.DIAGNOSIS_COMPLETED,
  });
}

describe("OS distributed work-order flow", () => {
  it("publishes billing and execution intents on the happy path", async () => {
    const { orchestrator, handler, publisher } = buildFlow();

    const started = await orchestrator.execute({
      workOrderId: 501,
      eventType: WorkOrderSagaEventType.STARTED,
      eventId: "os-start-501",
      correlationId: "correlation-happy",
      occurredAt: new Date("2026-07-19T10:00:00.000Z"),
    });
    await orchestrator.execute({
      workOrderId: 501,
      eventType: WorkOrderSagaEventType.DIAGNOSIS_STARTED,
    });
    await orchestrator.execute({
      workOrderId: 501,
      eventType: WorkOrderSagaEventType.DIAGNOSIS_COMPLETED,
    });

    const authorized = await handler.handleEnvelope(
      createWorkOrderEvent({
        eventId: "billing-authorized-501",
        eventName: InboundWorkOrderSagaEventName.APPROVAL_GRANTED,
        correlationId: "correlation-happy",
        producer: "billing-service",
        payload: { workOrderId: 501 },
      }),
    );
    const completed = await handler.handleEnvelope(
      createWorkOrderEvent({
        eventId: "execution-completed-501",
        eventName: InboundWorkOrderSagaEventName.EXECUTION_COMPLETED,
        correlationId: "correlation-happy",
        producer: "execution-service",
        payload: { workOrderId: 501 },
      }),
    );

    expect(started.saga.state).toBe(WorkOrderSagaState.RECEIVED);
    expect(authorized.sagaResult.saga.state).toBe(WorkOrderSagaState.APPROVED);
    expect(completed.sagaResult.saga.state).toBe(WorkOrderSagaState.COMPLETED);
    expect(publisher.events.map((event) => event.eventName)).toEqual([
      OsWorkOrderEventName.BILLING_AUTHORIZATION_REQUESTED,
      OsWorkOrderEventName.EXECUTION_REQUESTED,
    ]);
    expect(publisher.events.every((event) => event.correlationId === "correlation-happy")).toBe(true);
  });

  it("publishes compensation intent for billing failure", async () => {
    const { orchestrator, handler, publisher } = buildFlow();
    await moveToWaitingApproval(orchestrator);

    const result = await handler.handleEnvelope(
      createWorkOrderEvent({
        eventId: "billing-rejected-501",
        eventName: InboundWorkOrderSagaEventName.APPROVAL_REJECTED,
        correlationId: "correlation-billing-failure",
        producer: "billing-service",
        payload: { workOrderId: 501, compensationReason: "billing authorization failed" },
      }),
    );

    expect(result.sagaResult.saga.state).toBe(WorkOrderSagaState.COMPENSATING);
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]).toMatchObject({
      eventName: OsWorkOrderEventName.COMPENSATION_REQUESTED,
      correlationId: "correlation-billing-failure",
      payload: { workOrderId: 501, compensationReason: "billing authorization failed" },
    });
  });

  it("publishes compensation intent for execution failure", async () => {
    const { orchestrator, handler, publisher } = buildFlow();
    await moveToWaitingApproval(orchestrator);
    await handler.handleEnvelope(
      createWorkOrderEvent({
        eventId: "billing-authorized-501",
        eventName: InboundWorkOrderSagaEventName.APPROVAL_GRANTED,
        correlationId: "correlation-execution-failure",
        producer: "billing-service",
        payload: { workOrderId: 501 },
      }),
    );
    await handler.handleEnvelope(
      createWorkOrderEvent({
        eventId: "execution-started-501",
        eventName: InboundWorkOrderSagaEventName.EXECUTION_STARTED,
        correlationId: "correlation-execution-failure",
        producer: "execution-service",
        payload: { workOrderId: 501 },
      }),
    );

    const failed = await handler.handleEnvelope(
      createWorkOrderEvent({
        eventId: "execution-failed-501",
        eventName: InboundWorkOrderSagaEventName.EXECUTION_FAILED,
        correlationId: "correlation-execution-failure",
        producer: "execution-service",
        payload: { workOrderId: 501, compensationReason: "technician could not complete service" },
      }),
    );

    expect(failed.sagaResult.saga.state).toBe(WorkOrderSagaState.COMPENSATING);
    expect(publisher.events.map((event) => event.eventName)).toEqual([
      OsWorkOrderEventName.EXECUTION_REQUESTED,
      OsWorkOrderEventName.COMPENSATION_REQUESTED,
    ]);
    expect(publisher.events[1].payload.compensationReason).toBe(
      "technician could not complete service",
    );
  });

  it("does not republish outbound intents for duplicate inbound events", async () => {
    const { orchestrator, handler, publisher } = buildFlow();
    await moveToWaitingApproval(orchestrator);
    const inbound = createWorkOrderEvent({
      eventId: "billing-authorized-duplicate-501",
      eventName: InboundWorkOrderSagaEventName.APPROVAL_GRANTED,
      correlationId: "correlation-duplicate",
      producer: "billing-service",
      payload: { workOrderId: 501 },
    });

    const first = await handler.handleEnvelope(inbound);
    const duplicate = await handler.handleEnvelope(inbound);

    expect(first.sagaResult.result).toBe("transitioned");
    expect(duplicate.sagaResult.result).toBe("duplicate");
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0].eventName).toBe(OsWorkOrderEventName.EXECUTION_REQUESTED);
  });

  it("propagates inbound correlation ids to distributed outbound intents", async () => {
    const { orchestrator, handler, publisher } = buildFlow();
    await moveToWaitingApproval(orchestrator);

    await handler.handleEnvelope(
      createWorkOrderEvent({
        eventId: "billing-authorized-correlation-501",
        eventName: InboundWorkOrderSagaEventName.APPROVAL_GRANTED,
        correlationId: "correlation-propagated",
        producer: "billing-service",
        payload: { workOrderId: 501 },
      }),
    );

    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0].correlationId).toBe("correlation-propagated");
    expect(publisher.events[0].eventId).not.toBe("billing-authorized-correlation-501");
  });
});
