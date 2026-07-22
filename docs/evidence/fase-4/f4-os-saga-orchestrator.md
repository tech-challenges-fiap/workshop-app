# Evidence: f4-os-saga-orchestrator

## Scope

Implemented the Phase 4 OS Service saga orchestration foundation in `workshop-app` only.

In scope:

- Durable local work-order saga state.
- Deterministic saga state transitions.
- Compensation intent and reason recording.
- Idempotency for external saga event ids.
- Unit tests for transition, compensation, and idempotency behavior.

Out of scope and not implemented:

- RabbitMQ topology, producers, consumers, queues, exchanges, or retry workers.
- Distributed saga transport flow.
- Direct database access to Billing Service or Execution Service.

## Implementation summary

- Added `WorkOrderSaga` domain state machine with states from `RECEIVED` through terminal `DELIVERED`, `CANCELED`, and `COMPENSATED` outcomes.
- Added `OrchestrateWorkOrderSaga` application use case that starts sagas, applies transitions, records compensation intent, and handles duplicate external event ids.
- Added OS-owned PostgreSQL schema/migration for `work_order_sagas` and `work_order_saga_events`.
- Added `WorkOrderSagaRepositoryPostgres` and wired it through infrastructure/application dependency builders.
- Added tests for valid transitions, invalid transitions, compensation transitions, and duplicate event id handling.

## Validation commands

```bash
npx --yes @fission-ai/openspec validate f4-os-saga-orchestrator --strict
bun test src/domain/work-order/saga/work-order-saga.test.ts src/application/work-order/orchestrate-work-order-saga.test.ts src/bootstrap/build-infrastructure.test.ts src/bootstrap/build-use-cases.test.ts
bun run build
bun run lint
bun run arch:check
POSTGRES_HOST=localhost POSTGRES_USER=workshop_user POSTGRES_PASSWORD=workshop_password POSTGRES_DB=workshop_db POSTGRES_DB_TEST=workshop_db_test bun test
```

## Results

- OpenSpec strict validation: pass.
- Targeted saga/bootstrap tests: pass (`12 pass, 0 fail`).
- Build: pass.
- Lint: pass.
- Architecture check: pass (`0 violation(s)`).
- Full test suite: pass with the local PostgreSQL container reachable through `POSTGRES_HOST=localhost` (`418 pass, 0 fail`).

A first unqualified `bun test` attempt failed because the test runtime defaulted to `POSTGRES_HOST=postgres`, which is not resolvable from the host shell. Re-running with the local PostgreSQL host variables passed.

## Archive

Archived with:

```bash
npx --yes @fission-ai/openspec archive f4-os-saga-orchestrator --yes
```

Post-archive spec validation was run after archive.
