## ADDED Requirements

### Requirement: OS Service publishes distributed-flow request intents

`workshop-app` SHALL publish OS-owned request intents to the existing RabbitMQ event publisher boundary when the local work-order saga reaches distributed coordination points.

#### Scenario: Saga start requests Billing authorization

- **WHEN** OS starts a distributed work-order flow for a work order
- **THEN** it persists or resumes the local saga
- **AND** publishes `os.work-order.billing-authorization-requested.v1` with the same `correlationId`
- **AND** the event payload contains the OS-owned `workOrderId`

#### Scenario: Billing authorization requests Execution

- **WHEN** OS handles a non-duplicate `billing.work-order.approval-granted.v1` inbound event
- **THEN** it advances the local saga
- **AND** publishes `os.work-order.execution-requested.v1` with the inbound `correlationId`
- **AND** it does not access Execution persistence directly

#### Scenario: Failure requests distributed compensation

- **WHEN** OS handles a non-duplicate Billing rejection or Execution failure event that moves the saga to compensation
- **THEN** it publishes `os.work-order.compensation-requested.v1` with the inbound `correlationId`
- **AND** includes the compensation reason in the payload when available

### Requirement: OS Service keeps distributed-flow event handling idempotent

`workshop-app` SHALL use inbound event ids as idempotency keys and SHALL NOT emit duplicate downstream intents when the same inbound event is redelivered.

#### Scenario: Duplicate Billing event is redelivered

- **WHEN** OS receives the same supported Billing event envelope twice with the same `eventId`
- **THEN** the second handling returns a duplicate saga result
- **AND** publishes no additional outbound request intent

#### Scenario: Duplicate Execution failure is redelivered

- **WHEN** OS receives the same Execution failure envelope twice with the same `eventId`
- **THEN** the first event can request compensation
- **AND** the duplicate event does not request compensation again
