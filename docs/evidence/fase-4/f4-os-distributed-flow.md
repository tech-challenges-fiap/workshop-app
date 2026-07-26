# f4-os-distributed-flow Evidence

Date: 2026-07-19
Repository: `workshop-app`
Change id: `f4-os-distributed-flow`

## Implementation summary

- Added OS-owned distributed-flow outbound event names:
  - `os.work-order.billing-authorization-requested.v1`
  - `os.work-order.execution-requested.v1`
  - `os.work-order.compensation-requested.v1`
- Extended `OrchestrateWorkOrderSaga` to publish outbound intents through the existing `WorkOrderEventPublisher` boundary when a correlation id is available.
- Extended the inbound saga handler to pass inbound `correlationId` into the orchestrator so downstream OS intents preserve correlation.
- Kept inbound duplicate handling idempotent by returning before transition/publish when an inbound `eventId` was already processed.
- Allowed distributed execution completion to complete a saga from `APPROVED` as well as `IN_EXECUTION`, so Execution can report completion after OS requests execution even when no separate execution-started event is observed.
- Added broker-free tests for happy path, Billing failure compensation, Execution failure compensation, duplicate inbound events, and correlation propagation.

## Boundary notes

This change does not modify Billing, Execution, platform, or edge repositories. It does not add direct Billing/Execution database access. Tests use an in-memory publisher and do not require a live RabbitMQ broker.

## Validation results

```bash
npx --yes @fission-ai/openspec validate f4-os-distributed-flow --strict
# Change 'f4-os-distributed-flow' is valid
```

```bash
bun run lint
# $ eslint .
# exit_code=0
```

```bash
bun run build
# $ tsc -p tsconfig.build.json
# exit_code=0
```

```bash
bun run arch:check
# $ bun run scripts/architecture-gate.ts check
# Architecture check (offline-fallback): 0 violation(s), 46 accepted edge(s).
```

```bash
DATABASE_URL_TEST=postgresql://workshop_user:workshop_password@127.0.0.1:5432/workshop_db_test \
POSTGRES_HOST=127.0.0.1 \
POSTGRES_USER=workshop_user \
POSTGRES_PASSWORD=workshop_password \
POSTGRES_DB_TEST=workshop_db_test \
bun test
# 431 pass
# 0 fail
# 980 expect() calls
# Ran 431 tests across 81 files.
```

Targeted distributed-flow test coverage:

```bash
bun test src/application/work-order/work-order-distributed-flow.test.ts src/application/work-order/orchestrate-work-order-saga.test.ts src/application/work-order/handle-inbound-work-order-saga-event.test.ts
# 12 pass
# 0 fail
# 32 expect() calls
```
