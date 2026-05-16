import { describe, expect, it, vi } from "bun:test";
import { Hono } from "hono";

import { registerWebhookWorkOrderEventRoutes } from "./work-order-events";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import { WorkOrderStatusTransitionNotAllowed } from "../../domain/work-order/domain-error/work-order-status-transition-not-allowed";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";

function buildApp() {
  const app = new Hono();
  const handleExternalWorkOrderEvent = {
    execute: vi.fn(async () => ({
      eventId: "event-1",
      eventType: "SERVICE_TASK_APPROVED",
      result: "processed",
    })),
  };

  registerWebhookWorkOrderEventRoutes(app, {
    handleExternalWorkOrderEvent: handleExternalWorkOrderEvent as never,
  });

  return { app, handleExternalWorkOrderEvent };
}

describe("Webhook work-order event routes", () => {
  it("returns 200 for a valid event", async () => {
    const { app, handleExternalWorkOrderEvent } = buildApp();

    const response = await app.request("/webhooks/work-orders/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId: "event-1",
        eventType: "SERVICE_TASK_APPROVED",
        workOrderId: 1,
        serviceTaskId: 2,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      eventId: "event-1",
      eventType: "SERVICE_TASK_APPROVED",
      result: "processed",
    });
    expect(handleExternalWorkOrderEvent.execute).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid payload", async () => {
    const { app } = buildApp();

    const response = await app.request("/webhooks/work-orders/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId: "event-invalid",
        eventType: "SERVICE_TASK_APPROVED",
        workOrderId: 1,
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("ValidationError");
  });

  it("returns 404 when use case reports missing resource", async () => {
    const { app, handleExternalWorkOrderEvent } = buildApp();
    handleExternalWorkOrderEvent.execute.mockRejectedValueOnce(new WorkOrderNotFound(999));

    const response = await app.request("/webhooks/work-orders/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId: "event-not-found",
        eventType: "SERVICE_TASK_APPROVED",
        workOrderId: 999,
        serviceTaskId: 1,
      }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("WorkOrderNotFound");
  });

  it("returns 409 when transition is not allowed", async () => {
    const { app, handleExternalWorkOrderEvent } = buildApp();
    handleExternalWorkOrderEvent.execute.mockRejectedValueOnce(
      new WorkOrderStatusTransitionNotAllowed({
        from: WorkOrderStatus.RECEIVED,
        to: WorkOrderStatus.DELIVERED,
      }),
    );

    const response = await app.request("/webhooks/work-orders/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId: "event-conflict",
        eventType: "WORK_ORDER_STATUS_UPDATED",
        workOrderId: 1,
        targetStatus: "DELIVERED",
      }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe(WorkOrderStatusTransitionNotAllowed.name);
  });
});
