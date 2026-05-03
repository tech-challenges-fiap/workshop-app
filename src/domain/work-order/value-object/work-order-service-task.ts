import { Money } from "../../shared/value-object/money";
import { ServiceTaskStatus } from "../../service-task/value-object/service-task-status";

export interface WorkOrderServiceTaskSnapshot {
  readonly serviceTaskId: number;
  readonly status: ServiceTaskStatus;
  readonly amount: number;
}

export class WorkOrderServiceTask {
  private constructor(
    private readonly serviceTaskId: number,
    private status: ServiceTaskStatus,
    private amount: Money,
  ) {}

  public static create(params: {
    serviceTaskId: number;
    status: ServiceTaskStatus;
    amount: Money;
  }): WorkOrderServiceTask {
    const { serviceTaskId } = params;

    if (!Number.isFinite(serviceTaskId)) {
      throw new Error("Work order service task id must be a finite number");
    }

    if (!Number.isInteger(serviceTaskId)) {
      throw new Error("Work order service task id must be an integer");
    }

    if (serviceTaskId <= 0) {
      throw new Error("Work order service task id must be greater than zero");
    }

    return new WorkOrderServiceTask(serviceTaskId, params.status, params.amount);
  }

  public getStatus(): ServiceTaskStatus {
    return this.status;
  }

  public getServiceTaskId(): number {
    return this.serviceTaskId;
  }

  public getAmount(): Money {
    return this.amount;
  }

  public updateStatus(status: ServiceTaskStatus): void {
    this.status = status;
  }

  public updateAmount(amount: Money): void {
    this.amount = amount;
  }

  public isApproved(): boolean {
    return this.status === ServiceTaskStatus.APPROVED;
  }

  public isCompleted(): boolean {
    return this.status === ServiceTaskStatus.COMPLETED;
  }

  public isCanceled(): boolean {
    return this.status === ServiceTaskStatus.CANCELED || this.status === ServiceTaskStatus.REJECTED;
  }

  public isRejected(): boolean {
    return this.status === ServiceTaskStatus.REJECTED;
  }

  public isApprovalFinal(): boolean {
    return (
      this.status === ServiceTaskStatus.APPROVED ||
      this.status === ServiceTaskStatus.REJECTED ||
      this.status === ServiceTaskStatus.CANCELED
    );
  }

  public isBillable(): boolean {
    return this.status !== ServiceTaskStatus.REJECTED && this.status !== ServiceTaskStatus.CANCELED;
  }

  public toSnapshot(): WorkOrderServiceTaskSnapshot {
    return {
      serviceTaskId: this.serviceTaskId,
      status: this.status,
      amount: this.amount.toNumber(),
    };
  }
}
