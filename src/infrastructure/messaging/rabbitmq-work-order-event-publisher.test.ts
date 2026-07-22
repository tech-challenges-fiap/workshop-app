import { describe, expect, it } from "bun:test";

import {
  RabbitMqPublishRejected,
  RabbitMqWorkOrderEventPublisher,
  type RabbitMqPublisherChannel,
} from "./rabbitmq-work-order-event-publisher";
import {
  createWorkOrderEvent,
  OsWorkOrderEventName,
  parseWorkOrderEvent,
} from "../../domain/work-order/events/work-order-events";

describe("rabbitmq work-order publisher", () => {
  it("publishes serialized JSON events using event name as routing key", async () => {
    const calls: Array<Parameters<RabbitMqPublisherChannel["publish"]>> = [];
    const channel: RabbitMqPublisherChannel = {
      publish: (...args) => {
        calls.push(args);
        return true;
      },
    };
    const publisher = new RabbitMqWorkOrderEventPublisher(channel, {
      exchange: "workshop.os.events",
    });
    const event = createWorkOrderEvent({
      eventId: "event-1",
      eventName: OsWorkOrderEventName.DIAGNOSIS_COMPLETED,
      correlationId: "correlation-1",
      occurredAt: new Date("2026-07-19T00:00:00.000Z"),
      payload: { workOrderId: 123, status: "WAITING_APPROVAL" },
    });

    await publisher.publish(event);

    expect(calls).toHaveLength(1);
    const [exchange, routingKey, content, options] = calls[0];
    expect(exchange).toBe("workshop.os.events");
    expect(routingKey).toBe(OsWorkOrderEventName.DIAGNOSIS_COMPLETED);
    expect(parseWorkOrderEvent(content)).toEqual(event);
    expect(options).toMatchObject({
      contentType: "application/json",
      deliveryMode: 2,
      messageId: "event-1",
      correlationId: "correlation-1",
      type: OsWorkOrderEventName.DIAGNOSIS_COMPLETED,
    });
  });

  it("surfaces rejected RabbitMQ publish attempts", async () => {
    const channel: RabbitMqPublisherChannel = {
      publish: () => false,
    };
    const publisher = new RabbitMqWorkOrderEventPublisher(channel, {
      exchange: "workshop.os.events",
    });
    const event = createWorkOrderEvent({
      eventId: "event-1",
      eventName: OsWorkOrderEventName.RECEIVED,
      correlationId: "correlation-1",
      payload: { workOrderId: 123 },
    });

    try {
      await publisher.publish(event);
      throw new Error("expected publisher to reject event");
    } catch (error) {
      expect(error).toBeInstanceOf(RabbitMqPublishRejected);
    }
  });
});
