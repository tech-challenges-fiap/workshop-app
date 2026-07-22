## MODIFIED Requirements

### Requirement: OS Service records compensation intent without distributed transport

`workshop-app` SHALL model compensation decisions locally by recording a compensation state and reason, and the distributed-flow layer MAY publish the OS-owned compensation request through the existing event publisher boundary without invoking external services directly.

#### Scenario: Approval rejected requires compensation

- **WHEN** a saga in `WAITING_APPROVAL` receives an approval-rejected event
- **THEN** the saga transitions to `COMPENSATING`
- **AND** the compensation reason is persisted for transport integration

#### Scenario: Compensation completes

- **WHEN** a saga in `COMPENSATING` receives a compensation-completed event
- **THEN** the saga transitions to `COMPENSATED`
