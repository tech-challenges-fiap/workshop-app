import { describe, expect, it } from "bun:test";

import {
  createWorkOrderEvent,
  InboundWorkOrderSagaEventName,
  OsWorkOrderEventName,
  parseWorkOrderEvent,
  serializeWorkOrderEvent,
  WorkOrderEventValidationError,
} from "./work-order-events";

describe("work-order event envelopes", () => {
  it("serializes and parses versioned work-order events", () => {
    const event = createWorkOrderEvent({
      eventId: "event-1",
      eventName: OsWorkOrderEventName.RECEIVED,
      correlationId: "correlation-1",
      occurredAt: new Date("2026-07-19T00:00:00.000Z"),
      payload: { workOrderId: 123, status: "RECEIVED" },
    });

    const serialized = serializeWorkOrderEvent(event);
    const parsed = parseWorkOrderEvent(serialized);

    expect(parsed).toEqual({
      eventId: "event-1",
      eventName: OsWorkOrderEventName.RECEIVED,
      occurredAt: "2026-07-19T00:00:00.000Z",
      correlationId: "correlation-1",
      producer: "workshop-app",
      schemaVersion: 1,
      payload: { workOrderId: 123, status: "RECEIVED" },
    });
  });

  it("parses inbound saga event messages from bytes", () => {
    const event = createWorkOrderEvent({
      eventId: "event-approval-granted",
      eventName: InboundWorkOrderSagaEventName.APPROVAL_GRANTED,
      correlationId: "correlation-1",
      occurredAt: new Date("2026-07-19T00:01:00.000Z"),
      producer: "billing-service",
      payload: { workOrderId: 10 },
    });

    const parsed = parseWorkOrderEvent(new TextEncoder().encode(JSON.stringify(event)));

    expect(parsed.eventName).toBe(InboundWorkOrderSagaEventName.APPROVAL_GRANTED);
    expect(parsed.payload.workOrderId).toBe(10);
  });

  it("rejects malformed JSON and invalid work-order ids", () => {
    expect(() => parseWorkOrderEvent("not-json")).toThrow(WorkOrderEventValidationError);

    expect(() =>
      parseWorkOrderEvent(
        JSON.stringify({
          eventId: "event-1",
          eventName: OsWorkOrderEventName.RECEIVED,
          occurredAt: "2026-07-19T00:00:00.000Z",
          correlationId: "correlation-1",
          producer: "workshop-app",
          schemaVersion: 1,
          payload: { workOrderId: 0 },
        }),
      ),
    ).toThrow("payload.workOrderId must be a positive integer");
  });
});
