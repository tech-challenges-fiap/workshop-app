export class WorkOrderWebhookEventInvalid extends Error {
  public readonly name = "WorkOrderWebhookEventInvalid";

  constructor(message: string) {
    super(message);
  }
}
