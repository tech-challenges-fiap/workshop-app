import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { workOrderWebhookEvents } from "../db/schema/work-order-webhook-event";
import type {
  RegisterWebhookEventInput,
  WorkOrderWebhookEventRepository,
} from "../../domain/work-order/repository/work-order-webhook-event-repository";

type QueryExecutor = Pick<typeof db, "insert" | "update" | "delete">;

const STATUS_PROCESSING = "PROCESSING";
const STATUS_PROCESSED = "PROCESSED";
const UNIQUE_VIOLATION_ERROR_CODE = "23505";

export class WorkOrderWebhookEventRepositoryPostgres implements WorkOrderWebhookEventRepository {
  constructor(private readonly queryExecutor: QueryExecutor = db) {}

  public async registerPending(input: RegisterWebhookEventInput): Promise<boolean> {
    try {
      await this.queryExecutor.insert(workOrderWebhookEvents).values({
        eventId: input.eventId,
        eventType: input.eventType,
        payloadHash: input.payloadHash,
        status: STATUS_PROCESSING,
        processedAt: null,
      });

      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }

      throw error;
    }
  }

  public async markProcessed(eventId: string): Promise<void> {
    await this.queryExecutor
      .update(workOrderWebhookEvents)
      .set({
        status: STATUS_PROCESSED,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workOrderWebhookEvents.eventId, eventId));
  }

  public async releasePending(eventId: string): Promise<void> {
    await this.queryExecutor
      .delete(workOrderWebhookEvents)
      .where(
        and(
          eq(workOrderWebhookEvents.eventId, eventId),
          eq(workOrderWebhookEvents.status, STATUS_PROCESSING),
        ),
      );
  }
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code === UNIQUE_VIOLATION_ERROR_CODE) {
    return true;
  }

  const causeCode = (error as { cause?: { code?: string } })?.cause?.code;
  return causeCode === UNIQUE_VIOLATION_ERROR_CODE;
}
