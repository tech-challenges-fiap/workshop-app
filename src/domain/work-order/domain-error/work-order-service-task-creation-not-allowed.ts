import { WorkOrderStatus } from "../value-object/work-order-status";

interface WorkOrderServiceTaskCreationNotAllowedParams {
  readonly status: WorkOrderStatus;
}

export class WorkOrderServiceTaskCreationNotAllowed extends Error {
  public readonly status: WorkOrderStatus;

  constructor(params: WorkOrderServiceTaskCreationNotAllowedParams) {
    super(
      `Work order service tasks can only be created while in DIAGNOSIS status (current: ${params.status})`,
    );
    // eslint-disable-next-line no-secrets/no-secrets
    this.name = "WorkOrderServiceTaskCreationNotAllowed";
    this.status = params.status;
  }
}
