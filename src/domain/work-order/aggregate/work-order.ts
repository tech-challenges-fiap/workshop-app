import { Money } from "../../shared/value-object/money";
import { WorkOrderServiceTaskNotFound } from "../domain-error/work-order-service-task-not-found";
import { WorkOrderStatusTransitionNotAllowed } from "../domain-error/work-order-status-transition-not-allowed";
import { WorkOrderStatus } from "../value-object/work-order-status";
import { ServiceTaskStatus } from "../../service-task/value-object/service-task-status";
import { WorkOrderServiceTaskCreationNotAllowed } from "../domain-error/work-order-service-task-creation-not-allowed";
import { WorkOrderFinalizationNotAllowed } from "../domain-error/work-order-finalization-not-allowed";

export interface WorkOrderSnapshot {
  readonly id: number | null;
  readonly vehicleId: number;
  readonly status: WorkOrderStatus;
  readonly totalAmount: number;
  readonly publicToken: string;
  readonly publicTokenExpiresAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly serviceTasks: WorkOrderServiceTaskSnapshot[];
}

interface WorkOrderServiceTaskSnapshot {
  readonly serviceTaskId: number;
  readonly status: ServiceTaskStatus;
  readonly amount: number;
}

interface WorkOrderServiceTaskLine {
  readonly serviceTaskId: number;
  status: ServiceTaskStatus;
  amount: Money;
}

export class WorkOrder {
  private readonly id: number | null;
  private readonly vehicleId: number;
  private status: WorkOrderStatus;
  private totalAmount: Money;
  private publicToken: string;
  private publicTokenExpiresAt: Date;
  private createdAt: Date;
  private updatedAt: Date;
  private serviceTasks: WorkOrderServiceTaskLine[];

  private constructor(params: {
    id: number | null;
    vehicleId: number;
    status: WorkOrderStatus;
    totalAmount: Money;
    publicToken: string;
    publicTokenExpiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    serviceTasks: WorkOrderServiceTaskLine[];
  }) {
    this.id = params.id;
    this.vehicleId = params.vehicleId;
    this.status = params.status;
    this.totalAmount = params.totalAmount;
    this.publicToken = params.publicToken;
    this.publicTokenExpiresAt = params.publicTokenExpiresAt;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
    this.serviceTasks = params.serviceTasks.map((task) => ({ ...task }));
  }

  public static create(params: {
    vehicleId: number;
    publicToken: string;
    publicTokenExpiresAt: Date;
    serviceTasks?: WorkOrderServiceTaskLine[];
    createdAt?: Date;
  }): WorkOrder {
    WorkOrder.assertVehicleId(params.vehicleId);
    WorkOrder.assertPublicToken(params.publicToken);
    WorkOrder.assertValidDate(
      params.publicTokenExpiresAt,
      "Work order public token expiration must be a valid date",
    );

    const createdAt = params.createdAt ?? new Date();
    WorkOrder.assertValidDate(createdAt, "Work order createdAt must be a valid date");
    const updatedAt = createdAt;
    const serviceTasks = params.serviceTasks ?? [];

    WorkOrder.assertUniqueServiceTaskIds(serviceTasks);

    return new WorkOrder({
      id: null,
      vehicleId: params.vehicleId,
      status: WorkOrderStatus.RECEIVED,
      totalAmount: WorkOrder.calculateTotal(serviceTasks),
      publicToken: params.publicToken,
      publicTokenExpiresAt: params.publicTokenExpiresAt,
      createdAt,
      updatedAt,
      serviceTasks,
    });
  }

  public static rehydrate(params: {
    id: number;
    vehicleId: number;
    status: WorkOrderStatus;
    totalAmount: Money;
    publicToken: string;
    publicTokenExpiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    serviceTasks: WorkOrderServiceTaskLine[];
  }): WorkOrder {
    WorkOrder.assertVehicleId(params.vehicleId);
    WorkOrder.assertPublicToken(params.publicToken);
    WorkOrder.assertValidDate(
      params.publicTokenExpiresAt,
      "Work order public token expiration must be a valid date",
    );
    WorkOrder.assertValidDate(params.createdAt, "Work order createdAt must be a valid date");
    WorkOrder.assertValidDate(params.updatedAt, "Work order updatedAt must be a valid date");
    WorkOrder.assertUniqueServiceTaskIds(params.serviceTasks);

    return new WorkOrder({
      id: params.id,
      vehicleId: params.vehicleId,
      status: params.status,
      totalAmount: params.totalAmount,
      publicToken: params.publicToken,
      publicTokenExpiresAt: params.publicTokenExpiresAt,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      serviceTasks: params.serviceTasks,
    });
  }

  public startDiagnosis(now: Date = new Date()): void {
    this.assertTransitionTo(WorkOrderStatus.DIAGNOSIS, [WorkOrderStatus.RECEIVED]);
    this.status = WorkOrderStatus.DIAGNOSIS;
    this.touch(now);
  }

  public completeDiagnosis(now: Date = new Date()): void {
    this.assertTransitionTo(WorkOrderStatus.WAITING_APPROVAL, [WorkOrderStatus.DIAGNOSIS]);
    this.status = WorkOrderStatus.WAITING_APPROVAL;
    this.applyApprovalOutcomeIfResolved();
    this.touch(now);
  }

  public startExecution(now: Date = new Date()): void {
    this.assertTransitionTo(WorkOrderStatus.IN_EXECUTION, [WorkOrderStatus.READY]);

    if (!this.hasApprovedServiceTask()) {
      throw new Error("Work order requires at least one approved service task to start execution");
    }

    this.status = WorkOrderStatus.IN_EXECUTION;
    this.touch(now);
  }

  public startExecutionForServiceTask(params: { serviceTaskId: number; now?: Date }): void {
    this.assertTransitionTo(WorkOrderStatus.IN_EXECUTION, [WorkOrderStatus.READY]);

    const task = this.serviceTasks.find(
      (serviceTask) => serviceTask.serviceTaskId === params.serviceTaskId,
    );

    if (!task) {
      throw new WorkOrderServiceTaskNotFound(params.serviceTaskId);
    }

    task.status = ServiceTaskStatus.IN_EXECUTION;
    this.status = WorkOrderStatus.IN_EXECUTION;
    this.touch(params.now ?? new Date());
  }

  public finalize(now: Date = new Date()): void {
    this.assertTransitionTo(WorkOrderStatus.FINALIZED, [WorkOrderStatus.IN_EXECUTION]);
    this.assertAllTasksCompletedOrCanceled();

    if (this.areAllTasksCanceled()) {
      this.status = WorkOrderStatus.CANCELED;
    } else {
      this.status = WorkOrderStatus.FINALIZED;
    }

    this.touch(now);
  }

  public deliver(now: Date = new Date()): void {
    this.assertTransitionTo(WorkOrderStatus.DELIVERED, [WorkOrderStatus.FINALIZED]);
    this.status = WorkOrderStatus.DELIVERED;
    this.touch(now);
  }

  public assertCanAddServiceTask(): void {
    if (this.status !== WorkOrderStatus.DIAGNOSIS) {
      throw new WorkOrderServiceTaskCreationNotAllowed({ status: this.status });
    }
  }

  public cancel(now: Date = new Date()): void {
    this.assertTransitionTo(WorkOrderStatus.CANCELED, [
      WorkOrderStatus.RECEIVED,
      WorkOrderStatus.DIAGNOSIS,
      WorkOrderStatus.WAITING_APPROVAL,
      WorkOrderStatus.READY,
      WorkOrderStatus.IN_EXECUTION,
    ]);
    this.status = WorkOrderStatus.CANCELED;
    this.touch(now);
  }

  public updateServiceTaskStatus(params: {
    serviceTaskId: number;
    status: ServiceTaskStatus;
    now?: Date;
  }): void {
    this.assertServiceTasksMutable();

    const task = this.serviceTasks.find(
      (serviceTask) => serviceTask.serviceTaskId === params.serviceTaskId,
    );

    if (!task) {
      throw new WorkOrderServiceTaskNotFound(params.serviceTaskId);
    }

    task.status = params.status;
    this.recalculateTotal();

    this.applyApprovalOutcomeIfResolved();

    const now = params.now ?? new Date();
    this.tryAutoFinalize();
    this.touch(now);
  }

  public isPublicTokenValid(now: Date = new Date()): boolean {
    WorkOrder.assertValidDate(now, "Work order public token validation time must be a valid date");
    return now.getTime() <= this.publicTokenExpiresAt.getTime();
  }

  public syncServiceTasks(params: { tasks: WorkOrderServiceTaskLine[]; now?: Date }): void {
    this.assertServiceTasksMutable();
    WorkOrder.assertUniqueServiceTaskIds(params.tasks);

    this.serviceTasks = params.tasks.map((task) => ({ ...task }));
    this.recalculateTotal();

    this.applyApprovalOutcomeIfResolved();

    this.touch(params.now ?? new Date());
  }

  public toSnapshot(): WorkOrderSnapshot {
    return {
      id: this.id,
      vehicleId: this.vehicleId,
      status: this.status,
      totalAmount: this.totalAmount.toNumber(),
      publicToken: this.publicToken,
      publicTokenExpiresAt: this.publicTokenExpiresAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      serviceTasks: this.serviceTasks.map((task) => ({
        serviceTaskId: task.serviceTaskId,
        status: task.status,
        amount: task.amount.toNumber(),
      })),
    };
  }

  private assertTransitionTo(target: WorkOrderStatus, allowedFrom: WorkOrderStatus[]): void {
    if (!allowedFrom.includes(this.status)) {
      throw new WorkOrderStatusTransitionNotAllowed({
        from: this.status,
        to: target,
      });
    }
  }

  private assertServiceTasksMutable(): void {
    if (
      this.status === WorkOrderStatus.CANCELED ||
      this.status === WorkOrderStatus.FINALIZED ||
      this.status === WorkOrderStatus.DELIVERED
    ) {
      throw new Error("Work order service tasks cannot be updated after closure");
    }
  }

  private hasApprovedServiceTask(): boolean {
    return this.serviceTasks.some((task) => task.status === ServiceTaskStatus.APPROVED);
  }

  private applyApprovalOutcomeIfResolved(): void {
    if (this.status !== WorkOrderStatus.WAITING_APPROVAL) {
      return;
    }

    if (!this.areAllTasksApprovalFinal()) {
      return;
    }

    if (this.hasApprovedServiceTask()) {
      this.status = WorkOrderStatus.READY;
      return;
    }

    this.status = WorkOrderStatus.CANCELED;
  }

  private assertAllTasksCompletedOrCanceled(): void {
    if (this.serviceTasks.length === 0) {
      throw new WorkOrderFinalizationNotAllowed({
        workOrderId: this.id,
        status: this.status,
        blockingServiceTaskStatuses: [],
      });
    }

    const blockingStatuses = this.serviceTasks
      .filter(
        (task) =>
          task.status !== ServiceTaskStatus.COMPLETED && task.status !== ServiceTaskStatus.CANCELED,
      )
      .map((task) => task.status);

    if (blockingStatuses.length > 0) {
      throw new WorkOrderFinalizationNotAllowed({
        workOrderId: this.id,
        status: this.status,
        blockingServiceTaskStatuses: blockingStatuses,
      });
    }
  }

  private tryAutoFinalize(): void {
    if (this.status !== WorkOrderStatus.IN_EXECUTION) {
      return;
    }

    if (!this.areAllTasksTerminal()) {
      return;
    }

    this.assertTransitionTo(WorkOrderStatus.FINALIZED, [WorkOrderStatus.IN_EXECUTION]);

    if (this.areAllTasksCanceled()) {
      this.status = WorkOrderStatus.CANCELED;
    } else {
      this.status = WorkOrderStatus.FINALIZED;
    }
  }

  private areAllTasksCanceled(): boolean {
    return (
      this.serviceTasks.length > 0 &&
      this.serviceTasks.every((task) => task.status === ServiceTaskStatus.CANCELED)
    );
  }

  private areAllTasksTerminal(): boolean {
    return (
      this.serviceTasks.length > 0 &&
      this.serviceTasks.every(
        (task) =>
          task.status === ServiceTaskStatus.COMPLETED || task.status === ServiceTaskStatus.CANCELED,
      )
    );
  }

  private areAllTasksApprovalFinal(): boolean {
    return (
      this.serviceTasks.length > 0 &&
      this.serviceTasks.every(
        (task) =>
          task.status === ServiceTaskStatus.APPROVED ||
          task.status === ServiceTaskStatus.REJECTED ||
          task.status === ServiceTaskStatus.CANCELED,
      )
    );
  }

  private recalculateTotal(): void {
    this.totalAmount = WorkOrder.calculateTotal(this.serviceTasks);
  }

  private touch(now: Date): void {
    WorkOrder.assertValidDate(now, "Work order updatedAt must be a valid date");
    this.updatedAt = now;
  }

  private static calculateTotal(tasks: WorkOrderServiceTaskLine[]): Money {
    let total = Money.create(0);

    for (const task of tasks) {
      const isBillable =
        task.status !== ServiceTaskStatus.REJECTED && task.status !== ServiceTaskStatus.CANCELED;

      if (!isBillable) {
        continue;
      }

      total = total.add(task.amount);
    }

    return total;
  }

  private static assertValidDate(value: Date, message: string): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new Error(message);
    }
  }

  private static assertVehicleId(vehicleId: number): void {
    if (!Number.isFinite(vehicleId)) {
      throw new Error("Work order vehicle id must be a finite number");
    }

    if (!Number.isInteger(vehicleId)) {
      throw new Error("Work order vehicle id must be an integer");
    }

    if (vehicleId <= 0) {
      throw new Error("Work order vehicle id must be greater than zero");
    }
  }

  private static assertPublicToken(token: string): void {
    if (!token || token.trim().length === 0) {
      throw new Error("Work order public token must not be empty");
    }
  }

  private static assertUniqueServiceTaskIds(tasks: WorkOrderServiceTaskLine[]): void {
    const ids = new Set<number>();

    for (const task of tasks) {
      if (ids.has(task.serviceTaskId)) {
        throw new Error(`Work order service task id ${task.serviceTaskId} must be unique`);
      }

      ids.add(task.serviceTaskId);
    }
  }
}
