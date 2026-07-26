import type { WorkOrderEventPublisher } from "../../../domain/work-order/events/work-order-event-publisher";
import type { WorkOrderEventEnvelope } from "../../../domain/work-order/events/work-order-events";

/**
 * Test double for the work-order event publisher port that records every
 * published envelope in order, so tests can assert on distributed intents
 * without a live RabbitMQ broker. Shared across the work-order saga
 * application tests and the BDD step definitions.
 */
export class RecordingWorkOrderEventPublisher implements WorkOrderEventPublisher {
  public readonly events: WorkOrderEventEnvelope[] = [];

  public async publish(event: WorkOrderEventEnvelope): Promise<void> {
    this.events.push(event);
  }
}
