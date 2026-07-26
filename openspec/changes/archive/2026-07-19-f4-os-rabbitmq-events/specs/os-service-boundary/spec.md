# os-service-boundary Specification

## MODIFIED Requirements

### Requirement: OS Service owns work-order primary data

`workshop-app` SHALL be the sole system of record for `work_orders`, `work_order_status_history`, OS-owned work-order saga orchestration state, and OS-owned RabbitMQ work-order event contracts. No other service SHALL write to these tables or redefine OS-owned work-order event payloads.

#### Scenario: Work-order mutation routed to OS Service

- **WHEN** any actor creates, updates, transitions the status of, advances local saga orchestration for, or publishes an OS-owned lifecycle fact about a work order
- **THEN** the request is handled exclusively by `workshop-app` domain/application logic and persisted or serialized from `workshop-app` owned state

#### Scenario: Work-order state read by another service

- **WHEN** Billing Service or Execution Service needs work-order state
- **THEN** they consume it via an event, a published projection, or an authorized HTTP call to `workshop-app` — never via a direct SQL connection to the `workshop-app` database
