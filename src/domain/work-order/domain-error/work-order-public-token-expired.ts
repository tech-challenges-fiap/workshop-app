export class WorkOrderPublicTokenExpired extends Error {
  public readonly name = "WorkOrderPublicTokenExpired";

  constructor(token: string) {
    super(`Work order public token expired: ${token}`);
  }
}
