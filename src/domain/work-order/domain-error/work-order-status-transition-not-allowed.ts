import { WorkOrderStatus } from "../value-object/work-order-status";

export class WorkOrderStatusTransitionNotAllowed extends Error {
  // eslint-disable-next-line no-secrets/no-secrets
  public readonly name = "WorkOrderStatusTransitionNotAllowed";

  constructor(params: { from: WorkOrderStatus; to: WorkOrderStatus }) {
    super(`Cannot transition work order status from ${params.from} to ${params.to}`);
  }
}
