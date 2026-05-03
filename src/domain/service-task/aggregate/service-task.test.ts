import { describe, expect, it } from "bun:test";

import { ServiceTask } from "./service-task";
import { ServiceEstimatedTime } from "../../service/value-object/service-estimated-time";
import { ServiceTaskStatusTransitionNotAllowed } from "../domain-error/service-task-status-transition-not-allowed";
import { ServiceTaskStatus } from "../value-object/service-task-status";
import { Money } from "../../shared/value-object/money";

function buildTask() {
  return ServiceTask.create({
    serviceId: 10,
    estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
    price: Money.create(200),
    workOrderId: 1,
  });
}

describe("ServiceTask", () => {
  it("approves a pending task", () => {
    const task = buildTask();

    task.approve();

    const snapshot = task.toSnapshot();
    expect(snapshot.status).toBe(ServiceTaskStatus.APPROVED);
    expect(snapshot.startedAt).toBeNull();
    expect(snapshot.completedAt).toBeNull();
    expect(snapshot.price).toBe(200);
  });

  it("rejects a pending task", () => {
    const task = buildTask();

    task.reject();

    const snapshot = task.toSnapshot();
    expect(snapshot.status).toBe(ServiceTaskStatus.REJECTED);
  });

  it("cancels an approved task", () => {
    const task = buildTask();

    task.approve();
    task.cancel();

    const snapshot = task.toSnapshot();
    expect(snapshot.status).toBe(ServiceTaskStatus.CANCELED);
  });

  it("starts and completes execution with timestamps", () => {
    const task = buildTask();
    const startedAt = new Date("2024-01-10T10:00:00.000Z");
    const completedAt = new Date("2024-01-10T12:00:00.000Z");

    task.approve();
    task.startExecution(startedAt);
    task.complete(completedAt);

    const snapshot = task.toSnapshot();
    expect(snapshot.status).toBe(ServiceTaskStatus.COMPLETED);
    expect(snapshot.startedAt).toBe(startedAt.toISOString());
    expect(snapshot.completedAt).toBe(completedAt.toISOString());
  });

  it("blocks invalid status transitions", () => {
    const task = buildTask();

    expect(() => task.startExecution(new Date())).toThrowError(
      ServiceTaskStatusTransitionNotAllowed,
    );

    task.approve();

    expect(() => task.reject()).toThrowError(ServiceTaskStatusTransitionNotAllowed);
  });

  it("does not allow completion before start time", () => {
    const task = buildTask();
    const startedAt = new Date("2024-01-10T10:00:00.000Z");
    const completedAt = new Date("2024-01-10T09:00:00.000Z");

    task.approve();
    task.startExecution(startedAt);

    expect(() => task.complete(completedAt)).toThrowError(
      "Service task completion time must be after start time",
    );
  });
});
