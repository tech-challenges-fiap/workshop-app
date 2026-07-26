import { eq } from "drizzle-orm";

import { db } from "../db";
import { workOrderSagaEvents, workOrderSagas } from "../db/schema/work-order-saga";
import type {
  RegisterWorkOrderSagaEventInput,
  WorkOrderSagaRepository,
} from "../../domain/work-order/repository/work-order-saga-repository";
import {
  WorkOrderSaga,
  WorkOrderSagaState,
} from "../../domain/work-order/saga/work-order-saga";

type QueryExecutor = Pick<typeof db, "insert" | "select" | "update">;
type TimestampValue = Date | string | null;
type WorkOrderSagaRow = typeof workOrderSagas.$inferSelect;

const UNIQUE_VIOLATION_ERROR_CODE = "23505";

export class WorkOrderSagaRepositoryPostgres implements WorkOrderSagaRepository {
  constructor(private readonly queryExecutor: QueryExecutor = db) {}

  public async findByWorkOrderId(workOrderId: number): Promise<WorkOrderSaga | null> {
    const [row] = await this.queryExecutor
      .select()
      .from(workOrderSagas)
      .where(eq(workOrderSagas.workOrderId, workOrderId));

    if (!row) {
      return null;
    }

    return mapToSaga(row);
  }

  public async create(saga: WorkOrderSaga): Promise<WorkOrderSaga> {
    const snapshot = saga.toSnapshot();

    const [row] = await this.queryExecutor
      .insert(workOrderSagas)
      .values({
        sagaId: snapshot.sagaId,
        workOrderId: snapshot.workOrderId,
        state: snapshot.state,
        lastEventId: snapshot.lastEventId,
        compensationReason: snapshot.compensationReason,
        createdAt: new Date(snapshot.createdAt),
        updatedAt: new Date(snapshot.updatedAt),
      })
      .returning();

    return mapToSaga(row);
  }

  public async save(saga: WorkOrderSaga): Promise<WorkOrderSaga> {
    const snapshot = saga.toSnapshot();

    const [row] = await this.queryExecutor
      .update(workOrderSagas)
      .set({
        state: snapshot.state,
        lastEventId: snapshot.lastEventId,
        compensationReason: snapshot.compensationReason,
        updatedAt: new Date(snapshot.updatedAt),
      })
      .where(eq(workOrderSagas.sagaId, snapshot.sagaId))
      .returning();

    return mapToSaga(row);
  }

  public async hasProcessedEvent(eventId: string): Promise<boolean> {
    const [row] = await this.queryExecutor
      .select({ eventId: workOrderSagaEvents.eventId })
      .from(workOrderSagaEvents)
      .where(eq(workOrderSagaEvents.eventId, eventId));

    return Boolean(row);
  }

  public async recordProcessedEvent(input: RegisterWorkOrderSagaEventInput): Promise<boolean> {
    try {
      await this.queryExecutor.insert(workOrderSagaEvents).values({
        sagaId: input.sagaId,
        eventId: input.eventId,
        eventType: input.eventType,
        payloadHash: input.payloadHash,
        processedAt: input.processedAt,
      });

      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }

      throw error;
    }
  }
}

function mapToSaga(row: WorkOrderSagaRow): WorkOrderSaga {
  const createdAt = toDate(row.createdAt);
  const updatedAt = toDate(row.updatedAt);

  if (!createdAt || !updatedAt) {
    throw new Error("Work order saga timestamps must be defined");
  }

  return WorkOrderSaga.rehydrate({
    sagaId: row.sagaId,
    workOrderId: row.workOrderId,
    state: assertWorkOrderSagaState(row.state),
    lastEventId: row.lastEventId,
    compensationReason: row.compensationReason,
    createdAt,
    updatedAt,
  });
}

function assertWorkOrderSagaState(raw: string): WorkOrderSagaState {
  if (Object.values(WorkOrderSagaState).includes(raw as WorkOrderSagaState)) {
    return raw as WorkOrderSagaState;
  }

  throw new Error("Work order saga state is invalid");
}

function toDate(value: TimestampValue): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code === UNIQUE_VIOLATION_ERROR_CODE) {
    return true;
  }

  const causeCode = (error as { cause?: { code?: string } })?.cause?.code;
  return causeCode === UNIQUE_VIOLATION_ERROR_CODE;
}
