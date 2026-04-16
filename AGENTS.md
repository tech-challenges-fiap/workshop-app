# AGENTS.md

## Mission

Work in `workshop-app` as an application repository. Keep this repo focused on
service behavior, domain/application logic, and runtime packaging.

## Scope Boundaries

In scope:

- Bun application code in `src/`
- service tests in `test/`
- container/runtime behavior
- app-focused documentation

Out of scope:

- gateway-specific adapters
- infrastructure provisioning
- shared runtime platform bootstrap

## Read First

- `README.md`
- `docs/architecture.md`
- `docs/development.md`
- `src/app.ts`
- `src/server.ts`
- `test/app.test.ts`

## Validation Commands

```bash
bun run lint
bun test
bun run build
docker build --tag workshop-app:local .
```

Run all relevant validation for any behavior change. For documentation-only
changes, still verify that documented commands and paths are correct.

## Writing Rules

- Write docs and AI guidance in English
- Do not invent endpoints, persistence layers, or workflows that are not present
- Keep repository boundaries explicit
- Prefer small, accurate updates over aspirational claims

## Documentation Expectations

Update `README.md`, `docs/`, and `.ai/` when you change:

- commands
- file layout
- implemented endpoints
- ownership boundaries
- CI or delivery behavior
