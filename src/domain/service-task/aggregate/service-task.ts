import { ServiceEstimatedTime } from "../../service/value-object/service-estimated-time";
import { Money } from "../../shared/value-object/money";
import { ServiceTaskStatusTransitionNotAllowed } from "../domain-error/service-task-status-transition-not-allowed";
import { ServiceTaskStatus } from "../value-object/service-task-status";

export interface ServiceTaskSnapshot {
  readonly id: number | null;
  readonly serviceId: number;
  readonly workOrderId: number;
  readonly status: ServiceTaskStatus;
  readonly estimatedTime: number;
  readonly price: number;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export class ServiceTask {
  private readonly id: number | null;
  private readonly serviceId: number;
  private readonly workOrderId: number;
  private status: ServiceTaskStatus;
  private estimatedTime: ServiceEstimatedTime;
  private price: Money;
  private startedAt: Date | null;
  private completedAt: Date | null;

  private constructor(params: {
    id: number | null;
    serviceId: number;
    workOrderId: number;
    status: ServiceTaskStatus;
    estimatedTime: ServiceEstimatedTime;
    price: Money;
    startedAt: Date | null;
    completedAt: Date | null;
  }) {
    this.id = params.id;
    this.serviceId = params.serviceId;
    this.workOrderId = params.workOrderId;
    this.status = params.status;
    this.estimatedTime = params.estimatedTime;
    this.price = params.price;
    this.startedAt = params.startedAt;
    this.completedAt = params.completedAt;
  }

  public static create(params: {
    serviceId: number;
    estimatedTime: ServiceEstimatedTime;
    price: Money;
    workOrderId: number;
  }): ServiceTask {
    ServiceTask.assertWorkOrderId(params.workOrderId);

    return new ServiceTask({
      id: null,
      serviceId: params.serviceId,
      workOrderId: params.workOrderId,
      status: ServiceTaskStatus.PENDING_APPROVAL,
      estimatedTime: params.estimatedTime,
      price: params.price,
      startedAt: null,
      completedAt: null,
    });
  }

  public static rehydrate(params: {
    id: number;
    serviceId: number;
    workOrderId: number;
    status: ServiceTaskStatus;
    estimatedTime: ServiceEstimatedTime;
    price: Money;
    startedAt: Date | null;
    completedAt: Date | null;
  }): ServiceTask {
    ServiceTask.assertTimestampsConsistent({
      status: params.status,
      startedAt: params.startedAt,
      completedAt: params.completedAt,
    });

    ServiceTask.assertWorkOrderId(params.workOrderId);

    return new ServiceTask({
      id: params.id,
      serviceId: params.serviceId,
      workOrderId: params.workOrderId,
      status: params.status,
      estimatedTime: params.estimatedTime,
      price: params.price,
      startedAt: params.startedAt,
      completedAt: params.completedAt,
    });
  }

  public approve(): void {
    this.assertTransitionTo(ServiceTaskStatus.APPROVED, [ServiceTaskStatus.PENDING_APPROVAL]);
    this.status = ServiceTaskStatus.APPROVED;
  }

  public reject(): void {
    this.assertTransitionTo(ServiceTaskStatus.REJECTED, [ServiceTaskStatus.PENDING_APPROVAL]);
    this.status = ServiceTaskStatus.REJECTED;
  }

  public startExecution(startedAt: Date): void {
    this.assertTransitionTo(ServiceTaskStatus.IN_EXECUTION, [ServiceTaskStatus.APPROVED]);
    ServiceTask.assertValidDate(startedAt, "Service task startedAt must be a valid date");

    this.startedAt = startedAt;
    this.status = ServiceTaskStatus.IN_EXECUTION;
  }

  public complete(completedAt: Date): void {
    this.assertTransitionTo(ServiceTaskStatus.COMPLETED, [ServiceTaskStatus.IN_EXECUTION]);
    ServiceTask.assertValidDate(completedAt, "Service task completedAt must be a valid date");

    if (!this.startedAt) {
      throw new Error("Service task must be started before completion");
    }

    if (completedAt.getTime() < this.startedAt.getTime()) {
      throw new Error("Service task completion time must be after start time");
    }

    this.completedAt = completedAt;
    this.status = ServiceTaskStatus.COMPLETED;
  }

  public cancel(): void {
    this.assertTransitionTo(ServiceTaskStatus.CANCELED, [
      ServiceTaskStatus.PENDING_APPROVAL,
      ServiceTaskStatus.APPROVED,
      ServiceTaskStatus.IN_EXECUTION,
    ]);

    this.status = ServiceTaskStatus.CANCELED;
  }

  public toSnapshot(): ServiceTaskSnapshot {
    return {
      id: this.id,
      serviceId: this.serviceId,
      workOrderId: this.workOrderId,
      status: this.status,
      estimatedTime: this.estimatedTime.toMinutes(),
      price: this.price.toNumber(),
      startedAt: ServiceTask.serializeDate(this.startedAt),
      completedAt: ServiceTask.serializeDate(this.completedAt),
    };
  }

  private assertTransitionTo(target: ServiceTaskStatus, allowedFrom: ServiceTaskStatus[]): void {
    if (!allowedFrom.includes(this.status)) {
      throw new ServiceTaskStatusTransitionNotAllowed({
        from: this.status,
        to: target,
      });
    }
  }

  private static assertValidDate(value: Date, message: string): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new Error(message);
    }
  }

  private static assertWorkOrderId(value: number): void {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      throw new Error("Service task work order id must be a positive integer");
    }
  }

  private static serializeDate(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private static assertTimestampsConsistent(params: {
    status: ServiceTaskStatus;
    startedAt: Date | null;
    completedAt: Date | null;
  }): void {
    if (params.startedAt) {
      ServiceTask.assertValidDate(params.startedAt, "Service task startedAt must be a valid date");
    }

    if (params.completedAt) {
      ServiceTask.assertValidDate(
        params.completedAt,
        "Service task completedAt must be a valid date",
      );
    }

    if (params.completedAt) {
      if (!params.startedAt) {
        throw new Error("Service task completedAt requires startedAt");
      }

      if (params.completedAt.getTime() < params.startedAt.getTime()) {
        throw new Error("Service task completion time must be after start time");
      }
    }

    switch (params.status) {
      case ServiceTaskStatus.PENDING_APPROVAL:
      case ServiceTaskStatus.APPROVED:
      case ServiceTaskStatus.REJECTED:
        if (params.startedAt || params.completedAt) {
          throw new Error("Service task timestamps must be empty before execution");
        }
        break;
      case ServiceTaskStatus.IN_EXECUTION:
        if (!params.startedAt) {
          throw new Error("Service task startedAt must be set while in execution");
        }
        if (params.completedAt) {
          throw new Error("Service task completedAt must be empty while in execution");
        }
        break;
      case ServiceTaskStatus.COMPLETED:
        if (!params.startedAt || !params.completedAt) {
          throw new Error("Service task timestamps must be set when completed");
        }
        break;
      case ServiceTaskStatus.CANCELED:
        if (params.completedAt) {
          throw new Error("Service task completedAt must be empty when canceled");
        }
        break;
    }
  }
}
