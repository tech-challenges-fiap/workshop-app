export class WorkOrderNotFound extends Error {
  constructor(identifier: number) {
    super(`Work order not found: ${identifier}`);
    this.name = "WorkOrderNotFound";
  }
}
