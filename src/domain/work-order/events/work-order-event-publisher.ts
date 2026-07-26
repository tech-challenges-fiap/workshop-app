import type { WorkOrderEventEnvelope } from "../events/work-order-events";

export interface WorkOrderEventPublisher {
  publish(event: WorkOrderEventEnvelope): Promise<void>;
}

export class NoopWorkOrderEventPublisher implements WorkOrderEventPublisher {
  public async publish(): Promise<void> {
    // RabbitMQ is optional in local/unit-test composition for this foundation.
  }
}
