import { describe, expect, it } from "bun:test";

import { WorkOrder } from "./work-order";
import { WorkOrderStatusTransitionNotAllowed } from "../domain-error/work-order-status-transition-not-allowed";
import { WorkOrderStatus } from "../value-object/work-order-status";
import { ServiceTaskStatus } from "../../service-task/value-object/service-task-status";
import { Money } from "../../shared/value-object/money";
import { WorkOrderServiceTaskCreationNotAllowed } from "../domain-error/work-order-service-task-creation-not-allowed";
import { WorkOrderFinalizationNotAllowed } from "../domain-error/work-order-finalization-not-allowed";

function buildWorkOrderServiceTask(params: {
  id: number;
  status: ServiceTaskStatus;
  amount: number;
}) {
  return {
    serviceTaskId: params.id,
    status: params.status,
    amount: Money.create(params.amount),
  };
}

function buildWorkOrder(params?: {
  serviceTasks?: { serviceTaskId: number; status: ServiceTaskStatus; amount: Money }[];
  publicTokenExpiresAt?: Date;
}): WorkOrder {
  return WorkOrder.create({
    vehicleId: 10,
    publicToken: "public-token",
    publicTokenExpiresAt: params?.publicTokenExpiresAt ?? new Date("2024-01-10T12:00:00.000Z"),
    serviceTasks: params?.serviceTasks ?? [],
    createdAt: new Date("2024-01-10T08:00:00.000Z"),
  });
}

function buildInExecutionWorkOrder(params: {
  serviceTasks: { serviceTaskId: number; status: ServiceTaskStatus; amount: number }[];
  updatedAt?: Date;
}): WorkOrder {
  const updatedAt = params.updatedAt ?? new Date("2024-01-10T09:00:00.000Z");
  const totalAmountValue = params.serviceTasks.reduce((sum, task) => {
    const isBillable =
      task.status !== ServiceTaskStatus.REJECTED && task.status !== ServiceTaskStatus.CANCELED;
    return isBillable ? sum + task.amount : sum;
  }, 0);

  return WorkOrder.rehydrate({
    id: 1,
    vehicleId: 10,
    status: WorkOrderStatus.IN_EXECUTION,
    totalAmount: Money.create(totalAmountValue),
    publicToken: "public-token",
    publicTokenExpiresAt: new Date("2024-01-10T12:00:00.000Z"),
    createdAt: new Date("2024-01-10T08:00:00.000Z"),
    updatedAt,
    serviceTasks: params.serviceTasks.map((task) => ({
      serviceTaskId: task.serviceTaskId,
      status: task.status,
      amount: Money.create(task.amount),
    })),
  });
}

describe("WorkOrder", () => {
  it("completes the work order lifecycle", () => {
    const serviceTasks = [
      buildWorkOrderServiceTask({
        id: 1,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 200,
      }),
      buildWorkOrderServiceTask({
        id: 2,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 100,
      }),
    ];

    const workOrder = buildWorkOrder({ serviceTasks });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    serviceTasks[0].status = ServiceTaskStatus.APPROVED;
    serviceTasks[1].status = ServiceTaskStatus.REJECTED;
    workOrder.syncServiceTasks({
      tasks: serviceTasks,
      now: new Date("2024-01-10T08:30:00.000Z"),
    });

    expect(workOrder.toSnapshot().status).toBe(WorkOrderStatus.READY);

    workOrder.startExecution(new Date("2024-01-10T09:00:00.000Z"));

    serviceTasks[0].status = ServiceTaskStatus.COMPLETED;
    serviceTasks[1].status = ServiceTaskStatus.CANCELED;
    workOrder.syncServiceTasks({
      tasks: serviceTasks,
      now: new Date("2024-01-10T10:00:00.000Z"),
    });

    workOrder.finalize(new Date("2024-01-10T11:00:00.000Z"));
    workOrder.deliver(new Date("2024-01-10T12:00:00.000Z"));

    const snapshot = workOrder.toSnapshot();
    expect(snapshot.status).toBe(WorkOrderStatus.DELIVERED);
    expect(snapshot.totalAmount).toBe(200);
  });

  it("cancels when all service tasks are rejected", () => {
    const serviceTasks = [
      buildWorkOrderServiceTask({
        id: 1,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 120,
      }),
      buildWorkOrderServiceTask({
        id: 2,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 80,
      }),
    ];

    const workOrder = buildWorkOrder({ serviceTasks });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    serviceTasks[0].status = ServiceTaskStatus.REJECTED;
    serviceTasks[1].status = ServiceTaskStatus.REJECTED;
    workOrder.syncServiceTasks({
      tasks: serviceTasks,
      now: new Date("2024-01-10T08:30:00.000Z"),
    });

    expect(workOrder.toSnapshot().status).toBe(WorkOrderStatus.CANCELED);
  });

  it("blocks invalid status transitions", () => {
    const workOrder = buildWorkOrder();

    expect(() => workOrder.deliver()).toThrowError(WorkOrderStatusTransitionNotAllowed);

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));

    expect(() => workOrder.finalize()).toThrowError(WorkOrderStatusTransitionNotAllowed);
  });

  it("transitions through diagnosis states", () => {
    const workOrder = buildWorkOrder();
    const startAt = new Date("2024-01-10T08:10:00.000Z");
    const completeAt = new Date("2024-01-10T08:20:00.000Z");

    workOrder.startDiagnosis(startAt);
    expect(workOrder.toSnapshot().status).toBe(WorkOrderStatus.DIAGNOSIS);
    expect(workOrder.toSnapshot().updatedAt).toBe(startAt.toISOString());

    workOrder.completeDiagnosis(completeAt);
    const snapshot = workOrder.toSnapshot();
    expect(snapshot.status).toBe(WorkOrderStatus.WAITING_APPROVAL);
    expect(snapshot.updatedAt).toBe(completeAt.toISOString());
  });

  it("rejects invalid diagnosis transitions", () => {
    const workOrder = buildWorkOrder();

    expect(() => workOrder.completeDiagnosis()).toThrowError(WorkOrderStatusTransitionNotAllowed);

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));

    expect(() => workOrder.startDiagnosis()).toThrowError(WorkOrderStatusTransitionNotAllowed);

    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    expect(() => workOrder.completeDiagnosis()).toThrowError(WorkOrderStatusTransitionNotAllowed);
    expect(() => workOrder.startDiagnosis()).toThrowError(WorkOrderStatusTransitionNotAllowed);
  });

  it("moves to READY when approval is resolved with at least one approved task", () => {
    const serviceTasks = [
      buildWorkOrderServiceTask({
        id: 1,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 200,
      }),
      buildWorkOrderServiceTask({
        id: 2,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 150,
      }),
    ];
    const workOrder = buildWorkOrder({ serviceTasks });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    serviceTasks[0].status = ServiceTaskStatus.APPROVED;
    serviceTasks[1].status = ServiceTaskStatus.REJECTED;
    workOrder.syncServiceTasks({
      tasks: serviceTasks,
      now: new Date("2024-01-10T08:30:00.000Z"),
    });

    expect(workOrder.toSnapshot().status).toBe(WorkOrderStatus.READY);
  });

  it("keeps WAITING_APPROVAL while there are pending service tasks", () => {
    const serviceTasks = [
      buildWorkOrderServiceTask({
        id: 1,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 200,
      }),
      buildWorkOrderServiceTask({
        id: 2,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 150,
      }),
    ];
    const workOrder = buildWorkOrder({ serviceTasks });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    serviceTasks[0].status = ServiceTaskStatus.APPROVED;
    workOrder.syncServiceTasks({
      tasks: serviceTasks,
      now: new Date("2024-01-10T08:30:00.000Z"),
    });

    expect(workOrder.toSnapshot().status).toBe(WorkOrderStatus.WAITING_APPROVAL);
  });

  it("requires READY to start execution", () => {
    const serviceTasks = [
      buildWorkOrderServiceTask({
        id: 1,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 200,
      }),
    ];
    const workOrder = buildWorkOrder({ serviceTasks });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    expect(() => workOrder.startExecution()).toThrowError(WorkOrderStatusTransitionNotAllowed);
  });

  it("starts execution for a service task when READY", () => {
    const serviceTasks = [
      buildWorkOrderServiceTask({
        id: 1,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 200,
      }),
      buildWorkOrderServiceTask({
        id: 2,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 100,
      }),
    ];

    const workOrder = buildWorkOrder({ serviceTasks });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    serviceTasks[0].status = ServiceTaskStatus.APPROVED;
    serviceTasks[1].status = ServiceTaskStatus.REJECTED;
    workOrder.syncServiceTasks({
      tasks: serviceTasks,
      now: new Date("2024-01-10T08:30:00.000Z"),
    });

    workOrder.startExecutionForServiceTask({
      serviceTaskId: 1,
      now: new Date("2024-01-10T09:00:00.000Z"),
    });

    const snapshot = workOrder.toSnapshot();
    expect(snapshot.status).toBe(WorkOrderStatus.IN_EXECUTION);

    const taskSnapshot = snapshot.serviceTasks.find((task) => task.serviceTaskId === 1);
    expect(taskSnapshot?.status).toBe(ServiceTaskStatus.IN_EXECUTION);
  });

  it("requires READY to start execution for a service task", () => {
    const serviceTasks = [
      buildWorkOrderServiceTask({
        id: 1,
        status: ServiceTaskStatus.PENDING_APPROVAL,
        amount: 200,
      }),
    ];

    const workOrder = buildWorkOrder({ serviceTasks });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    expect(() => workOrder.startExecutionForServiceTask({ serviceTaskId: 1 })).toThrowError(
      WorkOrderStatusTransitionNotAllowed,
    );
  });

  it("validates public token expiration", () => {
    const expiresAt = new Date("2024-01-10T10:00:00.000Z");
    const workOrder = buildWorkOrder({ publicTokenExpiresAt: expiresAt });

    expect(workOrder.isPublicTokenValid(new Date("2024-01-10T09:59:59.000Z"))).toBe(true);
    expect(workOrder.isPublicTokenValid(new Date("2024-01-10T10:00:00.000Z"))).toBe(true);
    expect(workOrder.isPublicTokenValid(new Date("2024-01-10T10:00:01.000Z"))).toBe(false);
  });

  it("allows adding service tasks only while in DIAGNOSIS status", () => {
    const workOrder = buildWorkOrder();

    // Initially in RECEIVED, should not allow
    expect(() => workOrder.assertCanAddServiceTask()).toThrowError(
      WorkOrderServiceTaskCreationNotAllowed,
    );

    // Move to DIAGNOSIS, should allow
    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    expect(() => workOrder.assertCanAddServiceTask()).not.toThrow();

    // Move forward in lifecycle, should block again
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));
    expect(() => workOrder.assertCanAddServiceTask()).toThrowError(
      WorkOrderServiceTaskCreationNotAllowed,
    );
  });

  it("finalizes as FINALIZED when at least one service task is completed and others are canceled", () => {
    const serviceTasks = [
      buildWorkOrderServiceTask({
        id: 1,
        status: ServiceTaskStatus.COMPLETED,
        amount: 200,
      }),
      buildWorkOrderServiceTask({
        id: 2,
        status: ServiceTaskStatus.CANCELED,
        amount: 100,
      }),
    ];

    const workOrder = buildWorkOrder({ serviceTasks });

    // Move directly to IN_EXECUTION to focus on finalization behavior
    (workOrder as any).status = WorkOrderStatus.IN_EXECUTION;

    workOrder.finalize(new Date("2024-01-10T11:00:00.000Z"));

    const snapshot = workOrder.toSnapshot();
    expect(snapshot.status).toBe(WorkOrderStatus.FINALIZED);
  });

  it("does not allow finalizing without service tasks", () => {
    const workOrder = buildWorkOrder({ serviceTasks: [] });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    expect(() => workOrder.startExecution()).toThrowError(WorkOrderStatusTransitionNotAllowed);

    // For completeness, force status and try finalize to exercise the guard
    // (transition validity is covered in other tests).
    (workOrder as any).status = WorkOrderStatus.IN_EXECUTION;

    expect(() => workOrder.finalize()).toThrowError(WorkOrderFinalizationNotAllowed);
  });

  it("does not allow finalizing when there are non-final service tasks", () => {
    const serviceTasks = [
      buildWorkOrderServiceTask({
        id: 1,
        status: ServiceTaskStatus.IN_EXECUTION,
        amount: 100,
      }),
    ];

    const workOrder = buildWorkOrder({ serviceTasks });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    // Force READY -> IN_EXECUTION without going through approval (covered elsewhere)
    (workOrder as any).status = WorkOrderStatus.IN_EXECUTION;

    expect(() => workOrder.finalize()).toThrowError(WorkOrderFinalizationNotAllowed);
  });

  it("finalizes as CANCELED when all service tasks are canceled", () => {
    const serviceTasks = [
      buildWorkOrderServiceTask({
        id: 1,
        status: ServiceTaskStatus.CANCELED,
        amount: 100,
      }),
      buildWorkOrderServiceTask({
        id: 2,
        status: ServiceTaskStatus.CANCELED,
        amount: 50,
      }),
    ];

    const workOrder = buildWorkOrder({ serviceTasks });

    workOrder.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    workOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));

    // Force status to IN_EXECUTION to exercise finalize path
    (workOrder as any).status = WorkOrderStatus.IN_EXECUTION;

    workOrder.finalize(new Date("2024-01-10T11:00:00.000Z"));

    const snapshot = workOrder.toSnapshot();
    expect(snapshot.status).toBe(WorkOrderStatus.CANCELED);
  });

  it("auto-finalizes when the last service task completes during execution", () => {
    const workOrder = buildInExecutionWorkOrder({
      serviceTasks: [
        { serviceTaskId: 1, status: ServiceTaskStatus.IN_EXECUTION, amount: 200 },
        { serviceTaskId: 2, status: ServiceTaskStatus.COMPLETED, amount: 100 },
      ],
    });

    const now = new Date("2024-01-10T11:00:00.000Z");
    workOrder.updateServiceTaskStatus({
      serviceTaskId: 1,
      status: ServiceTaskStatus.COMPLETED,
      now,
    });

    const snapshot = workOrder.toSnapshot();
    expect(snapshot.status).toBe(WorkOrderStatus.FINALIZED);
    expect(snapshot.updatedAt).toBe(now.toISOString());
  });

  it("auto-cancels when the final service task is canceled during execution", () => {
    const workOrder = buildInExecutionWorkOrder({
      serviceTasks: [
        { serviceTaskId: 1, status: ServiceTaskStatus.IN_EXECUTION, amount: 200 },
        { serviceTaskId: 2, status: ServiceTaskStatus.CANCELED, amount: 100 },
      ],
    });

    workOrder.updateServiceTaskStatus({
      serviceTaskId: 1,
      status: ServiceTaskStatus.CANCELED,
      now: new Date("2024-01-10T11:00:00.000Z"),
    });

    expect(workOrder.toSnapshot().status).toBe(WorkOrderStatus.CANCELED);
  });
});
