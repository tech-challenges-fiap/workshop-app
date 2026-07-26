# Design: OS Saga Orchestrator Foundation

## Goals

- Keep saga orchestration inside `workshop-app`, the OS Service and work-order system of record.
- Provide a deterministic state machine that can be exercised without a broker.
- Persist saga state so future transport adapters can resume from durable state.
- Record external event identities for idempotent processing.

## Non-goals

- No RabbitMQ exchanges, queues, publishers, consumers, or topology.
- No synchronous calls or direct database connections to Billing Service or Execution Service.
- No distributed transaction implementation.

## State model

A work-order saga is identified by `workOrderId` and stores:

- `sagaId`: stable identifier for the local saga instance.
- `workOrderId`: OS Service work-order id.
- `state`: current orchestration state.
- `lastEventId`: most recent processed external event id, when present.
- `compensationReason`: reason recorded when the saga enters compensation.
- timestamps for creation and update.

The initial state is `RECEIVED`. Transition states represent local orchestration progress only; they do not replace the existing `work_orders.status` state machine.

## Transition model

The orchestrator accepts explicit commands/events and maps them to the next saga state:

- work order received -> `RECEIVED`
- diagnosis started -> `DIAGNOSIS_STARTED`
- diagnosis completed -> `WAITING_APPROVAL`
- approval granted -> `APPROVED`
- execution started -> `IN_EXECUTION`
- execution completed -> `COMPLETED`
- vehicle delivered -> `DELIVERED`
- cancellation requested -> `CANCELED`
- approval rejected or execution failed -> `COMPENSATING`
- compensation completed -> `COMPENSATED`

Invalid transitions fail before persistence.

## Compensation behavior

The foundation records compensation intent and reason but does not call remote services. Future transport tasks may consume this state to publish compensation commands. Compensation is allowed from active pre-terminal states and leads to `COMPENSATING`; a separate compensation-completed event closes the saga as `COMPENSATED`.

## Idempotency

External events include an optional `eventId`. When supplied, the repository records the event id with the saga. Duplicate event ids return an idempotent `duplicate` result and do not re-run transition logic. Duplicate detection is local and does not require a message broker.

## Persistence

Add OS-owned tables:

- `work_order_sagas` for current saga state.
- `work_order_saga_events` for processed event ids and payload hashes.

Both tables belong to `workshop-app` and reference only OS-owned work-order data.
