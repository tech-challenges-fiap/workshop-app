import { parseWorkOrderEvent, type WorkOrderEventEnvelope } from "../../domain/work-order/events/work-order-events";
import { WorkOrderSagaEventType } from "../../domain/work-order/saga/work-order-saga";
import type {
  InboundWorkOrderSagaEventName,
  WorkOrderEventName,
} from "../../domain/work-order/events/work-order-events";
import { InboundWorkOrderSagaEventName as SagaEventName } from "../../domain/work-order/events/work-order-events";
import type { OrchestrateWorkOrderSagaOutput } from "./orchestrate-work-order-saga";
import { OrchestrateWorkOrderSaga } from "./orchestrate-work-order-saga";

export interface HandleInboundWorkOrderSagaEventOutput {
  correlationId: string;
  eventId: string;
  sagaResult: OrchestrateWorkOrderSagaOutput;
}

const SAGA_EVENT_TYPE_BY_NAME: Record<InboundWorkOrderSagaEventName, WorkOrderSagaEventType> = {
  [SagaEventName.DIAGNOSIS_STARTED]: WorkOrderSagaEventType.DIAGNOSIS_STARTED,
  [SagaEventName.DIAGNOSIS_COMPLETED]: WorkOrderSagaEventType.DIAGNOSIS_COMPLETED,
  [SagaEventName.APPROVAL_GRANTED]: WorkOrderSagaEventType.APPROVAL_GRANTED,
  [SagaEventName.APPROVAL_REJECTED]: WorkOrderSagaEventType.APPROVAL_REJECTED,
  [SagaEventName.EXECUTION_STARTED]: WorkOrderSagaEventType.EXECUTION_STARTED,
  [SagaEventName.EXECUTION_COMPLETED]: WorkOrderSagaEventType.EXECUTION_COMPLETED,
  [SagaEventName.EXECUTION_FAILED]: WorkOrderSagaEventType.EXECUTION_FAILED,
  [SagaEventName.VEHICLE_DELIVERED]: WorkOrderSagaEventType.VEHICLE_DELIVERED,
  [SagaEventName.CANCELLATION_REQUESTED]: WorkOrderSagaEventType.CANCELLATION_REQUESTED,
  [SagaEventName.COMPENSATION_COMPLETED]: WorkOrderSagaEventType.COMPENSATION_COMPLETED,
};

export class UnsupportedInboundWorkOrderSagaEvent extends Error {
  constructor(eventName: WorkOrderEventName) {
    super(`Unsupported inbound work-order saga event: ${eventName}`);
  }
}

export class HandleInboundWorkOrderSagaEvent {
  constructor(private readonly orchestrateWorkOrderSaga: OrchestrateWorkOrderSaga) {}

  public async handle(
    rawMessage: string | Uint8Array,
  ): Promise<HandleInboundWorkOrderSagaEventOutput> {
    const event = parseWorkOrderEvent(rawMessage);
    const eventType = mapInboundEventName(event.eventName);
    const sagaResult = await this.orchestrateWorkOrderSaga.execute({
      workOrderId: event.payload.workOrderId,
      eventType,
      eventId: event.eventId,
      occurredAt: new Date(event.occurredAt),
      compensationReason: event.payload.compensationReason,
      correlationId: event.correlationId,
    });

    return {
      correlationId: event.correlationId,
      eventId: event.eventId,
      sagaResult,
    };
  }

  public async handleEnvelope(
    event: WorkOrderEventEnvelope,
  ): Promise<HandleInboundWorkOrderSagaEventOutput> {
    return this.handle(JSON.stringify(event));
  }
}

function mapInboundEventName(eventName: WorkOrderEventName): WorkOrderSagaEventType {
  const eventType = SAGA_EVENT_TYPE_BY_NAME[eventName as InboundWorkOrderSagaEventName];

  if (!eventType) {
    throw new UnsupportedInboundWorkOrderSagaEvent(eventName);
  }

  return eventType;
}
