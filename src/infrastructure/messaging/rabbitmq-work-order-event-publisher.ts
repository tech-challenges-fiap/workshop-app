import type { WorkOrderEventPublisher } from "../../domain/work-order/events/work-order-event-publisher";
import {
  serializeWorkOrderEvent,
  type WorkOrderEventEnvelope,
} from "../../domain/work-order/events/work-order-events";

export interface RabbitMqPublisherChannel {
  publish(
    exchange: string,
    routingKey: string,
    content: Uint8Array,
    options: RabbitMqPublishOptions,
  ): boolean | Promise<boolean>;
}

export interface RabbitMqPublishOptions {
  contentType: "application/json";
  deliveryMode: 2;
  messageId: string;
  correlationId: string;
  timestamp: number;
  type: string;
}

export interface RabbitMqWorkOrderEventPublisherConfig {
  exchange: string;
}

export class RabbitMqWorkOrderEventPublisher implements WorkOrderEventPublisher {
  constructor(
    private readonly channel: RabbitMqPublisherChannel,
    private readonly config: RabbitMqWorkOrderEventPublisherConfig,
  ) {}

  public async publish(event: WorkOrderEventEnvelope): Promise<void> {
    const serialized = serializeWorkOrderEvent(event);
    const accepted = await this.channel.publish(
      this.config.exchange,
      event.eventName,
      new TextEncoder().encode(serialized),
      {
        contentType: "application/json",
        deliveryMode: 2,
        messageId: event.eventId,
        correlationId: event.correlationId,
        timestamp: Math.floor(Date.parse(event.occurredAt) / 1000),
        type: event.eventName,
      },
    );

    if (!accepted) {
      throw new RabbitMqPublishRejected(event.eventId);
    }
  }
}

export class RabbitMqPublishRejected extends Error {
  constructor(eventId: string) {
    super(`RabbitMQ publish was rejected for event ${eventId}`);
    this.name = "RabbitMqPublishRejected";
  }
}
