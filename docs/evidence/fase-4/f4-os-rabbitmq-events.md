# Evidence: f4-os-rabbitmq-events

## Summary

Implemented the Phase 4 RabbitMQ events foundation for the OS Service (`workshop-app`) on top of the local work-order saga orchestrator.

## Scope delivered

- OpenSpec change `f4-os-rabbitmq-events` with proposal, design, task list, and spec deltas.
- RabbitMQ runtime configuration for URL, exchange, outbound work-order queue, inbound saga queue, and consumer enablement.
- OS-owned work-order event names and JSON envelopes with `eventId`, `correlationId`, `producer`, `schemaVersion`, `occurredAt`, and typed payload.
- Serializer/parser validation for outbound and inbound event envelopes.
- Work-order event publisher port and no-op publisher for broker-free composition.
- RabbitMQ publisher adapter using an injected AMQP channel abstraction; no live broker required by unit tests.
- Inbound saga event handler that maps supported inbound event names to `WorkOrderSagaEventType` and hands off to `OrchestrateWorkOrderSaga` using `eventId` idempotency.
- Tests for config, serialization/parsing, idempotent inbound handoff, compensation reason handoff, unsupported/malformed event behavior, publisher metadata, and publish rejection behavior.
- README, `.env.example`, development docs, and architecture messaging boundary notes.

## Validation commands and results

```bash
npx --yes @fission-ai/openspec validate f4-os-rabbitmq-events --strict
# Change 'f4-os-rabbitmq-events' is valid

bun run lint
# eslint completed successfully

bun run build
# tsc -p tsconfig.build.json completed successfully

bun run arch:check
# Architecture check (offline-fallback): 0 violation(s), 46 accepted edge(s).

DATABASE_URL_TEST=postgresql://workshop_user:workshop_password@127.0.0.1:5432/workshop_db_test \
POSTGRES_HOST=127.0.0.1 \
POSTGRES_USER=workshop_user \
POSTGRES_PASSWORD=workshop_password \
POSTGRES_DB_TEST=workshop_db_test \
bun test
# 426 pass, 0 fail, 962 expect() calls, 80 files
```

## Notes

- Archive completed: `npx --yes @fission-ai/openspec archive f4-os-rabbitmq-events --yes` archived the change as `2026-07-19-f4-os-rabbitmq-events`.
- Post-archive specs validation completed: `npx --yes @fission-ai/openspec validate --specs --strict` returned 3 passed, 0 failed.
- This is a messaging foundation only; it does not implement the full `f4-os-distributed-flow`.
- No direct Billing Service or Execution Service database access was added.
- Unit tests do not require a live RabbitMQ broker.
