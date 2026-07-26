## 1. OpenSpec

- [x] 1.1 Add the `f4-os-bdd-happy-path` change (proposal, tasks, design, spec delta).
- [x] 1.2 Validate the change with `npx --yes @fission-ai/openspec validate f4-os-bdd-happy-path --strict` before implementation.

## 2. Test-support extraction

- [x] 2.1 Extract `InMemoryWorkOrderSagaRepository` and `RecordingWorkOrderEventPublisher` into `src/application/work-order/test-support/`.
- [x] 2.2 Update `work-order-distributed-flow.test.ts`, `orchestrate-work-order-saga.test.ts`, and `handle-inbound-work-order-saga-event.test.ts` to import the shared doubles instead of duplicating them, without changing any assertions.

## 3. BDD scenario

- [x] 3.1 Add `@cucumber/cucumber` as a devDependency.
- [x] 3.2 Add `cucumber.js` config and a `test:bdd` script that runs `bunx --bun cucumber-js` (plain `bunx cucumber-js` resolves to the system Node.js via the package's shebang and fails on extensionless ESM step-definition imports; `--bun` forces Bun's runtime, which resolves and transpiles the TypeScript step definitions natively).
- [x] 3.3 Write `features/work-order-happy-path.feature` in Portuguese using the real domain state/event names (`WorkOrderSagaState.COMPLETED`, `os.work-order.billing-authorization-requested.v1`, `os.work-order.execution-requested.v1`, etc.).
- [x] 3.4 Write `features/step-definitions/work-order-happy-path.steps.ts` driving the real `OrchestrateWorkOrderSaga` / `HandleInboundWorkOrderSagaEvent` classes with the extracted test-support doubles.
- [x] 3.5 Add `features/**` to the ESLint `ignores` list (the step definitions are intentionally outside the `tsconfig.json` `include` scope used for type-aware linting) and exclude `src/**/test-support/**` from `tsconfig.build.json` so test doubles are not shipped in the compiled `dist` output.

## 4. CI and docs

- [x] 4.1 Add a `bun run test:bdd` step to the `test` job in `.github/workflows/pr-validation.yml`.
- [x] 4.2 Add the "Estratégia do Saga Pattern" section to `README.md`, justifying the orchestrated/central saga over choreography based on the actual `OrchestrateWorkOrderSaga` implementation and existing data-ownership constraints.
- [x] 4.3 Add evidence under `docs/evidence/fase-4/f4-os-bdd-happy-path.md`.

## 5. Validation

- [x] 5.1 Run `bun install`.
- [x] 5.2 Run `bun run lint`.
- [x] 5.3 Run `bun test`.
- [x] 5.4 Run `bun run build`.
- [x] 5.5 Run `bun run arch:check`.
- [x] 5.6 Run `bun run test:bdd`.
- [x] 5.7 Re-run `npx --yes @fission-ai/openspec validate f4-os-bdd-happy-path --strict` before PR handoff.
