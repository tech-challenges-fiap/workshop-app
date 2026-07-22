## ADDED Requirements

### Requirement: Distributed flow preserves OS service boundaries

`workshop-app` SHALL coordinate Billing and Execution only through OS-owned saga state and event envelopes.

#### Scenario: Distributed flow needs downstream service state

- **WHEN** the OS distributed-flow layer coordinates Billing or Execution work
- **THEN** it publishes or handles event envelopes through repository-local saga state and the `WorkOrderEventPublisher` boundary
- **AND** it SHALL NOT query, migrate, or write Billing or Execution databases
- **AND** it SHALL NOT require a live RabbitMQ broker during automated tests
