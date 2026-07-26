# Design: OS RabbitMQ Events Foundation

## Goals

- Introduce a transport boundary for OS Service work-order events using RabbitMQ terminology (exchange, routing key, queue) while keeping tests broker-free.
- Keep message contracts OS-owned, versioned, and explicit.
- Ensure every event envelope carries `eventId` for idempotency and `correlationId` for request/saga tracing.
- Route inbound saga events into the existing local saga orchestrator and processed-event store.
- Preserve service boundaries: no direct Billing/Execution database access and no full distributed flow orchestration in this change.

## Non-goals

- No complete Billing/Execution end-to-end distributed workflow.
- No live RabbitMQ connection requirement in unit tests.
- No cross-service SQL connections, cross-schema queries, or direct persistence into Billing/Execution data stores.
- No topology provisioning; infrastructure-as-code belongs outside this application repository unless a later scoped change says otherwise.

## Event boundaries

### Outbound OS events

The OS Service owns events that describe work-order lifecycle facts from its own system of record:

- `os.work-order.received.v1`
- `os.work-order.diagnosis-started.v1`
- `os.work-order.diagnosis-completed.v1`
- `os.work-order.cancelled.v1`
- `os.work-order.delivered.v1`
- `os.work-order.compensation-requested.v1`

Each message is an envelope:

```json
{
  "eventId": "uuid-or-external-id",
  "eventName": "os.work-order.received.v1",
  "occurredAt": "2026-07-19T00:00:00.000Z",
  "correlationId": "request-or-saga-correlation",
  "producer": "workshop-app",
  "schemaVersion": 1,
  "payload": { "workOrderId": 123 }
}
```

Payloads may contain OS-owned identifiers/statuses and compensation reason. They MUST NOT expose raw CPF, bearer tokens, or Billing/Execution database details.

### Inbound saga events

The consumer accepts a constrained set of external facts/commands that correspond to the existing local saga transition events:

- diagnosis started/completed
- approval granted/rejected
- execution started/completed/failed
- vehicle delivered
- cancellation requested
- compensation completed

Inbound envelopes use the same `eventId`, `correlationId`, `occurredAt`, and version fields. The consumer maps the event name to a `WorkOrderSagaEventType` and invokes `OrchestrateWorkOrderSaga`. Duplicate `eventId` values are handled by the existing saga idempotency repository and return a duplicate result without reapplying the transition.

## RabbitMQ adapter shape

The application defines small ports instead of coupling use cases to a broker library:

- `WorkOrderEventPublisher.publish(event)`
- `InboundWorkOrderSagaEventHandler.handle(rawMessage)`
- an AMQP channel abstraction with `publish(exchange, routingKey, content, options)`

A RabbitMQ publisher adapter serializes the event to JSON and delegates publishing to the injected channel abstraction using the configured exchange and `eventName` routing key. A no-op publisher remains available when RabbitMQ is not configured.

## Configuration

Runtime config adds:

- `RABBITMQ_URL` (optional; empty means disabled/no connection in this foundation)
- `RABBITMQ_EXCHANGE` (default `workshop.os.events`)
- `RABBITMQ_WORK_ORDER_EVENTS_QUEUE` (default `workshop.os.work-order-events`)
- `RABBITMQ_SAGA_EVENTS_QUEUE` (default `workshop.os.saga-events`)
- `RABBITMQ_CONSUMERS_ENABLED` (default false)

This change wires configuration and adapters but does not require startup to connect to RabbitMQ.

## Error handling

Malformed JSON, invalid envelopes, unsupported event names, invalid timestamps, and missing `workOrderId` fail before the saga orchestrator is invoked. Publisher serialization or channel failures are surfaced to the caller so future outbox/retry behavior can be added explicitly.
