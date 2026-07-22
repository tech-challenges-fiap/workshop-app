## Why

Phase 4 of the FIAP Tech Challenge refactors the workshop system into distinct microservices (OS Service, Billing Service, Execution Service). Before any implementation changes land in `workshop-app`, the OS Service boundary must be formally declared so agents and reviewers know exactly what this repository owns, what it reads as a lightweight projection, and what databases it must never access.

## What Changes

- Declare `workshop-app` as the **OS Service** responsible for work-order lifecycle management.
- Formally own `work_orders` and `work_order_status_history` tables and their domain logic.
- Define a read-only projection (read model) for `person` and `vehicle` data needed by work-order handlers; this projection is seeded or replicated, not shared via cross-database joins.
- State the auth contract: all protected routes validate a JWT issued by `workshop-edge`; no token issuance happens in this service.
- Explicitly prohibit direct database access to Billing Service or Execution Service schemas.
- Record these boundaries as an OpenSpec capability so future implementation tasks can reference this spec.

## Capabilities

### New Capabilities
- `os-service-boundary`: Declares the OS Service ownership perimeter, data responsibilities, auth contract, read-model projection for customer/vehicle data, and cross-service data-access prohibitions.

### Modified Capabilities
- `openspec-governance`: No requirement changes; existing governance process applies unchanged.

## Impact

- Affects documentation, spec artifacts, and future implementation task scope only.
- Does not change runtime behavior, database schema, API contracts, or deployment configuration at this stage.
- Establishes the authoritative reference boundary that all subsequent Phase 4 implementation changes must respect.
