# Tasks

## 1. Specification

- [x] Define OS saga orchestration requirements and scenarios.
- [x] Document architecture/data/state decisions for persisted saga state and idempotency.
- [x] Validate the OpenSpec change with strict mode before implementation.

## 2. Implementation

- [x] Add domain/application saga state, transitions, and compensation behavior.
- [x] Add a repository contract and PostgreSQL persistence for saga state and processed external event identities.
- [x] Compose the saga orchestrator in application infrastructure without introducing RabbitMQ transport.

## 3. Tests and validation

- [x] Add tests for transition logic, compensation decisions, and idempotent duplicate external events.
- [x] Run OpenSpec strict validation after implementation.
- [x] Run relevant code validation: lint, tests, build, and architecture check.

## 4. Evidence and archive

- [x] Create evidence under `docs/evidence/fase-4/f4-os-saga-orchestrator.md` if all validations pass.
- [x] Archive the OpenSpec change only after successful validation and evidence generation.
- [x] Validate specs after archive.
