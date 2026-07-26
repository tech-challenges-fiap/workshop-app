import type { WorkOrderSagaState } from "../saga/work-order-saga";

export class WorkOrderSagaTransitionNotAllowed extends Error {
  // eslint-disable-next-line no-secrets/no-secrets
  public readonly name = "WorkOrderSagaTransitionNotAllowed";

  constructor(params: { from: WorkOrderSagaState; eventType: string }) {
    super(`Work order saga cannot apply ${params.eventType} from ${params.from}`);
  }
}
