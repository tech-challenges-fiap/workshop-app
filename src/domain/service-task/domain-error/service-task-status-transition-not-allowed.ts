import { ServiceTaskStatus } from "../value-object/service-task-status";

export class ServiceTaskStatusTransitionNotAllowed extends Error {
  // eslint-disable-next-line no-secrets/no-secrets
  public readonly name = "ServiceTaskStatusTransitionNotAllowed";

  constructor(params: { from: ServiceTaskStatus; to: ServiceTaskStatus }) {
    super(`Cannot transition service task status from ${params.from} to ${params.to}`);
  }
}
