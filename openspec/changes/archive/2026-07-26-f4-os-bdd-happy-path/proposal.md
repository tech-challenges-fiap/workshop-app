## Why

A Fase 4 closure audit found that `workshop-app` has no formal BDD/Gherkin coverage anywhere in the platform. The only end-to-end verification of the work-order saga happy path (OS opened -> orçamento aprovado -> execução concluída -> saga `COMPLETED` with the correct distributed events, in order) is a plain `bun:test` integration test. The Fase 4 PDF also requires documenting and justifying, in the README, the choice of an orchestrated (central) saga over choreography — a decision this repository already implements in code but never wrote down explicitly.

## What Changes

- Add a formal Cucumber/Gherkin BDD scenario (`features/work-order-happy-path.feature`) covering the saga happy path, executed by real step definitions that drive the existing `OrchestrateWorkOrderSaga` / `HandleInboundWorkOrderSagaEvent` application classes (no logic reimplementation).
- Add `@cucumber/cucumber` as a devDependency and a `test:bdd` script that runs it through Bun (`bunx --bun cucumber-js`), plus a `cucumber.js` profile pointing at the TypeScript step definitions.
- Extract the `InMemoryWorkOrderSagaRepository` and `RecordingWorkOrderEventPublisher` test doubles — until now duplicated inline across `work-order-distributed-flow.test.ts`, `orchestrate-work-order-saga.test.ts`, and `handle-inbound-work-order-saga-event.test.ts` — into a shared `src/application/work-order/test-support/` module reused by both the `bun:test` suite and the new BDD step definitions.
- Add a `test:bdd` step to the `test` job of `.github/workflows/pr-validation.yml` so the scenario runs in CI alongside lint/test/build.
- Add an explicit "Estratégia do Saga Pattern" section to `README.md` justifying the orchestrated/central saga choice based on this repository's actual data ownership and orchestration code, as required by the Fase 4 deliverable.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `os-saga-orchestration`: adds a requirement that the happy-path distributed flow (start -> approval granted -> execution completed -> `COMPLETED`, with `os.work-order.billing-authorization-requested.v1` and `os.work-order.execution-requested.v1` published in order) is verified by an automated Gherkin/BDD scenario in addition to the existing `bun:test` coverage.

## Impact

- Adds `features/work-order-happy-path.feature` and `features/step-definitions/work-order-happy-path.steps.ts`.
- Adds `src/application/work-order/test-support/in-memory-work-order-saga-repository.ts`, `.../recording-work-order-event-publisher.ts`, and `.../index.ts`; updates the three test files that previously duplicated these doubles to import them instead (pure refactor, no assertion changes).
- Adds `cucumber.js`, a `test:bdd` script, and the `@cucumber/cucumber` devDependency.
- Updates `.github/workflows/pr-validation.yml` (`test` job) and `README.md`.
- No production runtime behavior, API contract, infrastructure, or database schema changes.
