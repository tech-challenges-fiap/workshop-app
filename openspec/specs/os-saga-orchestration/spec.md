# os-saga-orchestration Specification

## Purpose
Defines the OS Service local saga orchestration foundation for work-order lifecycle coordination, including durable saga state, deterministic transitions, compensation intent, and idempotent external event handling without RabbitMQ transport.
## Requirements
### Requirement: OS Service persists work-order saga state

`workshop-app` SHALL persist a local saga instance for each orchestrated work order so the current orchestration state can be resumed without RabbitMQ or another transport component.

#### Scenario: Saga starts for a work order

- **WHEN** the saga orchestrator receives a start command for a work order without an existing saga
- **THEN** it creates a saga instance in state `RECEIVED`
- **AND** records the associated `workOrderId` and timestamps in OS Service persistence

#### Scenario: Existing saga receives another start command

- **WHEN** the saga orchestrator receives a start command for a work order that already has a saga
- **THEN** it returns the existing saga state without creating a second saga instance

### Requirement: OS Service enforces deterministic saga transitions

`workshop-app` SHALL apply saga transitions through a deterministic state machine that rejects invalid state changes before persistence.

#### Scenario: Valid happy-path transition sequence

- **WHEN** a saga progresses through diagnosis started, diagnosis completed, approval granted, execution started, execution completed, and vehicle delivered
- **THEN** the persisted saga states progress through `DIAGNOSIS_STARTED`, `WAITING_APPROVAL`, `APPROVED`, `IN_EXECUTION`, `COMPLETED`, and `DELIVERED`

#### Scenario: Invalid transition is requested

- **WHEN** a saga in `RECEIVED` receives an execution-completed event
- **THEN** the orchestrator rejects the transition
- **AND** the persisted saga state remains unchanged

### Requirement: OS Service records compensation intent without distributed transport

`workshop-app` SHALL model compensation decisions locally by recording a compensation state and reason, and the distributed-flow layer MAY publish the OS-owned compensation request through the existing event publisher boundary without invoking external services directly.

#### Scenario: Approval rejected requires compensation

- **WHEN** a saga in `WAITING_APPROVAL` receives an approval-rejected event
- **THEN** the saga transitions to `COMPENSATING`
- **AND** the compensation reason is persisted for transport integration

#### Scenario: Compensation completes

- **WHEN** a saga in `COMPENSATING` receives a compensation-completed event
- **THEN** the saga transitions to `COMPENSATED`

### Requirement: OS Service applies idempotency to external saga events

`workshop-app` SHALL use external event ids to ensure duplicate saga events do not apply a transition more than once.

#### Scenario: Duplicate event id arrives

- **WHEN** the saga orchestrator receives an event id that has already been processed for the saga
- **THEN** it returns a duplicate result
- **AND** does not run transition logic or change persisted saga state

#### Scenario: New external event id arrives

- **WHEN** the saga orchestrator receives a previously unseen event id
- **THEN** it records the event id and payload hash with the saga
- **AND** applies the requested transition exactly once

