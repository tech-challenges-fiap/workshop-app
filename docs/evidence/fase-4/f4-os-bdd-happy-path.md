# f4-os-bdd-happy-path Evidence

Date: 2026-07-26
Repository: `workshop-app`
Change id: `f4-os-bdd-happy-path`

## Implementation summary

- Extracted the previously duplicated `InMemoryWorkOrderSagaRepository` and `RecordingWorkOrderEventPublisher` test doubles into `src/application/work-order/test-support/`, and updated `work-order-distributed-flow.test.ts`, `orchestrate-work-order-saga.test.ts`, and `handle-inbound-work-order-saga-event.test.ts` to import them instead of duplicating them.
- Added `@cucumber/cucumber` as a devDependency, a `cucumber.js` profile, and a `test:bdd` script (`bunx --bun cucumber-js`).
- Added `features/work-order-happy-path.feature` (Portuguese Gherkin) and `features/step-definitions/work-order-happy-path.steps.ts`, driving the real `OrchestrateWorkOrderSaga` / `HandleInboundWorkOrderSagaEvent` classes with the extracted test-support doubles.
- Added a `bun run test:bdd` step to the `test` job in `.github/workflows/pr-validation.yml`.
- Added the "Estratégia do Saga Pattern" section to `README.md`, justifying the orchestrated/central saga over choreography.
- Added `features/**` to the ESLint `ignores` list and `src/**/test-support/**` to the `tsconfig.build.json` `exclude` list.

## Bun/Cucumber compatibility note

`bunx cucumber-js` resolves the `cucumber-js` bin through its `#!/usr/bin/env node` shebang, which launches the system Node.js. Node's ESM loader then fails on the extensionless relative imports used by the TypeScript step definitions:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...\src\application\work-order\handle-inbound-work-order-saga-event' imported from '...\features\step-definitions\work-order-happy-path.steps.ts'
```

`bunx --bun cucumber-js` forces Bun to run the CLI itself; Bun's own module loader transpiles and resolves the `.ts` step definitions natively, with no `ts-node`/Babel loader configuration required. `test:bdd` and the CI step both use `bunx --bun cucumber-js`.

## Validation results

```bash
npx --yes @fission-ai/openspec validate f4-os-bdd-happy-path --strict
# Change 'f4-os-bdd-happy-path' is valid
```

```bash
bun run lint
# $ eslint .
# exit_code=0
```

```bash
bun run test:bdd
# $ bunx --bun cucumber-js
# 1 scenario (1 passed)
# 5 steps (5 passed)
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
JWT_SECRET=test-secret \
bun test
# 422 pass, 0 fail, 930 expect() calls, 79 files, 8.49s
# (see "Local environment note" below for the 2 files excluded from this local run)
```

Targeted saga test-support extraction coverage (no behavior change):

```bash
bun test src/application/work-order/work-order-distributed-flow.test.ts src/application/work-order/orchestrate-work-order-saga.test.ts src/application/work-order/handle-inbound-work-order-saga-event.test.ts
# 12 pass
# 0 fail
# 32 expect() calls
```

## Local environment note (pre-existing, unrelated to this change)

Running the complete, unmodified `bun test` suite (81 files) locally in this Windows/Docker Desktop sandbox surfaces two pre-existing issues, neither touched by this change and both confirmed present on `origin/stag` before this branch (`git diff origin/stag -- <file>` shows no difference):

1. `src/integration/openapi-contract-alignment.test.ts` fails because this Windows checkout has `core.autocrlf=true`, so `docs/openapi.yaml` is checked out with CRLF line endings while the test searches for LF-terminated markers (`"  /work-orders:\n"`). This is a local checkout artifact only; `pr-validation.yml`'s `test` job runs on `ubuntu-latest`, which checks the file out with LF and is unaffected.
2. `src/infrastructure/person/person-repository-postgres.test.ts` has two assertions missing `await` (`expect(repository.create(duplicate)).rejects...` and `expect(repository.save(updated2)).rejects...`, lines 133 and 168). Combined with this sandbox's Docker Desktop network latency (~5s+ for a single round trip that mapped a unique-constraint violation to `PersonDocumentAlreadyExists`, and 20s+ once the rest of the suite is running concurrently), the affected test exceeds bun's default 5000ms per-test timeout. This is unrelated to the work-order saga/BDD scope of this change; it has been flagged separately for a dedicated fix rather than folded into this PR.

With those two pre-existing files temporarily set aside, the remaining 79 files (422 tests) pass in 8.49s, confirming this change does not regress the suite. Both files were restored unmodified before committing.
