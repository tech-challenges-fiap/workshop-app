# Change: RabbitMQ events for OS Service

## Why

Phase 4 needs a messaging foundation so the OS Service can publish work-order lifecycle events and consume external saga events without coupling to Billing or Execution Service databases. The existing saga orchestrator is local and durable, but transport boundaries, event envelopes, RabbitMQ configuration, and idempotent consumer handoff are not yet defined.

## What changes

- Add OS-owned RabbitMQ configuration for URL, exchange, work-order queue, and inbound saga queue names.
- Define OS work-order event envelopes and payload types with `eventId` and `correlationId`.
- Add publisher and consumer ports plus RabbitMQ-oriented adapters that serialize/deserialize messages without requiring a live broker in unit tests.
- Add an inbound event handler that validates external saga events and hands them to the local saga orchestrator idempotently.
- Keep this as a foundation only: no distributed end-to-end flow, no synchronous calls to Billing/Execution services, and no direct access to Billing/Execution databases.

## Impact

- Application/runtime configuration gains optional RabbitMQ variables.
- OS application code can publish typed work-order events through a port and handle inbound saga events through a transport-independent consumer handler.
- Tests cover serialization, idempotent saga handoff, configuration defaults/overrides, and malformed/event-handler error behavior.
