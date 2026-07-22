# os-rabbitmq-events Specification

## ADDED Requirements

### Requirement: OS Service defines RabbitMQ messaging configuration

`workshop-app` SHALL expose runtime configuration for RabbitMQ URL, exchange name, OS work-order events queue, inbound saga events queue, and consumer enablement without requiring a live broker during application composition or unit tests.

#### Scenario: RabbitMQ config uses safe defaults

- **WHEN** RabbitMQ environment variables are absent
- **THEN** runtime config leaves `rabbitMqUrl` empty
- **AND** sets the exchange and queue names to OS-owned defaults
- **AND** disables consumers by default

#### Scenario: RabbitMQ config accepts environment overrides

- **WHEN** `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_WORK_ORDER_EVENTS_QUEUE`, `RABBITMQ_SAGA_EVENTS_QUEUE`, and `RABBITMQ_CONSUMERS_ENABLED=true` are present
- **THEN** runtime config exposes those values to messaging adapters

### Requirement: OS Service publishes versioned work-order event envelopes

`workshop-app` SHALL define OS-owned work-order event names and serialize outbound events as JSON envelopes containing `eventId`, `eventName`, `occurredAt`, `correlationId`, `producer`, `schemaVersion`, and an OS-owned payload.

#### Scenario: Work-order event is serialized for RabbitMQ

- **WHEN** a work-order event is published
- **THEN** the publisher sends a JSON message to the configured RabbitMQ exchange
- **AND** uses the OS event name as the routing key
- **AND** sets message metadata suitable for persistent JSON event delivery

#### Scenario: Publisher channel fails

- **WHEN** the RabbitMQ channel rejects or fails to publish the event
- **THEN** the publisher surfaces the failure to the caller
- **AND** does not silently report success

### Requirement: OS Service consumes inbound saga events idempotently

`workshop-app` SHALL parse inbound RabbitMQ saga event envelopes and hand valid events to the local saga orchestrator using the envelope `eventId` for idempotency.

#### Scenario: New inbound saga event is handled

- **WHEN** an inbound saga event envelope has a supported event name, valid `eventId`, valid `correlationId`, valid `occurredAt`, and positive integer `workOrderId`
- **THEN** the consumer maps the event to a `WorkOrderSagaEventType`
- **AND** calls the saga orchestrator with the mapped event type, `eventId`, `occurredAt`, and compensation reason when present

#### Scenario: Duplicate inbound saga event arrives

- **WHEN** two inbound saga messages carry the same `eventId`
- **THEN** the first valid message is applied normally
- **AND** the second message returns a duplicate saga result without reapplying the transition

#### Scenario: Malformed inbound saga event is rejected

- **WHEN** an inbound message is not valid JSON, has an unsupported event name, has an invalid timestamp, or omits a positive integer `workOrderId`
- **THEN** the consumer rejects the message before invoking the saga orchestrator

### Requirement: RabbitMQ events preserve Phase 4 data boundaries

RabbitMQ event support in `workshop-app` SHALL NOT introduce direct Billing Service or Execution Service database access and SHALL NOT implement the full distributed end-to-end flow reserved for `f4-os-distributed-flow`.

#### Scenario: Messaging foundation needs external service state

- **WHEN** the messaging foundation handles or publishes events
- **THEN** it uses only OS-owned event payloads and the local saga orchestrator
- **AND** it does not open Billing or Execution database connections, run cross-schema SQL, or write to non-OS data stores
