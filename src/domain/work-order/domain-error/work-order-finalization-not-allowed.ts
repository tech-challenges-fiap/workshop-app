import { WorkOrderStatus } from "../value-object/work-order-status";
import { ServiceTaskStatus } from "../../service-task/value-object/service-task-status";

interface WorkOrderFinalizationNotAllowedParams {
  readonly workOrderId: number | null;
  readonly status: WorkOrderStatus;
  readonly blockingServiceTaskStatuses: ServiceTaskStatus[];
}

export class WorkOrderFinalizationNotAllowed extends Error {
  public readonly name = "WorkOrderFinalizationNotAllowed";
  public readonly workOrderId: number | null;
  public readonly status: WorkOrderStatus;
  public readonly blockingServiceTaskStatuses: ServiceTaskStatus[];

  constructor(params: WorkOrderFinalizationNotAllowedParams) {
    const { workOrderId, status, blockingServiceTaskStatuses } = params;

    const idPart = workOrderId === null ? "unknown" : String(workOrderId);
    const uniqueStatuses = Array.from(new Set(blockingServiceTaskStatuses));
    const statusList = uniqueStatuses.join(", ");

    super(
      `Work order ${idPart} cannot be finalized in status ${status} because it has service tasks in non-final execution statuses: ${statusList}`,
    );

    this.workOrderId = workOrderId;
    this.status = status;
    this.blockingServiceTaskStatuses = [...blockingServiceTaskStatuses];
  }
}
