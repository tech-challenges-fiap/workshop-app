export class WorkOrderPublicTokenNotFound extends Error {
  public readonly name = "WorkOrderPublicTokenNotFound";

  constructor(token: string) {
    super(`Work order not found for token: ${token}`);
  }
}
