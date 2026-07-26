import type { WorkOrderSaga } from "../saga/work-order-saga";

export interface RegisterWorkOrderSagaEventInput {
  sagaId: string;
  eventId: string;
  eventType: string;
  payloadHash: string;
  processedAt: Date;
}

export interface WorkOrderSagaRepository {
  findByWorkOrderId(workOrderId: number): Promise<WorkOrderSaga | null>;
  create(saga: WorkOrderSaga): Promise<WorkOrderSaga>;
  save(saga: WorkOrderSaga): Promise<WorkOrderSaga>;
  hasProcessedEvent(eventId: string): Promise<boolean>;
  recordProcessedEvent(input: RegisterWorkOrderSagaEventInput): Promise<boolean>;
}
