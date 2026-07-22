import { createHash } from "node:crypto";

import type { WorkOrderEventPublisher } from "../../domain/work-order/events/work-order-event-publisher";
import {
  createWorkOrderEvent,
  OsWorkOrderEventName,
  type WorkOrderEventPayload,
} from "../../domain/work-order/events/work-order-events";
import type { WorkOrderSagaRepository } from "../../domain/work-order/repository/work-order-saga-repository";
import {
  WorkOrderSaga,
  WorkOrderSagaEventType,
  type WorkOrderSagaSnapshot,
} from "../../domain/work-order/saga/work-order-saga";

export interface OrchestrateWorkOrderSagaInput {
  workOrderId: number;
  eventType: WorkOrderSagaEventType;
  eventId?: string;
  occurredAt?: Date;
  compensationReason?: string;
  correlationId?: string;
}

export interface OrchestrateWorkOrderSagaOutput {
  result: "started" | "transitioned" | "duplicate";
  saga: WorkOrderSagaSnapshot;
}

export class OrchestrateWorkOrderSaga {
  constructor(
    private readonly workOrderSagaRepository: WorkOrderSagaRepository,
    private readonly workOrderEventPublisher?: WorkOrderEventPublisher,
  ) {}

  public async execute(
    input: OrchestrateWorkOrderSagaInput,
  ): Promise<OrchestrateWorkOrderSagaOutput> {
    if (input.eventId && (await this.workOrderSagaRepository.hasProcessedEvent(input.eventId))) {
      const saga = await this.findExistingSaga(input.workOrderId);
      return { result: "duplicate", saga: saga.toSnapshot() };
    }

    if (input.eventType === WorkOrderSagaEventType.STARTED) {
      return this.startSaga(input);
    }

    const saga = await this.findExistingSaga(input.workOrderId);
    saga.apply({
      eventType: input.eventType,
      eventId: input.eventId,
      occurredAt: input.occurredAt,
      compensationReason: input.compensationReason,
    });

    const saved = await this.workOrderSagaRepository.save(saga);
    await this.recordEventIfNeeded(input, saved);
    await this.publishDistributedIntentIfNeeded(input);

    return {
      result: "transitioned",
      saga: saved.toSnapshot(),
    };
  }

  private async startSaga(
    input: OrchestrateWorkOrderSagaInput,
  ): Promise<OrchestrateWorkOrderSagaOutput> {
    const existing = await this.workOrderSagaRepository.findByWorkOrderId(input.workOrderId);

    if (existing) {
      await this.recordEventIfNeeded(input, existing);
      return { result: "duplicate", saga: existing.toSnapshot() };
    }

    const saga = WorkOrderSaga.start({ workOrderId: input.workOrderId, now: input.occurredAt });
    const created = await this.workOrderSagaRepository.create(saga);
    await this.recordEventIfNeeded(input, created);
    await this.publishDistributedIntentIfNeeded(input);

    return {
      result: "started",
      saga: created.toSnapshot(),
    };
  }

  private async findExistingSaga(workOrderId: number): Promise<WorkOrderSaga> {
    const saga = await this.workOrderSagaRepository.findByWorkOrderId(workOrderId);

    if (!saga) {
      return this.workOrderSagaRepository.create(WorkOrderSaga.start({ workOrderId }));
    }

    return saga;
  }

  private async recordEventIfNeeded(
    input: OrchestrateWorkOrderSagaInput,
    saga: WorkOrderSaga,
  ): Promise<void> {
    if (!input.eventId) {
      return;
    }

    await this.workOrderSagaRepository.recordProcessedEvent({
      sagaId: saga.toSnapshot().sagaId,
      eventId: input.eventId,
      eventType: input.eventType,
      payloadHash: hashSagaEventPayload(input),
      processedAt: input.occurredAt ?? new Date(),
    });
  }

  private async publishDistributedIntentIfNeeded(input: OrchestrateWorkOrderSagaInput): Promise<void> {
    if (!this.workOrderEventPublisher || !input.correlationId) {
      return;
    }

    const eventName = resolveDistributedIntentEventName(input.eventType);
    if (!eventName) {
      return;
    }

    const payload: WorkOrderEventPayload = {
      workOrderId: input.workOrderId,
      ...(input.compensationReason ? { compensationReason: input.compensationReason } : {}),
    };

    await this.workOrderEventPublisher.publish(
      createWorkOrderEvent({
        eventName,
        payload,
        correlationId: input.correlationId,
        occurredAt: input.occurredAt,
      }),
    );
  }
}

function resolveDistributedIntentEventName(
  eventType: WorkOrderSagaEventType,
): OsWorkOrderEventName | null {
  switch (eventType) {
    case WorkOrderSagaEventType.STARTED:
      return OsWorkOrderEventName.BILLING_AUTHORIZATION_REQUESTED;
    case WorkOrderSagaEventType.APPROVAL_GRANTED:
      return OsWorkOrderEventName.EXECUTION_REQUESTED;
    case WorkOrderSagaEventType.APPROVAL_REJECTED:
    case WorkOrderSagaEventType.EXECUTION_FAILED:
      return OsWorkOrderEventName.COMPENSATION_REQUESTED;
    default:
      return null;
  }
}

function hashSagaEventPayload(input: OrchestrateWorkOrderSagaInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
