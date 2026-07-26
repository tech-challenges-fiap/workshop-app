## Context

`workshop-app` already exercises the work-order saga happy path (OS opened -> orçamento aprovado -> execução concluída -> `COMPLETED`) through `src/application/work-order/work-order-distributed-flow.test.ts`, a plain `bun:test` integration test. A Fase 4 closure audit found this is the platform's only distributed-flow coverage and that there is no formal BDD/Gherkin specification anywhere in the codebase, and that the README documents the saga's mechanics but never explicitly justifies choosing an orchestrated (central) saga over choreography, which the Fase 4 deliverable requires.

Three test files (`work-order-distributed-flow.test.ts`, `orchestrate-work-order-saga.test.ts`, `handle-inbound-work-order-saga-event.test.ts`) each define their own copy of an `InMemoryWorkOrderSagaRepository` and/or a `RecordingWorkOrderEventPublisher`. Adding a fourth consumer (the BDD step definitions) without extracting these doubles would add a fourth duplicate.

## Goals / Non-Goals

**Goals:**
- Add exactly one formal Gherkin scenario covering the saga happy path, executed against the real `OrchestrateWorkOrderSaga` / `HandleInboundWorkOrderSagaEvent` application classes.
- Remove duplication of the saga test doubles by extracting them once, reused by both `bun:test` and Cucumber.
- Make the BDD scenario run via `bun run test:bdd` locally and in CI, using Bun as the runtime (no Node.js/ts-node dependency).
- Document, in `README.md`, why this repository chose an orchestrated saga over choreography, grounded in what the code actually does.

**Non-Goals:**
- Rewriting or expanding saga behavior, states, or events.
- Covering compensation/failure scenarios in Gherkin (still covered by existing `bun:test` specs).
- Introducing a live RabbitMQ broker dependency for tests.
- Changing the `os-saga-orchestration` state machine or its persistence.

## Decisions

- **Cucumber runtime invocation**: `bunx cucumber-js` resolves the `cucumber-js` binary via its `#!/usr/bin/env node` shebang, which on this environment launches the system Node.js. Node's ESM loader then fails to resolve the extensionless relative imports used by the TypeScript step definitions (`ERR_MODULE_NOT_FOUND`), because plain Node requires explicit file extensions for ESM `import()`. Running `bunx --bun cucumber-js` instead forces Bun to execute the CLI itself, and Bun's own module loader transpiles and resolves the `.ts` step-definition files natively — no `ts-node`, Babel, or additional loader configuration needed. `package.json`'s `test:bdd` script and the CI step both use `bunx --bun cucumber-js`.
- **Test-support location**: the shared doubles live at `src/application/work-order/test-support/`, next to the use cases they support, matching this repository's existing convention of colocating test-only helpers with the layer that consumes them (no repository-wide `test-utils` package exists). `src/**/test-support/**` is excluded from `tsconfig.build.json` so these doubles are not compiled into the shipped `dist` output, mirroring how `*.test.ts` files are already excluded.
- **ESLint scope for `features/`**: the step-definition files live outside `tsconfig.json`'s `include` (`src`, `scripts`), so type-aware ESLint parsing fails for them. Rather than widening the main TypeScript project to include Cucumber glue code, `features/**` is added to the ESLint `ignores` list, the same pattern already used for `docs/fase-4/*.ts`.
- **Gherkin language**: the feature file uses `# language: pt` and Portuguese step text to match the domain language already used in this repository's tests, docs, and the Fase 4 deliverable itself (OS, orçamento, execução), while step definitions reference the real TypeScript enum values (`WorkOrderSagaState.COMPLETED`, `InboundWorkOrderSagaEventName.APPROVAL_GRANTED`, `OsWorkOrderEventName.EXECUTION_REQUESTED`, etc.) rather than inventing new terminology.
- **Saga strategy documentation**: the new README section is grounded in the actual `OrchestrateWorkOrderSaga` implementation (single coordinator for transitions, idempotency, and outbound intent selection) and the repository's existing data-ownership constraints (sole writer of `work_orders`/`work_order_status_history`, no direct Billing/Execution database access), rather than generic saga-pattern boilerplate.

## Risks / Trade-offs

- Running Cucumber through Bun instead of Node is a slightly non-standard setup; the rationale is documented in `README.md`/this design doc and pinned via the `test:bdd` script and CI step so it is reproducible, not tribal knowledge.
- The extracted test-support doubles are implementation details of tests, not a public contract; they are intentionally excluded from the compiled build output.
