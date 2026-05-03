export interface RegisterWebhookEventInput {
  eventId: string;
  eventType: string;
  payloadHash: string;
}

export interface WorkOrderWebhookEventRepository {
  registerPending(input: RegisterWebhookEventInput): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
  releasePending(eventId: string): Promise<void>;
}
