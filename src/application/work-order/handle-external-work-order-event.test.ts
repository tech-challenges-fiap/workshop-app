import { describe, expect, it, vi } from "bun:test";

import {
  HandleExternalWorkOrderEvent,
  type HandleExternalWorkOrderEventInput,
} from "./handle-external-work-order-event";
import type { WorkOrderWebhookEventRepository } from "../../domain/work-order/repository/work-order-webhook-event-repository";
import { WorkOrderWebhookEventInvalid } from "../../domain/work-order/domain-error/work-order-webhook-event-invalid";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";
import { WorkOrderStatusTransitionNotAllowed } from "../../domain/work-order/domain-error/work-order-status-transition-not-allowed";

class InMemoryWorkOrderWebhookEventRepository implements WorkOrderWebhookEventRepository {
  public pending = new Set<string>();
  public processed = new Set<string>();

  public async registerPending(input: {
    eventId: string;
    eventType: string;
    payloadHash: string;
  }): Promise<boolean> {
    if (this.pending.has(input.eventId) || this.processed.has(input.eventId)) {
      return false;
    }

    this.pending.add(input.eventId);
    return true;
  }

  public async markProcessed(eventId: string): Promise<void> {
    this.pending.delete(eventId);
    this.processed.add(eventId);
  }

  public async releasePending(eventId: string): Promise<void> {
    this.pending.delete(eventId);
  }
}

function buildUseCase(params?: {
  repository?: InMemoryWorkOrderWebhookEventRepository;
  approveImpl?: (input: { id: number; workOrderId?: number }) => Promise<unknown>;
  rejectImpl?: (input: { id: number; workOrderId?: number }) => Promise<unknown>;
  startDiagnosisImpl?: (input: { id: number; startedAt?: Date }) => Promise<unknown>;
}) {
  const repository = params?.repository ?? new InMemoryWorkOrderWebhookEventRepository();
  const approveServiceTask = {
    execute: vi.fn(
      params?.approveImpl ??
        (async () => {
          return {};
        }),
    ),
  };
  const rejectServiceTask = {
    execute: vi.fn(
      params?.rejectImpl ??
        (async () => {
          return {};
        }),
    ),
  };
  const startServiceExecution = {
    execute: vi.fn(async () => {
      return {};
    }),
  };
  const completeServiceTask = {
    execute: vi.fn(async () => {
      return {};
    }),
  };
  const startDiagnosis = {
    execute: vi.fn(
      params?.startDiagnosisImpl ??
        (async () => {
          return {};
        }),
    ),
  };
  const completeDiagnosis = {
    execute: vi.fn(async () => {
      return {};
    }),
  };
  const cancelWorkOrder = {
    execute: vi.fn(async () => {
      return {};
    }),
  };
  const deliverVehicle = {
    execute: vi.fn(async () => {
      return {};
    }),
  };

  const useCase = new HandleExternalWorkOrderEvent({
    approveServiceTask: approveServiceTask as never,
    rejectServiceTask: rejectServiceTask as never,
    startServiceExecution: startServiceExecution as never,
    completeServiceTask: completeServiceTask as never,
    startDiagnosis: startDiagnosis as never,
    completeDiagnosis: completeDiagnosis as never,
    cancelWorkOrder: cancelWorkOrder as never,
    deliverVehicle: deliverVehicle as never,
    workOrderWebhookEventRepository: repository,
  });

  return {
    useCase,
    repository,
    approveServiceTask,
    rejectServiceTask,
    startServiceExecution,
    completeServiceTask,
    startDiagnosis,
    completeDiagnosis,
    cancelWorkOrder,
    deliverVehicle,
  };
}

describe("HandleExternalWorkOrderEvent", () => {
  it("dispatches SERVICE_TASK_APPROVED and marks the event as processed", async () => {
    const { useCase, repository, approveServiceTask } = buildUseCase();
    const input: HandleExternalWorkOrderEventInput = {
      eventId: "event-1",
      eventType: "SERVICE_TASK_APPROVED",
      workOrderId: 11,
      serviceTaskId: 22,
      occurredAt: new Date("2024-01-10T10:00:00.000Z"),
    };

    const result = await useCase.execute(input);

    expect(result).toEqual({
      eventId: "event-1",
      eventType: "SERVICE_TASK_APPROVED",
      result: "processed",
    });
    expect(approveServiceTask.execute).toHaveBeenCalledWith({
      id: 22,
      workOrderId: 11,
    });
    expect(repository.processed.has("event-1")).toBe(true);
  });

  it("returns duplicate when an event id was already processed", async () => {
    const repository = new InMemoryWorkOrderWebhookEventRepository();
    repository.processed.add("event-dup");
    const { useCase, approveServiceTask } = buildUseCase({ repository });

    const result = await useCase.execute({
      eventId: "event-dup",
      eventType: "SERVICE_TASK_APPROVED",
      workOrderId: 1,
      serviceTaskId: 2,
    });

    expect(result).toEqual({
      eventId: "event-dup",
      eventType: "SERVICE_TASK_APPROVED",
      result: "duplicate",
    });
    expect(approveServiceTask.execute).toHaveBeenCalledTimes(0);
  });

  it("releases pending idempotency lock when transition fails", async () => {
    const { useCase, repository } = buildUseCase({
      approveImpl: async () => {
        throw new WorkOrderStatusTransitionNotAllowed({
          from: WorkOrderStatus.RECEIVED,
          to: WorkOrderStatus.WAITING_APPROVAL,
        });
      },
    });

    expect(
      useCase.execute({
        eventId: "event-transition-fail",
        eventType: "SERVICE_TASK_APPROVED",
        workOrderId: 1,
        serviceTaskId: 2,
      }),
    ).rejects.toBeInstanceOf(WorkOrderStatusTransitionNotAllowed);

    expect(repository.pending.has("event-transition-fail")).toBe(false);
    expect(repository.processed.has("event-transition-fail")).toBe(false);
  });

  it("throws validation error when IN_EXECUTION status update misses serviceTaskId", async () => {
    const { useCase } = buildUseCase();

    expect(
      useCase.execute({
        eventId: "event-invalid",
        eventType: "WORK_ORDER_STATUS_UPDATED",
        workOrderId: 33,
        targetStatus: WorkOrderStatus.IN_EXECUTION,
      }),
    ).rejects.toBeInstanceOf(WorkOrderWebhookEventInvalid);
  });

  it("dispatches WORK_ORDER_STATUS_UPDATED to diagnosis use case", async () => {
    const { useCase, startDiagnosis } = buildUseCase();
    const occurredAt = new Date("2024-01-10T09:00:00.000Z");

    const result = await useCase.execute({
      eventId: "event-diagnosis",
      eventType: "WORK_ORDER_STATUS_UPDATED",
      workOrderId: 44,
      targetStatus: WorkOrderStatus.DIAGNOSIS,
      occurredAt,
    });

    expect(result.result).toBe("processed");
    expect(startDiagnosis.execute).toHaveBeenCalledWith({
      id: 44,
      startedAt: occurredAt,
    });
  });
});
