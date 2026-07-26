## ADDED Requirements

### Requirement: OS Service happy-path distributed flow is verified by a BDD scenario

`workshop-app` SHALL provide an automated Gherkin/BDD scenario, executed against the real saga orchestrator and inbound event handler, that verifies the work-order saga happy path reaches `COMPLETED` with the correct OS-owned distributed events published in order.

#### Scenario: OS opened, budget approved, execution completed reaches COMPLETED

- **WHEN** a work-order saga is started, moved through diagnosis, and reaches `WAITING_APPROVAL`
- **AND** a billing approval-granted event and then an execution-completed event are handled
- **THEN** the saga state is `COMPLETED`
- **AND** `os.work-order.billing-authorization-requested.v1` and `os.work-order.execution-requested.v1` were published, in that order, with the inbound `correlationId` preserved
