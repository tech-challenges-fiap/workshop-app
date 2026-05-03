export class WorkOrderServiceTaskNotFound extends Error {
  // eslint-disable-next-line no-secrets/no-secrets
  public readonly name = "WorkOrderServiceTaskNotFound";

  constructor(serviceTaskId: number) {
    super(`Work order service task not found: ${serviceTaskId}`);
  }
}
