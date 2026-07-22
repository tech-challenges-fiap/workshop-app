# Tasks

## 1. OpenSpec

- [x] 1.1 Add proposal, design, and spec deltas for RabbitMQ event boundaries.
- [x] 1.2 Validate `f4-os-rabbitmq-events` with OpenSpec strict mode before implementation.

## 2. Messaging contracts and configuration

- [x] 2.1 Add RabbitMQ runtime configuration for URL, exchange, OS work-order event queue, inbound saga event queue, and consumer enablement.
- [x] 2.2 Define OS-owned work-order event names, event envelope, payload types, serializer, and parser including `eventId` and `correlationId`.
- [x] 2.3 Add application ports for work-order event publishing and inbound saga event handling.

## 3. Adapters and use-case handoff

- [x] 3.1 Add a no-op publisher and RabbitMQ publisher adapter that serialize events and delegate actual publishing to an injected AMQP channel abstraction.
- [x] 3.2 Add an inbound saga event consumer/handler that validates messages and calls `OrchestrateWorkOrderSaga` with idempotent `eventId` handoff.
- [x] 3.3 Wire the messaging foundation into bootstrap composition without requiring a live RabbitMQ broker for app creation or unit tests.

## 4. Tests and docs

- [x] 4.1 Add focused tests for serialization/parsing, config defaults/overrides, idempotent inbound handoff, publish behavior, and error behavior.
- [x] 4.2 Update README/docs only for accurate environment variables and messaging boundary notes.
- [x] 4.3 Run OpenSpec strict validation, lint, build, arch check, and full test suite.
- [x] 4.4 Record evidence and archive the change only after validation passes.
