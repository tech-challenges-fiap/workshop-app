import type {
  RegisterWorkOrderSagaEventInput,
  WorkOrderSagaRepository,
} from "../../../domain/work-order/repository/work-order-saga-repository";
import type { WorkOrderSaga } from "../../../domain/work-order/saga/work-order-saga";

/**
 * In-memory `WorkOrderSagaRepository` test double shared across the work-order
 * saga application tests (unit, distributed-flow, and BDD scenarios). Keeping
 * a single implementation avoids drift between the inline copies that used to
 * live in each test file.
 */
export class InMemoryWorkOrderSagaRepository implements WorkOrderSagaRepository {
  private readonly sagasByWorkOrderId = new Map<number, WorkOrderSaga>();
  private readonly events = new Map<string, RegisterWorkOrderSagaEventInput>();

  public async findByWorkOrderId(workOrderId: number): Promise<WorkOrderSaga | null> {
    return this.sagasByWorkOrderId.get(workOrderId) ?? null;
  }

  public async create(saga: WorkOrderSaga): Promise<WorkOrderSaga> {
    this.sagasByWorkOrderId.set(saga.toSnapshot().workOrderId, saga);
    return saga;
  }

  public async save(saga: WorkOrderSaga): Promise<WorkOrderSaga> {
    this.sagasByWorkOrderId.set(saga.toSnapshot().workOrderId, saga);
    return saga;
  }

  public async hasProcessedEvent(eventId: string): Promise<boolean> {
    return this.events.has(eventId);
  }

  public async recordProcessedEvent(input: RegisterWorkOrderSagaEventInput): Promise<boolean> {
    if (this.events.has(input.eventId)) {
      return false;
    }

    this.events.set(input.eventId, input);
    return true;
  }
}
